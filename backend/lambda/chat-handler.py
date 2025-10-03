import json
import boto3
import os
import sys
from typing import Dict, Any, List
from pydantic import BaseModel, Field
from anthropic import Anthropic
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

# Pydantic models for request/response validation
class ChatMessage(BaseModel):
    message: str = Field(..., description="User's chat message")
    session_id: str = Field(..., description="Chat session identifier")
    user_id: str = Field(default="anonymous", description="User identifier")

class ChatResponse(BaseModel):
    response: str = Field(..., description="AI response message")
    session_id: str = Field(..., description="Chat session identifier")
    timestamp: str = Field(..., description="Response timestamp")
    sources: List[Dict[str, Any]] = Field(default=[], description="Source documents used for response")

class DocumentChunk(BaseModel):
    content: str = Field(..., description="Chunk content")
    metadata: Dict[str, Any] = Field(default={}, description="Chunk metadata")
    embedding: List[float] = Field(default=[], description="Vector embedding")
    hierarchy_level: int = Field(default=0, description="Hierarchy level in document")

class DoclingService:
    def __init__(self):
        self.s3_client = boto3.client('s3')
        self.dynamodb = boto3.resource('dynamodb')
        self.embeddings_bucket = EMBEDDINGS_BUCKET
        self.knowledge_base_table = self.dynamodb.Table(KNOWLEDGE_BASE_TABLE)
        self.conversations_table = self.dynamodb.Table(CONVERSATIONS_TABLE)
        
        # Initialize Anthropic client with API key from config
        self.anthropic_client = Anthropic(api_key=CLAUDE_API_KEY)

    def get_claude_response(self, messages: List[Dict[str, str]], context: str = "") -> str:
        """Get response from Claude API using Anthropic SDK"""
        try:
            # Prepare the system prompt with context
            system_prompt = f"""You are a helpful AI assistant with access to a knowledge base. 
            Use the following context to answer questions accurately and helpfully:
            
            Context: {context}
            
            If the context doesn't contain relevant information, say so and offer to help in other ways."""
            
            # Use the Anthropic SDK
            response = self.anthropic_client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=1000,
                system=system_prompt,
                messages=messages
            )
            
            return response.content[0].text
            
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
        
        chat_message = ChatMessage(**body)
        
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
            'body': json.dumps(chat_response.dict())
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

