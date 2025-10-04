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
DOCUMENTS_BUCKET = os.environ.get('DOCUMENTS_BUCKET', 'chatbot-documents-ap-south-1')
EMBEDDINGS_BUCKET = os.environ.get('EMBEDDINGS_BUCKET', 'chatbot-embeddings-ap-south-1')
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

class ChatHandler:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name='ap-south-1')
        self.dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
        self.lambda_client = boto3.client('lambda', region_name='ap-south-1')
        
        self.documents_bucket = DOCUMENTS_BUCKET
        self.embeddings_bucket = EMBEDDINGS_BUCKET
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
                    'Bucket': self.documents_bucket,
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

    def generate_response(self, user_message: str, conversation_id: str, use_rag: bool = True) -> str:
        """Generate AI response using Claude with optional RAG context"""
        try:
            # Check if Anthropic client is available
            if not self.anthropic_client:
                logger.error("Anthropic client not initialized")
                return "I'm sorry, I'm unable to process your request at the moment. Please contact our support team at 1-800-TECH-HELP."
            
            # Get conversation history
            history = self.get_conversation_history(conversation_id)
            
            # Build context from RAG if enabled
            rag_context = ""
            if use_rag:
                rag_results = self.search_rag_context(user_message, limit=3)
                if rag_results:
                    rag_context = "\n\nRelevant context from knowledge base:\n"
                    for i, result in enumerate(rag_results, 1):
                        rag_context += f"{i}. {result['content']}\n"
                        if result.get('metadata', {}).get('source'):
                            rag_context += f"   Source: {result['metadata']['source']}\n"
            
            # Build conversation context
            conversation_context = ""
            if history:
                conversation_context = "\n\nPrevious conversation:\n"
                for msg in history[-5:]:  # Last 5 messages
                    conversation_context += f"{msg.role}: {msg.content}\n"
            
            # Create system prompt
            system_prompt = f"""You are a helpful AI assistant with access to a knowledge base. 
            {rag_context}
            {conversation_context}
            
            Please provide a helpful response based on the user's question and the available context. 
            If you reference information from the knowledge base, please cite the source when possible."""
            
            # Prepare messages for Claude
            messages = [{"role": "user", "content": f"{system_prompt}\n\nUser: {user_message}"}]
            
            # Generate response using Claude with error handling
            try:
                response = self.anthropic_client.messages.create(
                    model="claude-sonnet-4-5-20250929",
                    max_tokens=1000,
                    messages=messages
                )
                assistant_message = response.content[0].text
            except Exception as claude_error:
                logger.error(f"Claude API error: {claude_error}")
                assistant_message = "I'm sorry, I'm having trouble processing your request right now. Please try again later."
            
            # Save both user and assistant messages
            self.save_message(conversation_id, ChatMessage(role="user", content=user_message))
            self.save_message(conversation_id, ChatMessage(role="assistant", content=assistant_message))
            
            return assistant_message
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return f"I apologize, but I encountered an error while processing your request: {str(e)}"

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
                    'Access-Control-Allow-Headers': 'Content-Type',
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
                    'Access-Control-Allow-Headers': 'Content-Type',
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
                    'Access-Control-Allow-Headers': 'Content-Type',
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
                    'Access-Control-Allow-Headers': 'Content-Type',
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
