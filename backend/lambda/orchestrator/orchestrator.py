import json
import boto3
import os
import uuid
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from anthropic import Anthropic
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY')
CONVERSATIONS_TABLE = os.environ.get('CONVERSATIONS_TABLE', 'chatbot-conversations')

# Lambda function names
RAG_SEARCH_LAMBDA = os.environ.get('RAG_SEARCH_LAMBDA', 'chatbot-rag-search')
DOCUMENT_MANAGEMENT_LAMBDA = os.environ.get('DOCUMENT_MANAGEMENT_LAMBDA', 'chatbot-document-management')
RESPONSE_ENHANCEMENT_LAMBDA = os.environ.get('RESPONSE_ENHANCEMENT_LAMBDA', 'chatbot-response-enhancement')
ACTION_EXECUTOR_LAMBDA = os.environ.get('ACTION_EXECUTOR_LAMBDA', 'chatbot-action-executor')
RAG_PROCESSOR_LAMBDA = os.environ.get('RAG_PROCESSOR_LAMBDA', 'chatbot-rag-processor')
CLAUDE_DECISION_LAMBDA = os.environ.get('CLAUDE_DECISION_LAMBDA', 'chatbot-claude-decision')
RESPONSE_FORMATTER_LAMBDA = os.environ.get('RESPONSE_FORMATTER_LAMBDA', 'chatbot-response-formatter')
VECTOR_SEARCH_LAMBDA = os.environ.get('VECTOR_SEARCH_LAMBDA', 'chatbot-vector-search')
PRESIGNED_URL_LAMBDA = os.environ.get('PRESIGNED_URL_LAMBDA', 'chatbot-presigned-url')
SOURCE_EXTRACTOR_LAMBDA = os.environ.get('SOURCE_EXTRACTOR_LAMBDA', 'chatbot-source-extractor')
CONVERSATION_MANAGER_LAMBDA = os.environ.get('CONVERSATION_MANAGER_LAMBDA', 'chatbot-conversation-manager')
EMBEDDING_SERVICE_LAMBDA = os.environ.get('EMBEDDING_SERVICE_LAMBDA', 'chatbot-embedding-service')
DOCUMENT_METADATA_LAMBDA = os.environ.get('DOCUMENT_METADATA_LAMBDA', 'chatbot-document-metadata')
CHAT_HANDLER_LAMBDA = os.environ.get('CHAT_HANDLER_LAMBDA', 'chatbot-chat-handler')
DOCUMENT_CONTENT_LAMBDA = os.environ.get('DOCUMENT_CONTENT_LAMBDA', 'chatbot-document-content')

# Pydantic models
class ChatMessage(BaseModel):
    role: str = Field(..., description="Message role (user, assistant)")
    content: str = Field(..., description="Message content")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class ChatRequest(BaseModel):
    message: str = Field(..., description="User message")
    conversation_id: Optional[str] = Field(default=None, description="Conversation ID")
    use_rag: bool = Field(default=True, description="Whether to use RAG for context")

class LambdaAction(BaseModel):
    action_type: str = Field(..., description="Type of action (search_rag, list_documents, etc.)")
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

class Orchestrator:
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
        self.lambda_client = boto3.client('lambda', region_name='ap-south-1')
        self.conversations_table = self.dynamodb.Table(CONVERSATIONS_TABLE)

        # Initialize Anthropic client
        try:
            # Initialize with explicit parameters to avoid proxy issues
            self.anthropic_client = Anthropic(
                api_key=CLAUDE_API_KEY,
                timeout=30.0
            )
        except Exception as e:
            logger.error(f"Error initializing Anthropic client: {e}")
            self.anthropic_client = None

    def delegate_to_lambda(self, lambda_name: str, payload: Dict[str, Any], invocation_type: str = 'RequestResponse', timeout_seconds: int = 25) -> Dict[str, Any]:
        """Generic method to delegate tasks to any Lambda function with timeout handling"""
        try:
            logger.info(f"Delegating to {lambda_name} with payload: {json.dumps(payload)}")
            
            # For ML-heavy functions like RAG search, use async invocation to avoid timeouts
            if lambda_name in [RAG_SEARCH_LAMBDA, RAG_PROCESSOR_LAMBDA] and invocation_type == 'RequestResponse':
                logger.info(f"Using async invocation for ML-heavy function: {lambda_name}")
                response = self.lambda_client.invoke(
                    FunctionName=lambda_name,
                    InvocationType='Event',  # Async invocation
                    Payload=json.dumps(payload)
                )
                return {
                    'statusCode': 202,
                    'message': f'Async processing started for {lambda_name}',
                    'async': True
                }
            
            response = self.lambda_client.invoke(
                FunctionName=lambda_name,
                InvocationType=invocation_type,
                Payload=json.dumps(payload)
            )
            
            if invocation_type == 'RequestResponse':
                result = json.loads(response['Payload'].read())
                logger.info(f"Response from {lambda_name}: {json.dumps(result)}")
                return result
            else:
                logger.info(f"Async invocation to {lambda_name} completed")
                return {'statusCode': 202, 'message': 'Async invocation started'}
                
        except Exception as e:
            logger.error(f"Error delegating to {lambda_name}: {e}")
            return {
                'statusCode': 500,
                'error': f'Error calling {lambda_name}',
                'message': str(e)
            }

    def get_conversation_history(self, conversation_id: str, limit: int = 10) -> List[ChatMessage]:
        """Get conversation history from DynamoDB"""
        try:
            response = self.conversations_table.query(
                KeyConditionExpression='sessionId = :conv_id',
                ExpressionAttributeValues={':conv_id': conversation_id},
                ScanIndexForward=True,
                Limit=limit
            )
            
            messages = []
            for item in response['Items']:
                messages.append(ChatMessage(
                    role=item['role'],
                    content=item['content'],
                    timestamp=item['timestamp']
                ))
            
            return messages
            
        except Exception as e:
            logger.error(f"Error getting conversation history: {e}")
            return []

    def claude_decision_making(self, user_message: str, conversation_id: str) -> ActionPlan:
        """Claude analyzes query and decides what Lambda actions to take"""
        try:
            logger.info("=" * 20)
            logger.info("CLAUDE_DECISION_MAKING STARTED")
            logger.info(f"User message: '{user_message}'")
            logger.info(f"Conversation ID: '{conversation_id}'")
            logger.info(f"Anthropic client initialized: {bool(self.anthropic_client)}")
            
            if not self.anthropic_client:
                logger.error("Anthropic client not initialized - returning empty action plan")
                return ActionPlan(actions=[], reasoning="Claude client not available", requires_rag=False)
            
            # Get conversation history for context
            history = self.get_conversation_history(conversation_id)
            conversation_context = ""
            if history:
                conversation_context = "\n\nPrevious conversation:\n"
                for msg in history[-3:]:  # Last 3 messages for context
                    conversation_context += f"{msg.role}: {msg.content}\n"
            
            # Create decision-making prompt
            decision_prompt = f"""You are an AI decision-making system that analyzes user queries and determines what backend actions need to be taken, including which can be executed in parallel. You can handle multiple questions in a single query.

Available Lambda Actions:
1. search_rag - Search knowledge base using RAG (parameters: query, limit) - CAN PARALLELIZE
2. list_documents - List available documents (parameters: limit) - CAN PARALLELIZE  
3. generate_embeddings - Generate embeddings for text (parameters: text) - CAN PARALLELIZE
4. get_document_content - Get specific document content (parameters: document_id) - CAN PARALLELIZE
5. simple_response - Provide a simple response without backend actions (parameters: response_text) - CANNOT PARALLELIZE

IMPORTANT: For document upload requests, use simple_response to guide users to the Knowledge Base Management interface instead of trying to perform the upload action directly.

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
                }},
                {{
                    "action_type": "list_documents", 
                    "parameters": {{"limit": 10}},
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
    "total_actions": 2,
    "questions_identified": ["What documents do I have?", "How do I search them?"],
    "multi_question": true,
    "needs_clarification": false,
    "clarification_questions": [],
    "can_proceed": true
}}

If no backend actions are needed, return:
{{
    "action_groups": [
        {{
            "group_id": "group_1",
            "actions": [
                {{
                    "action_type": "simple_response",
                    "parameters": {{"response_text": "Your direct response"}},
                    "priority": 1,
                    "can_parallelize": false,
                    "depends_on": []
                }}
            ],
            "execution_type": "sequential",
            "group_priority": 1,
            "question_context": "General response"
        }}
    ],
    "reasoning": "No backend actions needed",
    "requires_rag": false,
    "total_actions": 1,
    "questions_identified": ["General query"],
    "multi_question": false,
    "needs_clarification": false,
    "clarification_questions": [],
    "can_proceed": true
}}

If clarification is needed, return:
{{
    "action_groups": [],
    "reasoning": "Need more information to proceed",
    "requires_rag": false,
    "total_actions": 0,
    "questions_identified": ["What specific information do you need?"],
    "multi_question": false,
    "needs_clarification": true,
    "clarification_questions": [
        "What specific document are you looking for?",
        "What type of information do you need to search for?",
        "Do you want to search by title, content, or category?"
    ],
    "can_proceed": false
}}"""

            # Get Claude's decision
            messages = [{"role": "user", "content": decision_prompt}]
            
            response = self.anthropic_client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=1000,
                messages=messages
            )
            
            decision_text = response.content[0].text.strip()
            logger.info(f"Claude decision: {decision_text}")
            
            # Parse Claude's response
            try:
                import re
                json_match = re.search(r'\{.*\}', decision_text, re.DOTALL)
                if json_match:
                    decision_json = json.loads(json_match.group())
                else:
                    decision_json = json.loads(decision_text)
                
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
                
                action_plan = ActionPlan(
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
                
                logger.info(f"Parsed action plan: {len(action_groups)} groups, {total_actions} total actions")
                return action_plan
                
            except Exception as parse_error:
                logger.error(f"Error parsing Claude decision: {parse_error}")
                # Fallback to simple response
                fallback_group = ActionGroup(
                    group_id="fallback_group",
                    actions=[LambdaAction(action_type="simple_response", parameters={"response_text": "I understand your request but need to process it differently."})],
                    execution_type="sequential",
                    group_priority=1
                )
                return ActionPlan(
                    action_groups=[fallback_group],
                    reasoning="Error parsing decision, using fallback",
                    requires_rag=False,
                    total_actions=1
                )
                
        except Exception as e:
            logger.error(f"Error in Claude decision making: {e}")
            fallback_group = ActionGroup(
                group_id="error_fallback_group",
                actions=[LambdaAction(action_type="simple_response", parameters={"response_text": "I'm having trouble processing your request right now."})],
                execution_type="sequential",
                group_priority=1
            )
            return ActionPlan(
                action_groups=[fallback_group],
                reasoning="Error in decision making",
                requires_rag=False,
                total_actions=1
            )

    def execute_single_action(self, action: LambdaAction) -> Dict[str, Any]:
        """Execute a single Lambda action by calling the appropriate service"""
        try:
            logger.info(f"Executing action: {action.action_type} with parameters: {action.parameters}")
            
            # Map action types to Lambda functions
            lambda_mapping = {
                "search_rag": RAG_SEARCH_LAMBDA,
                "list_documents": DOCUMENT_MANAGEMENT_LAMBDA,
                "generate_embeddings": RAG_SEARCH_LAMBDA,
                "upload_document": DOCUMENT_MANAGEMENT_LAMBDA,
                "scrape_website": DOCUMENT_MANAGEMENT_LAMBDA,
                "get_presigned_url": PRESIGNED_URL_LAMBDA,
                "get-upload-url": PRESIGNED_URL_LAMBDA,
                "upload": DOCUMENT_MANAGEMENT_LAMBDA,
                "scrape": DOCUMENT_MANAGEMENT_LAMBDA,
                "list": DOCUMENT_MANAGEMENT_LAMBDA,
                "process_document": RAG_PROCESSOR_LAMBDA,
                "extract_metadata": DOCUMENT_METADATA_LAMBDA,
                "extract_content": DOCUMENT_CONTENT_LAMBDA,
                "extract_sources": SOURCE_EXTRACTOR_LAMBDA,
                "vector_search": VECTOR_SEARCH_LAMBDA,
                "embed_text": EMBEDDING_SERVICE_LAMBDA,
                "format_response": RESPONSE_FORMATTER_LAMBDA,
                "manage_conversation": CONVERSATION_MANAGER_LAMBDA,
                "execute_action": ACTION_EXECUTOR_LAMBDA,
                "claude_decision": CLAUDE_DECISION_LAMBDA,
                "chat_handler": CHAT_HANDLER_LAMBDA,
                "get_document_content": DOCUMENT_MANAGEMENT_LAMBDA
            }
            
            # Handle simple responses without Lambda calls
            if action.action_type == "simple_response":
                return {
                    "action_type": "simple_response",
                    "response": action.parameters.get("response_text", "")
                }
            
            # Get the target Lambda function
            target_lambda = lambda_mapping.get(action.action_type)
            if not target_lambda:
                logger.warning(f"Unknown action type: {action.action_type}")
                return {
                    "action_type": action.action_type,
                    "error": f"Unknown action type: {action.action_type}",
                    "result": None
                }
            
            # Prepare payload for the Lambda function
            payload = {
                'action': action.action_type,
                **action.parameters  # Include all parameters from the action
            }
            
            # Call the Lambda function using generic delegation
            result = self.delegate_to_lambda(target_lambda, payload)
            
            return {
                "action_type": action.action_type,
                "lambda_function": target_lambda,
                "result": result
            }
                
        except Exception as e:
            logger.error(f"Error executing action {action.action_type}: {e}")
            return {
                "action_type": action.action_type,
                "error": str(e),
                "result": None
            }

    def execute_lambda_actions(self, action_plan: ActionPlan) -> Dict[str, Any]:
        """Execute the Lambda actions determined by Claude with parallel support"""
        try:
            import asyncio
            import concurrent.futures
            from concurrent.futures import ThreadPoolExecutor
            
            results = {}
            
            # Sort action groups by priority
            sorted_groups = sorted(action_plan.action_groups, key=lambda x: x.group_priority)
            
            for group in sorted_groups:
                logger.info(f"Executing group {group.group_id} ({group.execution_type}) with {len(group.actions)} actions")
                
                if group.execution_type == "parallel":
                    # Execute actions in parallel using ThreadPoolExecutor
                    with ThreadPoolExecutor(max_workers=min(len(group.actions), 5)) as executor:
                        # Submit all actions for parallel execution
                        future_to_action = {
                            executor.submit(self.execute_single_action, action): action 
                            for action in group.actions
                        }
                        
                        # Collect results as they complete
                        group_results = []
                        for future in concurrent.futures.as_completed(future_to_action):
                            action = future_to_action[future]
                            try:
                                result = future.result()
                                group_results.append(result)
                                logger.info(f"Completed parallel action: {action.action_type}")
                            except Exception as e:
                                logger.error(f"Parallel action {action.action_type} failed: {e}")
                                group_results.append({
                                    "action_type": action.action_type,
                                    "error": str(e)
                                })
                        
                        results[group.group_id] = {
                            "execution_type": "parallel",
                            "actions": group_results,
                            "count": len(group_results)
                        }
                        
                else:  # sequential execution
                    group_results = []
                    for action in group.actions:
                        result = self.execute_single_action(action)
                        group_results.append(result)
                        logger.info(f"Completed sequential action: {action.action_type}")
                    
                    results[group.group_id] = {
                        "execution_type": "sequential", 
                        "actions": group_results,
                        "count": len(group_results)
                    }
            
            logger.info(f"Completed execution of {len(action_plan.action_groups)} action groups")
            return results
            
        except Exception as e:
            logger.error(f"Error executing Lambda actions: {e}")
            return {"error": str(e)}

    def create_clarification_response(self, action_plan: ActionPlan) -> str:
        """Create a clarification response when more details are needed"""
        try:
            if not action_plan.clarification_questions:
                return "I need more information to help you properly. Could you please provide more details about what you're looking for?"
            
            response = "I'd be happy to help! To give you the best answer, I need a bit more information:\n\n"
            
            for i, question in enumerate(action_plan.clarification_questions, 1):
                response += f"{i}. {question}\n"
            
            response += f"\n{action_plan.reasoning}"
            
            return response
            
        except Exception as e:
            logger.error(f"Error creating clarification response: {e}")
            return "I need more information to help you properly. Could you please provide more details about what you're looking for?"

    def process_chat_request(self, user_message: str, conversation_id: str) -> Dict[str, Any]:
        """Main orchestration function that coordinates all other lambdas"""
        try:
            logger.info("=" * 30)
            logger.info("PROCESS_CHAT_REQUEST STARTED")
            logger.info(f"User message: '{user_message}'")
            logger.info(f"Conversation ID: '{conversation_id}'")
            logger.info(f"CLAUDE_API_KEY present: {bool(CLAUDE_API_KEY)}")
            logger.info(f"CLAUDE_API_KEY length: {len(CLAUDE_API_KEY) if CLAUDE_API_KEY else 0}")
            
            # Stage 1: Claude Decision Making
            logger.info("Stage 1: Claude decision making...")
            action_plan = self.claude_decision_making(user_message, conversation_id)
            logger.info(f"Action plan created: {action_plan}")
            logger.info(f"Action plan reasoning: {action_plan.reasoning}")
            logger.info(f"Can proceed: {action_plan.can_proceed}")
            logger.info(f"Needs clarification: {action_plan.needs_clarification}")
            logger.info(f"Total actions: {action_plan.total_actions}")
            
            # Check if clarification is needed
            if action_plan.needs_clarification and not action_plan.can_proceed:
                logger.info("Claude needs clarification from user")
                clarification_response = self.create_clarification_response(action_plan)
                
                return {
                    "response": clarification_response,
                    "sources": [],
                    "action_plan": action_plan.dict(),
                    "needs_clarification": True
                }
            
            # Stage 2: Execute Lambda Actions (only if we can proceed)
            if action_plan.can_proceed and action_plan.total_actions > 0:
                logger.info("Stage 2: Executing Lambda actions...")
                action_results = self.execute_lambda_actions(action_plan)
                logger.info(f"Action results: {list(action_results.keys())}")
            else:
                logger.info("No Lambda actions to execute")
                action_results = {}
            
            # Stage 3: Call Response Enhancement Lambda
            logger.info("Stage 3: Calling Response Enhancement Lambda...")
            enhancement_result = self.delegate_to_lambda(
                RESPONSE_ENHANCEMENT_LAMBDA,
                {
                    'action': 'enhance_response',
                    'user_message': user_message,
                    'action_results': action_results,
                    'conversation_id': conversation_id,
                    'action_plan': action_plan.dict()
                }
            )
            
            if enhancement_result.get('statusCode') == 200:
                body = json.loads(enhancement_result['body'])
                return {
                    "response": body.get('response', ''),
                    "sources": body.get('sources', []),
                    "action_plan": action_plan.dict(),
                    "needs_clarification": False
                }
            else:
                logger.error(f"Response enhancement failed: {enhancement_result}")
                return {
                    "response": "I apologize, but I encountered an error while processing your request.",
                    "sources": [],
                    "action_plan": action_plan.dict(),
                    "needs_clarification": False
                }
            
        except Exception as e:
            logger.error(f"Error in orchestration: {e}")
            return {
                "response": f"I apologize, but I encountered an error while processing your request: {str(e)}",
                "sources": [],
                "action_plan": {},
                "needs_clarification": False
            }

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda handler for orchestration"""
    try:
        logger.info("=" * 50)
        logger.info("ORCHESTRATOR LAMBDA STARTED")
        logger.info(f"Event: {json.dumps(event, indent=2)}")
        logger.info(f"Context: {context}")
        logger.info(f"Environment variables: CLAUDE_API_KEY present: {bool(CLAUDE_API_KEY)}")
        logger.info(f"Environment variables: CLAUDE_API_KEY length: {len(CLAUDE_API_KEY) if CLAUDE_API_KEY else 0}")
        
        # Handle OPTIONS request for CORS preflight
        if event.get('httpMethod') == 'OPTIONS':
            logger.info("Handling OPTIONS request for CORS")
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
            logger.info("Parsing request body")
            body = json.loads(event['body'])
            logger.info(f"Parsed body: {json.dumps(body, indent=2)}")
        else:
            body = event
        
        action = body.get('action', '')
        logger.info(f"Action: {action}")
        
        orchestrator = Orchestrator()
        
        if action == 'chat':
            # Handle chat request
            logger.info("Processing chat request")
            chat_request = ChatRequest(**body)
            logger.info(f"Chat request: message='{chat_request.message}', conversation_id='{chat_request.conversation_id}', use_rag={chat_request.use_rag}")
            
            # Generate or use existing conversation ID
            conversation_id = chat_request.conversation_id or str(uuid.uuid4())
            logger.info(f"Using conversation ID: {conversation_id}")
            
            # Process the chat request
            logger.info("Calling orchestrator.process_chat_request")
            result = orchestrator.process_chat_request(
                chat_request.message, 
                conversation_id
            )
            logger.info(f"Chat processing result: {json.dumps(result, indent=2)}")
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'response': result['response'],
                    'sources': result['sources'],
                    'conversation_id': conversation_id,
                    'timestamp': datetime.utcnow().isoformat(),
                    'action_plan': result.get('action_plan', {}),
                    'needs_clarification': result.get('needs_clarification', False)
                })
            }
        
        elif action in ['upload', 'scrape', 'list', 'get-upload-url']:
            # Handle knowledge-base actions
            logger.info(f"Processing knowledge-base action: {action}")
            
            # Map action to appropriate Lambda function
            if action == 'get-upload-url':
                target_lambda = PRESIGNED_URL_LAMBDA
            else:
                target_lambda = DOCUMENT_MANAGEMENT_LAMBDA
            
            try:
                result = orchestrator.delegate_to_lambda(target_lambda, body)
                
                if result.get('statusCode') == 200:
                    return {
                        'statusCode': 200,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                            'Access-Control-Allow-Methods': 'POST, OPTIONS'
                        },
                        'body': result.get('body', '{}')
                    }
                else:
                    return {
                        'statusCode': result.get('statusCode', 500),
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                            'Access-Control-Allow-Methods': 'POST, OPTIONS'
                        },
                        'body': json.dumps({
                            'error': 'Knowledge-base operation failed',
                            'message': result.get('body', 'Unknown error')
                        })
                    }
                    
            except Exception as e:
                logger.error(f"Error calling document management Lambda: {e}")
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Internal server error',
                        'message': str(e)
                    })
                }
        
        else:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'error': 'Invalid action',
                    'message': f'Action "{action}" not supported'
                })
            }
            
    except Exception as e:
        logger.error(f"Error in orchestrator: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }
# Trigger build
# Trigger rebuild for Anthropic fix
# Force refresh
# Trigger rebuild for action format fix
