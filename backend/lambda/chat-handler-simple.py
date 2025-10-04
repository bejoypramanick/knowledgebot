import json
import boto3
import os
import sys
from typing import Dict, Any, List
import requests
from datetime import datetime
import uuid

# Add the backend directory to the path to import config
sys.path.append('/opt/python')
sys.path.append('/var/task')
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from config import CLAUDE_API_KEY, KNOWLEDGE_BASE_TABLE, CONVERSATIONS_TABLE, EMBEDDINGS_BUCKET
except ImportError:
    # Fallback values if config import fails
    CLAUDE_API_KEY = "sk-ant-api03-your-actual-claude-api-key-here"
    KNOWLEDGE_BASE_TABLE = "chatbot-knowledge-base"
    CONVERSATIONS_TABLE = "chatbot-conversations"
    EMBEDDINGS_BUCKET = "chatbot-embeddings"

# Simple data classes instead of Pydantic
class ChatMessage:
    def __init__(self, message: str, session_id: str, user_id: str = "anonymous"):
        self.message = message
        self.session_id = session_id
        self.user_id = user_id

class ChatResponse:
    def __init__(self, response: str, session_id: str, timestamp: str, sources: List[Dict[str, Any]] = None):
        self.response = response
        self.session_id = session_id
        self.timestamp = timestamp
        self.sources = sources or []

    def to_dict(self):
        return {
            'response': self.response,
            'session_id': self.session_id,
            'timestamp': self.timestamp,
            'sources': self.sources
        }

class DocumentChunk:
    def __init__(self, content: str, metadata: Dict[str, Any] = None, hierarchy_level: int = 0):
        self.content = content
        self.metadata = metadata or {}
        self.hierarchy_level = hierarchy_level

class DoclingService:
    def __init__(self):
        self.s3_client = boto3.client('s3')
        self.dynamodb = boto3.resource('dynamodb')
        self.embeddings_bucket = EMBEDDINGS_BUCKET
        self.knowledge_base_table = self.dynamodb.Table(KNOWLEDGE_BASE_TABLE)
        self.conversations_table = self.dynamodb.Table(CONVERSATIONS_TABLE)
        
        # Use Claude API key from config
        self.claude_api_key = CLAUDE_API_KEY

    def get_claude_response(self, messages: List[Dict[str, str]], context: str = "") -> str:
        """Get response from Claude API"""
        if not self.claude_api_key or self.claude_api_key == "sk-ant-api03-your-actual-claude-api-key-here":
            return "I'm sorry, I'm unable to process your request at the moment. Please contact our support team at 1-800-TECH-HELP."
        
        headers = {
            "x-api-key": self.claude_api_key,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        }
        
        # Prepare the prompt with context
        system_prompt = f"""You are a helpful AI assistant with access to a knowledge base. 
        Use the following context to answer questions accurately and helpfully:
        
        Context: {context}
        
        If the context doesn't contain relevant information, say so and offer to help in other ways."""
        
        payload = {
            "model": "claude-sonnet-4-5-20250929",
            "max_tokens": 1000,
            "system": system_prompt,
            "messages": messages
        }
        
        try:
            response = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            return response.json()['content'][0]['text']
        except Exception as e:
            print(f"Error calling Claude API: {e}")
            return "Sorry, I encountered an error while processing your request."

    def search_knowledge_base(self, query: str, limit: int = 5) -> List[DocumentChunk]:
        """Search the knowledge base using semantic similarity"""
        try:
            # For now, we'll do a simple text search in DynamoDB
            # In a full implementation, you'd use vector similarity search
            response = self.knowledge_base_table.scan(
                FilterExpression="contains(content, :query)",
                ExpressionAttributeValues={":query": query}
            )
            
            chunks = []
            for item in response['Items']:
                chunk = DocumentChunk(
                    content=item.get('content', ''),
                    metadata=item.get('metadata', {}),
                    hierarchy_level=item.get('hierarchy_level', 0)
                )
                chunks.append(chunk)
            
            return chunks[:limit]
        except Exception as e:
            print(f"Error searching knowledge base: {e}")
            return []

    def save_conversation(self, session_id: str, user_message: str, ai_response: str):
        """Save conversation to DynamoDB"""
        try:
            self.conversations_table.put_item(
                Item={
                    'sessionId': session_id,
                    'timestamp': datetime.utcnow().isoformat(),
                    'user_message': user_message,
                    'ai_response': ai_response
                }
            )
        except Exception as e:
            print(f"Error saving conversation: {e}")

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda handler for chat requests"""
    try:
        # Parse the request
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        chat_message = ChatMessage(
            message=body.get('message', ''),
            session_id=body.get('session_id', ''),
            user_id=body.get('user_id', 'anonymous')
        )
        
        # Initialize Docling service
        docling_service = DoclingService()
        
        # Search knowledge base for relevant context
        relevant_chunks = docling_service.search_knowledge_base(chat_message.message)
        
        # Build context from relevant chunks
        context = "\n\n".join([
            f"Source: {chunk.metadata.get('source', 'Unknown')}\n{chunk.content}"
            for chunk in relevant_chunks
        ])
        
        # Prepare messages for Claude
        messages = [
            {
                "role": "user",
                "content": chat_message.message
            }
        ]
        
        # Get response from Claude
        ai_response = docling_service.get_claude_response(messages, context)
        
        # Save conversation
        docling_service.save_conversation(
            chat_message.session_id,
            chat_message.message,
            ai_response
        )
        
        # Prepare sources for response
        sources = [
            {
                "source": chunk.metadata.get('source', 'Unknown'),
                "relevance_score": 0.8,  # Placeholder
                "content_preview": chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content
            }
            for chunk in relevant_chunks
        ]
        
        # Create response
        chat_response = ChatResponse(
            response=ai_response,
            session_id=chat_message.session_id,
            timestamp=datetime.utcnow().isoformat(),
            sources=sources
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps(chat_response.to_dict())
        }
        
    except Exception as e:
        print(f"Error in chat handler: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }
