"""
Claude Decision Lambda - Pure AI decision making
Responsibility: Analyze user queries and create action plans using Claude
"""
import json
import boto3
import os
import time
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from anthropic import Anthropic
from datetime import datetime
import logging
import sys
import traceback
from functools import wraps

# Note: Shared utilities not available in this deployment
# from error_handler import error_handler, ErrorHandler, ErrorType, ErrorSeverity, AIServiceError, ValidationError

# Simple retry decorator
def retry_with_backoff(max_retries: int = 3, base_delay: float = 1.0, max_delay: float = 10.0):
    def decorator(func):
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise e
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
                    time.sleep(delay)
            return func(*args, **kwargs)
        return wrapper
    return decorator

# Simple error handler classes
class ErrorType:
    VALIDATION_ERROR = "VALIDATION_ERROR"
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
    RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR"
    AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR"
    PERMISSION_ERROR = "PERMISSION_ERROR"
    TIMEOUT_ERROR = "TIMEOUT_ERROR"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"

class ErrorSeverity:
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class ValidationError(Exception):
    def __init__(self, message: str, error_context=None):
        super().__init__(message)
        self.error_context = error_context

class AIServiceError(Exception):
    def __init__(self, message: str, error_context=None):
        super().__init__(message)
        self.error_context = error_context

class ErrorHandler:
    @staticmethod
    def classify_error(exception: Exception, service_name: str, operation: str):
        # Simple error classification
        if isinstance(exception, ValidationError):
            return type('ErrorContext', (), {
                'error_type': ErrorType.VALIDATION_ERROR,
                'severity': ErrorSeverity.MEDIUM,
                'service': service_name,
                'operation': operation
            })()
        elif "rate limit" in str(exception).lower():
            return type('ErrorContext', (), {
                'error_type': ErrorType.RATE_LIMIT_ERROR,
                'severity': ErrorSeverity.MEDIUM,
                'service': service_name,
                'operation': operation
            })()
        else:
            return type('ErrorContext', (), {
                'error_type': ErrorType.UNKNOWN_ERROR,
                'severity': ErrorSeverity.HIGH,
                'service': service_name,
                'operation': operation
            })()

    @staticmethod
    def log_error(error_context, exception: Exception, additional_data=None):
        logger.error(f"Error in {error_context.service}.{error_context.operation}: {str(exception)}")
        if additional_data:
            logger.error(f"Additional data: {additional_data}")

    @staticmethod
    def create_error_response(error_context, message: str, status_code: int = 500):
        return {
            'statusCode': status_code,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': error_context.error_type,
                'message': message,
                'service': error_context.service,
                'operation': error_context.operation
            })
        }

def error_handler(service_name: str, operation: str):
    """Decorator for error handling in lambda functions"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except (ValidationError, AIServiceError) as e:
                # Re-raise custom errors with context
                ErrorHandler.log_error(e.error_context, e)
                return ErrorHandler.create_error_response(
                    e.error_context, 
                    e.message,
                    status_code=400 if e.error_context.error_type == ErrorType.VALIDATION_ERROR else 500
                )
            except Exception as e:
                # Classify and handle unknown errors
                error_context = ErrorHandler.classify_error(e, service_name, operation)
                ErrorHandler.log_error(error_context, e)
                
                status_code = 400 if error_context.error_type == ErrorType.VALIDATION_ERROR else 500
                return ErrorHandler.create_error_response(error_context, str(e), status_code)
        
        return wrapper
    return decorator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY')
CONVERSATIONS_TABLE = os.environ.get('CONVERSATIONS_TABLE', 'chatbot-conversations')

# Pydantic models
class LambdaAction(BaseModel):
    action_type: str = Field(..., description="Type of action")
    parameters: Dict[str, Any] = Field(default={}, description="Action parameters")
    priority: int = Field(default=1, description="Action priority (1=highest)")
    can_parallelize: bool = Field(default=True, description="Whether this action can run in parallel")
    depends_on: List[str] = Field(default=[], description="Action IDs this action depends on")

class ActionGroup(BaseModel):
    group_id: str = Field(..., description="Unique group identifier")
    actions: List[LambdaAction] = Field(..., description="Actions in this group")
    execution_type: str = Field(..., description="parallel or sequential")
    group_priority: int = Field(default=1, description="Group priority (1=highest)")
    question_context: str = Field(default="", description="Which question(s) this group addresses")

class ActionPlan(BaseModel):
    action_groups: List[ActionGroup] = Field(..., description="Groups of actions to execute")
    reasoning: str = Field(..., description="Claude's reasoning for the action plan")
    requires_rag: bool = Field(default=False, description="Whether RAG context is needed")
    total_actions: int = Field(default=0, description="Total number of actions")
    questions_identified: List[str] = Field(default=[], description="List of questions identified in the query")
    multi_question: bool = Field(default=False, description="Whether the query contains multiple questions")
    needs_clarification: bool = Field(default=False, description="Whether more details are needed from user")
    clarification_questions: List[str] = Field(default=[], description="Questions to ask user for clarification")
    can_proceed: bool = Field(default=True, description="Whether we can proceed with current information")

class ClaudeDecisionService:
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
        self.conversations_table = self.dynamodb.Table(CONVERSATIONS_TABLE)
        
        # Initialize Anthropic client (same as orchestrator)
        try:
            # Initialize with explicit parameters to avoid proxy issues
            self.anthropic_client = Anthropic(
                api_key=CLAUDE_API_KEY,
                timeout=30.0
            )
            logger.info("Claude client initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing Anthropic client: {e}")
            self.anthropic_client = None

    def get_conversation_history(self, conversation_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get conversation history from DynamoDB with error handling"""
        try:
            response = self.conversations_table.query(
                KeyConditionExpression='sessionId = :conv_id',
                ExpressionAttributeValues={':conv_id': conversation_id},
                ScanIndexForward=True,
                Limit=limit
            )
            
            messages = []
            for item in response['Items']:
                messages.append({
                    'role': item['role'],
                    'content': item['content'],
                    'timestamp': item['timestamp']
                })
            
            return messages
            
        except Exception as e:
            error_context = ErrorHandler.classify_error(e, "claude-decision", "get_conversation_history")
            ErrorHandler.log_error(error_context, e, {'conversation_id': conversation_id})
            # Return empty history rather than failing completely
            return []

    def create_decision_prompt(self, user_message: str, conversation_history: List[Dict[str, Any]]) -> str:
        """Create the decision-making prompt for Claude"""
        conversation_context = ""
        if conversation_history:
            conversation_context = "\n\nPrevious conversation:\n"
            for msg in conversation_history[-3:]:  # Last 3 messages for context
                conversation_context += f"{msg['role']}: {msg['content']}\n"
        
        return f"""You are an AI decision-making system that analyzes user queries and determines what backend actions need to be taken, including which can be executed in parallel. You can handle multiple questions in a single query.

Available Lambda Actions:
1. search_rag - Search knowledge base using RAG (parameters: query, limit) - CAN PARALLELIZE
2. list_documents - List available documents (parameters: limit) - CAN PARALLELIZE  
3. generate_embeddings - Generate embeddings for text (parameters: text) - CAN PARALLELIZE
4. get_document_content - Get specific document content (parameters: document_id) - CAN PARALLELIZE
5. simple_response - Provide a simple response without backend actions (parameters: response_text) - CANNOT PARALLELIZE

{conversation_context}

User Query: "{user_message}"

FIRST: Identify if this query contains multiple questions. Look for:
- Multiple question marks (?)
- Conjunctions like "and", "also", "what about", "how about"
- Separate distinct topics or requests

THEN: Analyze this query and determine:
1. What questions are being asked (list them separately)
2. Do I have enough information to answer these questions?
3. What additional details might be needed?
4. What actions need to be taken for each question
5. The parameters for each action
6. Which actions can run in parallel vs sequentially
7. Dependencies between actions
8. Group actions for optimal execution (group by question context)
9. Whether RAG context is needed
10. Your reasoning for the decision

IMPORTANT: 
- If the query is too vague or missing critical information, set needs_clarification=true
- Ask specific, helpful questions to get the missing details
- Group actions that can run in parallel together
- Actions that depend on others should be in separate groups
- For multiple questions, group actions by which question they address
- Use question_context to indicate which question each group addresses

Respond with a JSON object in this exact format:
{{
    "action_groups": [
        {{
            "group_id": "group_1",
            "actions": [
                {{
                    "action_type": "search_rag",
                    "parameters": {{"query": "user query", "limit": 5}},
                    "priority": 1,
                    "can_parallelize": true,
                    "depends_on": []
                }}
            ],
            "execution_type": "parallel",
            "group_priority": 1,
            "question_context": "What documents do I have and how do I search them?"
        }}
    ],
    "reasoning": "Your reasoning for this action plan",
    "requires_rag": true,
    "total_actions": 1,
    "questions_identified": ["What documents do I have?"],
    "multi_question": false,
    "needs_clarification": false,
    "clarification_questions": [],
    "can_proceed": true
}}"""

    def parse_claude_response(self, response_text: str) -> ActionPlan:
        """Parse Claude's response and create ActionPlan with error handling"""
        try:
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                decision_json = json.loads(json_match.group())
            else:
                decision_json = json.loads(response_text)
            
            # Convert to ActionPlan
            action_groups = []
            total_actions = 0
            
            for group_data in decision_json.get('action_groups', []):
                actions = [LambdaAction(**action) for action in group_data.get('actions', [])]
                action_group = ActionGroup(
                    group_id=group_data.get('group_id', f'group_{len(action_groups) + 1}'),
                    actions=actions,
                    execution_type=group_data.get('execution_type', 'sequential'),
                    group_priority=group_data.get('group_priority', 1),
                    question_context=group_data.get('question_context', '')
                )
                action_groups.append(action_group)
                total_actions += len(actions)
            
            return ActionPlan(
                action_groups=action_groups,
                reasoning=decision_json.get('reasoning', ''),
                requires_rag=decision_json.get('requires_rag', False),
                total_actions=total_actions,
                questions_identified=decision_json.get('questions_identified', []),
                multi_question=decision_json.get('multi_question', False),
                needs_clarification=decision_json.get('needs_clarification', False),
                clarification_questions=decision_json.get('clarification_questions', []),
                can_proceed=decision_json.get('can_proceed', True)
            )
            
        except json.JSONDecodeError as e:
            error_context = ErrorHandler.classify_error(e, "claude-decision", "parse_claude_response")
            ErrorHandler.log_error(error_context, e, {'response_text': response_text[:200]})
            
            # Return fallback action plan
            fallback_group = ActionGroup(
                group_id="fallback_group",
                actions=[LambdaAction(
                    action_type="simple_response", 
                    parameters={"response_text": "I understand your request but need to process it differently."}
                )],
                execution_type="sequential",
                group_priority=1
            )
            return ActionPlan(
                action_groups=[fallback_group],
                reasoning="Error parsing Claude response, using fallback",
                requires_rag=False,
                total_actions=1
            )
        except Exception as e:
            error_context = ErrorHandler.classify_error(e, "claude-decision", "parse_claude_response")
            raise ValidationError(f"Failed to parse Claude response: {str(e)}", error_context)

    @error_handler("claude-decision", "make_decision")
    def make_decision(self, user_message: str, conversation_id: str) -> ActionPlan:
        """Main decision-making function with comprehensive error handling"""
        try:
            # Check if Anthropic client is available
            if not self.anthropic_client:
                logger.error("Anthropic client not initialized - returning fallback action plan")
                fallback_group = ActionGroup(
                    group_id="fallback_group",
                    actions=[LambdaAction(
                        action_type="simple_response",
                        parameters={"response_text": "I'm sorry, I'm unable to process your request at the moment."}
                    )],
                    execution_type="sequential",
                    group_priority=1
                )
                return ActionPlan(
                    action_groups=[fallback_group],
                    reasoning="Anthropic client not available, using fallback response",
                    requires_rag=False,
                    total_actions=1
                )
            
            # Validate inputs
            if not user_message or not user_message.strip():
                raise ValidationError("User message cannot be empty", 
                    ErrorHandler.classify_error(ValueError("Empty message"), "claude-decision", "make_decision"))
            
            # Get conversation history
            history = self.get_conversation_history(conversation_id)
            
            # Create decision prompt
            decision_prompt = self.create_decision_prompt(user_message, history)
            
            # Get Claude's decision with retry logic
            try:
                response = self.anthropic_client.messages.create(
                    model="claude-sonnet-4-5-20250929",
                    max_tokens=1000,
                    messages=[{"role": "user", "content": decision_prompt}]
                )
                
                decision_text = response.content[0].text.strip()
                logger.info(f"Claude decision received: {len(decision_text)} characters")
                
            except Exception as e:
                error_context = ErrorHandler.classify_error(e, "claude-decision", "claude_api_call")
                if error_context.error_type == ErrorType.RATE_LIMIT_ERROR:
                    # For rate limits, return a simple response action
                    fallback_group = ActionGroup(
                        group_id="rate_limit_fallback",
                        actions=[LambdaAction(
                            action_type="simple_response",
                            parameters={"response_text": "I'm experiencing high demand right now. Please try again in a moment."}
                        )],
                        execution_type="sequential",
                        group_priority=1
                    )
                    return ActionPlan(
                        action_groups=[fallback_group],
                        reasoning="Rate limit encountered, using fallback response",
                        requires_rag=False,
                        total_actions=1
                    )
                else:
                    raise AIServiceError(f"Claude API call failed: {str(e)}", error_context)
            
            # Parse and return action plan
            action_plan = self.parse_claude_response(decision_text)
            logger.info(f"Action plan created: {len(action_plan.action_groups)} groups, {action_plan.total_actions} total actions")
            
            return action_plan
            
        except (ValidationError, AIServiceError):
            # Re-raise custom errors
            raise
        except Exception as e:
            error_context = ErrorHandler.classify_error(e, "claude-decision", "make_decision")
            raise AIServiceError(f"Decision making failed: {str(e)}", error_context)

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for Claude decision making"""
    try:
        logger.info(f"Claude Decision event: {json.dumps(event)}")
        
        # Handle OPTIONS request for CORS preflight
        if event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Max-Age': '86400'
                },
                'body': ''
            }
        
        # Parse the request
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        action = body.get('action', '')
        user_message = body.get('user_message', '')
        conversation_id = body.get('conversation_id', '')
        
        if action != 'make_decision':
            return ErrorHandler.create_error_response(
                ErrorHandler.classify_error(ValueError("Invalid action"), "claude-decision", "lambda_handler"),
                f"Action '{action}' not supported. Expected 'make_decision'",
                status_code=400
            )
        
        if not user_message:
            return ErrorHandler.create_error_response(
                ErrorHandler.classify_error(ValueError("Missing user_message"), "claude-decision", "lambda_handler"),
                "user_message is required",
                status_code=400
            )
        
        # Initialize service and make decision
        service = ClaudeDecisionService()
        action_plan = service.make_decision(user_message, conversation_id)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'action_plan': action_plan.dict(),
                'success': True,
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    except (ValidationError, AIServiceError) as e:
        # Handle custom errors
        return ErrorHandler.create_error_response(
            e.error_context, 
            e.message,
            status_code=400 if e.error_context.error_type == ErrorType.VALIDATION_ERROR else 500
        )
    except Exception as e:
        # Handle unexpected errors
        error_context = ErrorHandler.classify_error(e, "claude-decision", "lambda_handler")
        ErrorHandler.log_error(error_context, e)
        return ErrorHandler.create_error_response(error_context, str(e), status_code=500)
