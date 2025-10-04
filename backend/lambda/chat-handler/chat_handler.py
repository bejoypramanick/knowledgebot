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

# Force rebuild to test fixes - updated anthropic client

# Configuration
MAIN_BUCKET = os.environ.get('MAIN_BUCKET', 'chatbot-storage-ap-south-1')
KNOWLEDGE_BASE_TABLE = os.environ.get('KNOWLEDGE_BASE_TABLE', 'chatbot-knowledge-base')
CONVERSATIONS_TABLE = os.environ.get('CONVERSATIONS_TABLE', 'chatbot-conversations')
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY', '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')
RAG_PROCESSOR_LAMBDA = os.environ.get('RAG_PROCESSOR_LAMBDA', 'chatbot-rag-processor')

# Pydantic models
class ChatMessage(BaseModel):
    role: str = Field(..., description="Message role (user, assistant)")
    content: str = Field(..., description="Message content")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class ChatRequest(BaseModel):
    message: str = Field(..., description="User message")
    conversation_id: Optional[str] = Field(default=None, description="Conversation ID")
    use_rag: bool = Field(default=True, description="Whether to use RAG for context")

class PresignedUrlRequest(BaseModel):
    filename: str = Field(..., description="Filename for upload")
    content_type: str = Field(default="application/octet-stream", description="Content type")
    metadata: Dict[str, Any] = Field(default={}, description="Document metadata")

class LambdaAction(BaseModel):
    action_type: str = Field(..., description="Type of action (search_rag, list_documents, generate_embeddings, etc.)")
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

class ChatHandler:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name='ap-south-1')
        self.dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
        self.lambda_client = boto3.client('lambda', region_name='ap-south-1')
        
        self.main_bucket = MAIN_BUCKET
        self.knowledge_base_table = self.dynamodb.Table(KNOWLEDGE_BASE_TABLE)
        self.conversations_table = self.dynamodb.Table(CONVERSATIONS_TABLE)
        
        # Initialize Anthropic client with explicit configuration
        try:
            logger.info(f"Initializing Anthropic client...")
            logger.info(f"API Key present: {bool(CLAUDE_API_KEY)}")
            logger.info(f"API Key length: {len(CLAUDE_API_KEY) if CLAUDE_API_KEY else 0}")
            logger.info(f"API Key starts with: {CLAUDE_API_KEY[:10] if CLAUDE_API_KEY else 'None'}...")
            logger.info(f"API Key ends with: ...{CLAUDE_API_KEY[-10:] if CLAUDE_API_KEY else 'None'}")
            
            if CLAUDE_API_KEY and CLAUDE_API_KEY != "sk-ant-api03-your-actual-claude-api-key-here":
                logger.info("Creating Anthropic client with API key...")
                self.anthropic_client = Anthropic(
                    api_key=CLAUDE_API_KEY
                )
                logger.info("Anthropic client created successfully!")
            else:
                logger.warning("Claude API key not properly configured")
                self.anthropic_client = None
        except Exception as e:
            logger.error(f"Error initializing Anthropic client: {e}")
            logger.error(f"Exception type: {type(e).__name__}")
            logger.error(f"Exception args: {e.args}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            self.anthropic_client = None

    def get_presigned_upload_url(self, request: PresignedUrlRequest) -> Dict[str, Any]:
        """Generate presigned URL for document upload"""
        try:
            # Generate unique key for the document
            document_id = str(uuid.uuid4())
            file_extension = request.filename.split('.')[-1] if '.' in request.filename else 'txt'
            s3_key = f"documents/{document_id}/{request.filename}"
            
            # Generate presigned URL for PUT request
            presigned_url = self.s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.main_bucket,
                    'Key': s3_key,
                    'ContentType': request.content_type,
                    'Metadata': {
                        'document_id': document_id,
                        'original_filename': request.filename,
                        'upload_timestamp': datetime.utcnow().isoformat(),
                        **request.metadata
                    }
                },
                ExpiresIn=3600,  # 1 hour
                HttpMethod='PUT'
            )
            
            return {
                'presigned_url': presigned_url,
                'document_id': document_id,
                's3_key': s3_key,
                'bucket': self.documents_bucket,
                'metadata': request.metadata
            }
            
        except Exception as e:
            logger.error(f"Error generating presigned URL: {e}")
            raise

    def search_rag_context(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search for relevant context using Docling RAG search"""
        try:
            # Invoke RAG processor Lambda for Docling search
            response = self.lambda_client.invoke(
                FunctionName=RAG_PROCESSOR_LAMBDA,
                InvocationType='RequestResponse',
                Payload=json.dumps({
                    'action': 'search',
                    'query': query,
                    'limit': limit
                })
            )
            
            result = json.loads(response['Payload'].read())
            
            if result.get('statusCode') == 200:
                body = json.loads(result['body'])
                logger.info(f"Docling RAG search returned {len(body.get('results', []))} results")
                return body.get('results', [])
            else:
                logger.error(f"Docling RAG search failed: {result}")
                return []
                
        except Exception as e:
            logger.error(f"Error searching RAG context with Docling: {e}")
            return []

    def get_conversation_history(self, conversation_id: str, limit: int = 10) -> List[ChatMessage]:
        """Get conversation history from DynamoDB"""
        try:
            response = self.conversations_table.query(
                KeyConditionExpression='sessionId = :conv_id',
                ExpressionAttributeValues={':conv_id': conversation_id},
                ScanIndexForward=True,  # Sort by timestamp ascending
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

    def save_message(self, conversation_id: str, message: ChatMessage):
        """Save message to conversation history"""
        try:
            self.conversations_table.put_item(
                Item={
                    'sessionId': conversation_id,
                    'message_id': str(uuid.uuid4()),
                    'role': message.role,
                    'content': message.content,
                    'timestamp': message.timestamp,
                    'created_at': datetime.utcnow().isoformat()
                }
            )
            
        except Exception as e:
            logger.error(f"Error saving message: {e}")

    def claude_decision_making(self, user_message: str, conversation_id: str) -> ActionPlan:
        """Stage 1: Claude analyzes query and decides what Lambda actions to take"""
        try:
            if not self.anthropic_client:
                logger.error("Anthropic client not initialized")
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
                # Extract JSON from response (handle cases where Claude adds extra text)
                import re
                json_match = re.search(r'\{.*\}', decision_text, re.DOTALL)
                if json_match:
                    decision_json = json.loads(json_match.group())
                else:
                    decision_json = json.loads(decision_text)
                
                # Convert to ActionPlan with action groups
                action_groups = []
                total_actions = 0
                
                for group_data in decision_json.get('action_groups', []):
                    actions = [LambdaAction(**action) for action in group_data.get('actions', [])]
                    action_group = ActionGroup(
                        group_id=group_data.get('group_id', f'group_{len(action_groups) + 1}'),
                        actions=actions,
                        execution_type=group_data.get('execution_type', 'sequential'),
                        group_priority=group_data.get('group_priority', 1)
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
            return ActionPlan(
                actions=[LambdaAction(action_type="simple_response", parameters={"response_text": "I'm having trouble processing your request right now."})],
                reasoning="Error in decision making",
                requires_rag=False
            )

    def execute_single_action(self, action: LambdaAction) -> Dict[str, Any]:
        """Execute a single Lambda action"""
        try:
            logger.info(f"Executing action: {action.action_type} with parameters: {action.parameters}")
            
            if action.action_type == "search_rag":
                # Search RAG knowledge base
                query = action.parameters.get("query", "")
                limit = action.parameters.get("limit", 5)
                rag_results = self.search_rag_context(query, limit)
                return {
                    "action_type": "search_rag",
                    "query": query,
                    "results": rag_results,
                    "count": len(rag_results)
                }
                
            elif action.action_type == "list_documents":
                # List available documents
                documents = self.list_documents()
                return {
                    "action_type": "list_documents",
                    "documents": documents,
                    "count": len(documents)
                }
                
            elif action.action_type == "generate_embeddings":
                # Generate embeddings (delegate to RAG processor)
                text = action.parameters.get("text", "")
                response = self.lambda_client.invoke(
                    FunctionName=RAG_PROCESSOR_LAMBDA,
                    InvocationType='RequestResponse',
                    Payload=json.dumps({
                        'action': 'generate_embeddings',
                        'text': text
                    })
                )
                result = json.loads(response['Payload'].read())
                return {
                    "action_type": "generate_embeddings",
                    "result": result
                }
                
            elif action.action_type == "get_document_content":
                # Get specific document content
                document_id = action.parameters.get("document_id", "")
                # This would need to be implemented based on your document storage
                return {
                    "action_type": "get_document_content",
                    "document_id": document_id,
                    "content": "Document content retrieval not yet implemented"
                }
                
            elif action.action_type == "simple_response":
                # Direct response without backend actions
                return {
                    "action_type": "simple_response",
                    "response": action.parameters.get("response_text", "")
                }
                
            else:
                logger.warning(f"Unknown action type: {action.action_type}")
                return {
                    "action_type": f"unknown_{action.action_type}",
                    "error": f"Unknown action type: {action.action_type}"
                }
                
        except Exception as e:
            logger.error(f"Error executing action {action.action_type}: {e}")
            return {
                "action_type": action.action_type,
                "error": str(e)
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

    def claude_response_enhancement(self, user_message: str, action_results: Dict[str, Any], conversation_id: str, action_plan: ActionPlan = None) -> str:
        """Stage 2: Claude takes Lambda results and creates polished response"""
        try:
            if not self.anthropic_client:
                logger.error("Anthropic client not initialized")
                return "I'm sorry, I'm unable to process your request at the moment."
            
            # Get conversation history
            history = self.get_conversation_history(conversation_id)
            conversation_context = ""
            if history:
                conversation_context = "\n\nPrevious conversation:\n"
                for msg in history[-3:]:
                    conversation_context += f"{msg.role}: {msg.content}\n"
            
            # Build context from action results
            results_context = ""
            if action_results:
                results_context = "\n\nBackend Action Results:\n"
                for action_type, result in action_results.items():
                    results_context += f"\n{action_type.upper()}:\n"
                    results_context += f"{json.dumps(result, indent=2)}\n"
            
            # Build context about questions and action plan
            questions_context = ""
            if action_plan and action_plan.questions_identified:
                questions_context = f"\n\nQuestions identified in the query:\n"
                for i, question in enumerate(action_plan.questions_identified, 1):
                    questions_context += f"{i}. {question}\n"
            
            # Create response enhancement prompt
            enhancement_prompt = f"""You are an AI response enhancement system that takes backend action results and creates a polished, helpful response for the user.

{conversation_context}

Original User Query: "{user_message}"
{questions_context}

{results_context}

Based on the user's query and the backend action results above, create a helpful, natural response that:
1. Directly addresses ALL questions asked by the user
2. Incorporates relevant information from the backend results
3. Maintains a conversational tone
4. Cites sources when appropriate
5. Asks follow-up questions if helpful
6. If multiple questions were asked, organize your response to address each one clearly
7. Use the action results to provide specific, actionable information

Provide only the final response text, no additional formatting or explanations."""

            # Get Claude's enhanced response
            messages = [{"role": "user", "content": enhancement_prompt}]
            
                response = self.anthropic_client.messages.create(
                    model="claude-sonnet-4-5-20250929",
                    max_tokens=1000,
                    messages=messages
                )
            
            enhanced_response = response.content[0].text.strip()
            logger.info(f"Claude enhanced response generated")
            
            return enhanced_response
            
        except Exception as e:
            logger.error(f"Error in Claude response enhancement: {e}")
            return f"I apologize, but I encountered an error while processing your request: {str(e)}"

    def generate_response(self, user_message: str, conversation_id: str, use_rag: bool = True) -> str:
        """Generate AI response using two-stage Claude architecture with clarification support"""
        try:
            logger.info(f"Starting two-stage Claude response generation for: {user_message}")
            
            # Stage 1: Claude Decision Making
            logger.info("Stage 1: Claude decision making...")
            action_plan = self.claude_decision_making(user_message, conversation_id)
            logger.info(f"Action plan: {action_plan.reasoning}")
            
            # Check if clarification is needed
            if action_plan.needs_clarification and not action_plan.can_proceed:
                logger.info("Claude needs clarification from user")
                clarification_response = self.create_clarification_response(action_plan)
                
                # Save user message and clarification response
                self.save_message(conversation_id, ChatMessage(role="user", content=user_message))
                self.save_message(conversation_id, ChatMessage(role="assistant", content=clarification_response))
                
                return clarification_response
            
            # Stage 2: Execute Lambda Actions (only if we can proceed)
            if action_plan.can_proceed and action_plan.total_actions > 0:
                logger.info("Stage 2: Executing Lambda actions...")
                action_results = self.execute_lambda_actions(action_plan)
                logger.info(f"Action results: {list(action_results.keys())}")
            else:
                logger.info("No Lambda actions to execute")
                action_results = {}
            
            # Stage 3: Claude Response Enhancement
            logger.info("Stage 3: Claude response enhancement...")
            final_response = self.claude_response_enhancement(user_message, action_results, conversation_id, action_plan)
            
            # Save both user and assistant messages
            self.save_message(conversation_id, ChatMessage(role="user", content=user_message))
            self.save_message(conversation_id, ChatMessage(role="assistant", content=final_response))
            
            logger.info("Two-stage Claude response generation completed")
            return final_response
            
        except Exception as e:
            logger.error(f"Error in two-stage response generation: {e}")
            return f"I apologize, but I encountered an error while processing your request: {str(e)}"

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

    def list_documents(self) -> List[Dict[str, Any]]:
        """List documents in the knowledge base"""
        try:
            # List objects in the documents bucket
            response = self.s3_client.list_objects_v2(
                Bucket=self.documents_bucket,
                Prefix='documents/'
            )
            
            documents = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    # Extract document info from S3 object key
                    key_parts = obj['Key'].split('/')
                    if len(key_parts) >= 3:  # documents/{document_id}/{filename}
                        document_id = key_parts[1]
                        filename = key_parts[2]
                        
                        # Get metadata
                        try:
                            metadata_response = self.s3_client.head_object(
                                Bucket=self.documents_bucket, 
                                Key=obj['Key']
                            )
                            s3_metadata = metadata_response.get('Metadata', {})
                        except:
                            s3_metadata = {}
                        
                        documents.append({
                            'document_id': document_id,
                            'filename': filename,
                            's3_key': obj['Key'],
                            'upload_timestamp': obj['LastModified'].isoformat(),
                            'title': s3_metadata.get('title', filename),
                            'category': s3_metadata.get('category', 'general'),
                            'tags': s3_metadata.get('tags', '[]'),
                            'author': s3_metadata.get('author', 'unknown')
                        })
            
            return documents
            
        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            return []

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda handler for chat operations"""
    try:
        logger.info(f"Chat handler event: {json.dumps(event)}")
        logger.info(f"Lambda context: {context}")
        logger.info(f"Environment variables: {dict(os.environ)}")
        
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
        logger.info(f"Action: {action}")
        logger.info(f"Request body: {body}")
        
        logger.info("Creating ChatHandler instance...")
        handler = ChatHandler()
        logger.info("ChatHandler created successfully!")
        
        if action == 'chat':
            # Handle chat request
            chat_request = ChatRequest(**body)
            
            # Generate or use existing conversation ID
            conversation_id = chat_request.conversation_id or str(uuid.uuid4())
            
            # Generate response
            response_text = handler.generate_response(
                chat_request.message, 
                conversation_id, 
                chat_request.use_rag
            )
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'response': response_text,
                    'conversation_id': conversation_id,
                    'timestamp': datetime.utcnow().isoformat()
                })
            }
            
        elif action == 'get-upload-url':
            # Handle presigned URL generation
            presigned_request = PresignedUrlRequest(**body)
            
            result = handler.get_presigned_upload_url(presigned_request)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps(result)
            }
            
        elif action == 'list':
            # Handle document listing
            documents = handler.list_documents()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'documents': documents,
                    'count': len(documents)
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
        logger.error(f"Error in chat handler: {e}")
        logger.error(f"Exception type: {type(e).__name__}")
        logger.error(f"Exception args: {e.args}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
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
                'message': str(e),
                'exception_type': type(e).__name__,
                'traceback': traceback.format_exc()
            })
        }
