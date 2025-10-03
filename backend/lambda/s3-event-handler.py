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
    from config import CLAUDE_API_KEY, KNOWLEDGE_BASE_TABLE, DOCUMENTS_BUCKET, EMBEDDINGS_BUCKET
except ImportError:
    # Fallback values if config import fails
    CLAUDE_API_KEY = "sk-ant-api03-your-actual-claude-api-key-here"
    KNOWLEDGE_BASE_TABLE = "chatbot-knowledge-base"
    DOCUMENTS_BUCKET = "chatbot-documents"
    EMBEDDINGS_BUCKET = "chatbot-embeddings"

class DocumentChunk(BaseModel):
    content: str = Field(..., description="Chunk content")
    metadata: Dict[str, Any] = Field(default={}, description="Chunk metadata")
    embedding: List[float] = Field(default=[], description="Vector embedding")
    hierarchy_level: int = Field(default=0, description="Hierarchy level in document")
    chunk_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique chunk identifier")

class DocumentProcessor:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name='ap-south-1')
        self.dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
        self.documents_bucket = DOCUMENTS_BUCKET
        self.embeddings_bucket = EMBEDDINGS_BUCKET
        self.knowledge_base_table = self.dynamodb.Table(KNOWLEDGE_BASE_TABLE)
        
        # Initialize Anthropic client
        self.anthropic_client = Anthropic(api_key=CLAUDE_API_KEY)

    def get_claude_embedding(self, text: str) -> List[float]:
        """Get embedding from Claude API using Anthropic SDK"""
        try:
            # For now, return a simple hash-based embedding since Anthropic doesn't have embeddings API
            # In a real implementation, you'd use a proper embedding service
            import hashlib
            hash_obj = hashlib.md5(text.encode())
            hash_bytes = hash_obj.digest()
            # Convert to float array (simplified)
            embedding = [float(hash_bytes[i] % 100) / 100.0 for i in range(min(16, len(hash_bytes)))]
            return embedding
        except Exception as e:
            print(f"Error getting embedding: {e}")
            return []

    def process_document_from_s3(self, bucket: str, key: str) -> List[DocumentChunk]:
        """Process document from S3 and create chunks"""
        try:
            # Get the object from S3
            response = self.s3_client.get_object(Bucket=bucket, Key=key)
            content = response['Body'].read()
            
            # Get metadata from S3 object
            metadata_response = self.s3_client.head_object(Bucket=bucket, Key=key)
            s3_metadata = metadata_response.get('Metadata', {})
            
            # Extract filename from key
            filename = key.split('/')[-1]
            
            # Convert to text (simplified - in reality you'd handle different file types)
            text_content = content.decode('utf-8', errors='ignore')
            
            # Simple chunking by paragraphs or sentences
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
                if len(paragraph.strip()) < 30:  # Skip short paragraphs
                    continue
                    
                # Get embedding
                embedding = self.get_claude_embedding(paragraph)
                
                chunk = DocumentChunk(
                    content=paragraph.strip(),
                    metadata={
                        'source': filename,
                        's3_key': key,
                        's3_bucket': bucket,
                        'chunk_index': i,
                        'document_type': filename.split('.')[-1].lower(),
                        'processed_at': datetime.utcnow().isoformat(),
                        'document_id': s3_metadata.get('document_id', ''),
                        'original_filename': s3_metadata.get('original_filename', filename),
                        **{k: v for k, v in s3_metadata.items() if k not in ['document_id', 'original_filename', 'upload_timestamp']}
                    },
                    embedding=embedding,
                    hierarchy_level=self._determine_hierarchy_level(paragraph)
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
            print(f"Error processing document from S3: {e}")
            return []

    def _determine_hierarchy_level(self, text: str) -> int:
        """Determine hierarchy level based on text content"""
        text_lower = text.lower().strip()
        
        # Headers and titles
        if text_lower.startswith('#') or len(text) < 100:
            return 1
        # Subheaders
        elif text_lower.startswith('##') or 'section' in text_lower:
            return 2
        # Regular content
        else:
            return 3

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for S3 events"""
    try:
        print(f"S3 Event received: {json.dumps(event)}")
        
        processor = DocumentProcessor()
        
        # Process each record in the event
        for record in event.get('Records', []):
            if record.get('eventName') == 's3:ObjectCreated:Put':
                bucket = record['s3']['bucket']['name']
                key = record['s3']['object']['key']
                
                print(f"Processing new document: {bucket}/{key}")
                
                # Process the document
                chunks = processor.process_document_from_s3(bucket, key)
                
                print(f"Created {len(chunks)} chunks for document {key}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Document processing completed',
                'processed_records': len(event.get('Records', []))
            })
        }
        
    except Exception as e:
        print(f"Error processing S3 event: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Document processing failed',
                'message': str(e)
            })
        }
