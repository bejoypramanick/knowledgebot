import json
import boto3
import os
from typing import Dict, Any, List
from anthropic import Anthropic
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Force rebuild trigger - response-enhancement Lambda deployment

# Configuration
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY')
CONVERSATIONS_TABLE = os.environ.get('CONVERSATIONS_TABLE', 'chatbot-conversations')

class ResponseEnhancementService:
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
        self.conversations_table = self.dynamodb.Table(CONVERSATIONS_TABLE)
        
        # Initialize Anthropic client
        try:
            logger.info(f"Initializing Anthropic client with API key: {CLAUDE_API_KEY[:10]}...")
            # Initialize with explicit parameters to avoid proxy issues (same as orchestrator)
            self.anthropic_client = Anthropic(
                api_key=CLAUDE_API_KEY,
                timeout=30.0
            )
            logger.info("Anthropic client initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing Anthropic client: {e}")
            logger.error(f"API key present: {bool(CLAUDE_API_KEY)}")
            logger.error(f"API key length: {len(CLAUDE_API_KEY) if CLAUDE_API_KEY else 0}")
            self.anthropic_client = None

    def get_conversation_history(self, conversation_id: str, limit: int = 10) -> List[Dict[str, Any]]:
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
                messages.append({
                    'role': item['role'],
                    'content': item['content'],
                    'timestamp': item['timestamp']
                })
            
            return messages
            
        except Exception as e:
            logger.error(f"Error getting conversation history: {e}")
            return []

    def extract_sources_from_action_results(self, action_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract sources from action results"""
        sources = []
        
        for action_type, result in action_results.items():
            if action_type == "search_rag" and isinstance(result, dict):
                rag_results = result.get("result", {}).get("results", [])
                for rag_result in rag_results:
                    if isinstance(rag_result, dict):
                        source = {
                            "chunk_id": rag_result.get("chunk_id", ""),
                            "document_id": rag_result.get("metadata", {}).get("document_id", ""),
                            "source": rag_result.get("metadata", {}).get("source", ""),
                            "s3_key": rag_result.get("metadata", {}).get("s3_key", ""),
                            "original_filename": rag_result.get("metadata", {}).get("original_filename", ""),
                            "page_number": rag_result.get("metadata", {}).get("page_number", 0),
                            "element_type": rag_result.get("metadata", {}).get("element_type", "text"),
                            "hierarchy_level": rag_result.get("hierarchy_level", 0),
                            "similarity_score": rag_result.get("similarity_score", 0.0),
                            "content": rag_result.get("content", ""),
                            "metadata": rag_result.get("metadata", {})
                        }
                        sources.append(source)
        
        return sources

    def enhance_response(self, user_message: str, action_results: Dict[str, Any], conversation_id: str, action_plan: Dict[str, Any] = None) -> Dict[str, Any]:
        """Enhance response using Claude with action results and sources"""
        try:
            logger.info("=" * 30)
            logger.info("RESPONSE_ENHANCEMENT STARTED")
            logger.info(f"User message: '{user_message}'")
            logger.info(f"Conversation ID: '{conversation_id}'")
            logger.info(f"Action results keys: {list(action_results.keys()) if action_results else 'None'}")
            logger.info(f"Action plan: {action_plan}")
            logger.info(f"Anthropic client initialized: {bool(self.anthropic_client)}")
            
            if not self.anthropic_client:
                logger.error("Anthropic client not initialized - returning error response")
                return {
                    "response": "I'm sorry, I'm unable to process your request at the moment.",
                    "sources": []
                }
            
            # Get conversation history
            history = self.get_conversation_history(conversation_id)
            conversation_context = ""
            if history:
                conversation_context = "\n\nPrevious conversation:\n"
                for msg in history[-3:]:
                    conversation_context += f"{msg['role']}: {msg['content']}\n"
            
            # Build context from action results
            results_context = ""
            if action_results:
                results_context = "\n\nBackend Action Results:\n"
                for action_type, result in action_results.items():
                    results_context += f"\n{action_type.upper()}:\n"
                    results_context += f"{json.dumps(result, indent=2)}\n"
            
            # Build context about questions and action plan
            questions_context = ""
            if action_plan and action_plan.get('questions_identified'):
                questions_context = f"\n\nQuestions identified in the query:\n"
                for i, question in enumerate(action_plan['questions_identified'], 1):
                    questions_context += f"{i}. {question}\n"
            
            # Extract sources
            sources = self.extract_sources_from_action_results(action_results)
            
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
            logger.info(f"Claude enhanced response generated with {len(sources)} sources")
            
            return {
                "response": enhanced_response,
                "sources": sources
            }
            
        except Exception as e:
            logger.error(f"Error in response enhancement: {e}")
            return {
                "response": f"I apologize, but I encountered an error while processing your request: {str(e)}",
                "sources": []
            }

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for response enhancement"""
    try:
        logger.info(f"Response Enhancement event: {json.dumps(event)}")
        
        # Handle direct API calls
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        action = body.get('action', '')
        logger.info(f"Action: {action}")
        
        enhancement_service = ResponseEnhancementService()
        
        if action == 'enhance_response':
            user_message = body.get('user_message', '')
            action_results = body.get('action_results', {})
            conversation_id = body.get('conversation_id', '')
            action_plan = body.get('action_plan', {})
            
            logger.info(f"Enhancing response for: {user_message[:100]}...")
            
            try:
                result = enhancement_service.enhance_response(
                    user_message, 
                    action_results, 
                    conversation_id, 
                    action_plan
                )
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps(result)
                }
            except Exception as e:
                logger.error(f"Error enhancing response: {e}")
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Failed to enhance response',
                        'message': str(e)
                    })
                }
        
        else:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'error': 'Invalid action',
                    'message': f'Action "{action}" not supported'
                })
            }
        
    except Exception as e:
        logger.error(f"Error in response enhancement: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': 'Response enhancement failed',
                'message': str(e)
            })
        }
