import json
import boto3
import os
import sys
from typing import Dict, Any, List
from pydantic import BaseModel, Field
from anthropic import Anthropic
from datetime import datetime
import uuid
from decimal import Decimal

# Custom JSON encoder to handle Decimal types from DynamoDB
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

# Add the backend directory to the path to import config
sys.path.append('/opt/python')
sys.path.append('/var/task')
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from config import CLAUDE_API_KEY, KNOWLEDGE_BASE_TABLE, CONVERSATIONS_TABLE, EMBEDDINGS_BUCKET, DOCUMENTS_BUCKET
except ImportError:
    # Fallback values if config import fails
    CLAUDE_API_KEY = "sk-ant-api03-your-actual-claude-api-key-here"
    KNOWLEDGE_BASE_TABLE = "chatbot-knowledge-base"
    CONVERSATIONS_TABLE = "chatbot-conversations"
    EMBEDDINGS_BUCKET = "chatbot-embeddings"
    DOCUMENTS_BUCKET = "chatbot-documents"

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

    def process_document_simple(self, content: bytes, filename: str, metadata: Dict[str, Any]) -> List[DocumentChunk]:
        """Simple document processing for uploads"""
        try:
            # Convert to text (simplified)
            text_content = content.decode('utf-8', errors='ignore')
            
            # Simple chunking by paragraphs or sentences
            # First try splitting by double newlines, then by single newlines, then by sentences
            if '\n\n' in text_content:
                paragraphs = text_content.split('\n\n')
            elif '\n' in text_content:
                paragraphs = text_content.split('\n')
            else:
                # Split by sentences (simple approach)
                paragraphs = text_content.split('. ')
                paragraphs = [p + '.' if not p.endswith('.') else p for p in paragraphs]
            
            chunks = []
            
            for i, paragraph in enumerate(paragraphs):
                if len(paragraph.strip()) < 30:  # Reduced minimum length
                    continue
                    
                chunk = DocumentChunk(
                    content=paragraph.strip(),
                    metadata={
                        'source': filename,
                        'chunk_index': i,
                        'document_type': filename.split('.')[-1].lower(),
                        'processed_at': datetime.utcnow().isoformat(),
                        **metadata
                    },
                    embedding=[]  # Simplified for now
                )
                chunks.append(chunk)
                
                # Save to DynamoDB
                self.knowledge_base_table.put_item(
                    Item={
                        'chunk_id': chunk.chunk_id,
                        'content': chunk.content,
                        'metadata': chunk.metadata,
                        'hierarchy_level': chunk.hierarchy_level,
                        'created_at': datetime.utcnow().isoformat()
                    }
                )
            
            return chunks
        except Exception as e:
            print(f"Error processing document: {e}")
            return []

    def scrape_website_simple(self, url: str, scrape_type: str, metadata: Dict[str, Any]) -> List[DocumentChunk]:
        """Simple website scraping"""
        try:
            # Simplified scraping - in reality you'd use requests + BeautifulSoup
            chunks = []
            
            # Mock content for now
            mock_content = [
                f"Content from {url} - {scrape_type}",
                f"Additional information about {scrape_type}",
                f"More details from {url}"
            ]
            
            for i, content in enumerate(mock_content):
                chunk = DocumentChunk(
                    content=content,
                    metadata={
                        'source': url,
                        'scrape_type': scrape_type,
                        'chunk_index': i,
                        'scraped_at': datetime.utcnow().isoformat(),
                        **metadata
                    },
                    embedding=[]
                )
                chunks.append(chunk)
                
                # Save to DynamoDB
                self.knowledge_base_table.put_item(
                    Item={
                        'chunk_id': chunk.chunk_id,
                        'content': chunk.content,
                        'metadata': chunk.metadata,
                        'hierarchy_level': chunk.hierarchy_level,
                        'created_at': datetime.utcnow().isoformat()
                    }
                )
            
            return chunks
        except Exception as e:
            print(f"Error scraping website: {e}")
            return []

def handle_document_upload(body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle document upload requests"""
    try:
        import base64
        
        # Extract upload data
        filename = body.get('filename', '')
        content = body.get('content', '')
        document_type = body.get('document_type', 'txt')
        metadata = body.get('metadata', {})
        
        # Decode base64 content
        document_content = base64.b64decode(content)
        
        # Initialize service
        docling_service = DoclingService()
        
        # Process document
        chunks = docling_service.process_document_simple(document_content, filename, metadata)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'message': 'Document processed successfully',
                'chunks_created': len(chunks),
                'filename': filename
            })
        }
    except Exception as e:
        print(f"Error in document upload: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Document upload failed',
                'message': str(e)
            })
        }

def handle_web_scraping(body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle web scraping requests"""
    try:
        url = body.get('url', '')
        scrape_type = body.get('scrape_type', 'general')
        metadata = body.get('metadata', {})
        
        # Initialize service
        docling_service = DoclingService()
        
        # Scrape website
        chunks = docling_service.scrape_website_simple(url, scrape_type, metadata)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'message': 'Website scraped successfully',
                'chunks_created': len(chunks),
                'url': url
            })
        }
    except Exception as e:
        print(f"Error in web scraping: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Web scraping failed',
                'message': str(e)
            })
        }

def handle_document_listing() -> Dict[str, Any]:
    """Handle document listing requests"""
    try:
        # Initialize service
        docling_service = DoclingService()
        
        # Get documents from DynamoDB
        response = docling_service.knowledge_base_table.scan()
        documents = response.get('Items', [])
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'documents': documents,
                'count': len(documents)
            }, cls=DecimalEncoder)
        }
    except Exception as e:
        print(f"Error in document listing: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Document listing failed',
                'message': str(e)
            })
        }

def handle_presigned_url_generation(body: Dict[str, Any]) -> Dict[str, Any]:
    """Handle presigned URL generation for S3 uploads"""
    try:
        filename = body.get('filename', '')
        content_type = body.get('content_type', 'application/octet-stream')
        metadata = body.get('metadata', {})
        
        # Generate unique key for the document
        import uuid
        document_id = str(uuid.uuid4())
        file_extension = filename.split('.')[-1] if '.' in filename else 'txt'
        s3_key = f"documents/{document_id}/{filename}"
        
        # Initialize S3 client
        s3_client = boto3.client('s3')
        
        # Generate presigned URL for PUT request
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': DOCUMENTS_BUCKET,
                'Key': s3_key,
                'ContentType': content_type,
                'Metadata': {
                    'document_id': document_id,
                    'original_filename': filename,
                    'upload_timestamp': datetime.utcnow().isoformat(),
                    **{k: str(v) for k, v in metadata.items()}
                }
            },
            ExpiresIn=3600  # 1 hour
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'presigned_url': presigned_url,
                'document_id': document_id,
                's3_key': s3_key,
                'bucket': DOCUMENTS_BUCKET
            }, cls=DecimalEncoder)
        }
    except Exception as e:
        print(f"Error generating presigned URL: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Failed to generate presigned URL',
                'message': str(e)
            })
        }

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda handler for chat and knowledge base requests"""
    try:
        # Parse the request
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        # Check if this is a knowledge base request
        action = body.get('action', '')
        
        if action == 'upload':
            return handle_document_upload(body)
        elif action == 'scrape':
            return handle_web_scraping(body)
        elif action == 'list':
            return handle_document_listing()
        elif action == 'get-upload-url':
            return handle_presigned_url_generation(body)
        else:
            # Handle chat request
            try:
                chat_message = ChatMessage(**body)
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Invalid request format',
                        'message': str(e)
                    })
                }
            
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

