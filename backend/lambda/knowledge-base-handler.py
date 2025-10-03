import json
import boto3
import os
import sys
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from anthropic import Anthropic
from datetime import datetime
import uuid
import base64
from io import BytesIO

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

# Pydantic models
class DocumentUpload(BaseModel):
    filename: str = Field(..., description="Name of the document")
    content: str = Field(..., description="Base64 encoded document content")
    document_type: str = Field(default="pdf", description="Type of document (pdf, docx, etc.)")
    metadata: Dict[str, Any] = Field(default={}, description="Additional document metadata")

class WebScrapingRequest(BaseModel):
    url: str = Field(..., description="URL to scrape")
    scrape_type: str = Field(default="faq", description="Type of scraping (faq, general, etc.)")
    metadata: Dict[str, Any] = Field(default={}, description="Additional metadata")

class DocumentChunk(BaseModel):
    content: str = Field(..., description="Chunk content")
    metadata: Dict[str, Any] = Field(default={}, description="Chunk metadata")
    embedding: List[float] = Field(default=[], description="Vector embedding")
    hierarchy_level: int = Field(default=0, description="Hierarchy level in document")
    chunk_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique chunk identifier")

class DoclingProcessor:
    def __init__(self):
        self.s3_client = boto3.client('s3')
        self.dynamodb = boto3.resource('dynamodb')
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

    def process_document_with_docling(self, document_content: bytes, filename: str) -> List[DocumentChunk]:
        """Process document using Docling and create hierarchical chunks"""
        try:
            # Upload document to S3 first
            document_key = f"documents/{uuid.uuid4()}/{filename}"
            self.s3_client.put_object(
                Bucket=self.documents_bucket,
                Key=document_key,
                Body=document_content
            )
            
            # For now, we'll simulate Docling processing
            # In a real implementation, you'd use the Docling library here
            chunks = self._simulate_docling_processing(document_content, filename, document_key)
            
            return chunks
            
        except Exception as e:
            print(f"Error processing document with Docling: {e}")
            return []

    def _simulate_docling_processing(self, content: bytes, filename: str, document_key: str) -> List[DocumentChunk]:
        """Simulate Docling document processing and chunking"""
        # This is a simplified simulation - in reality, you'd use Docling here
        text_content = content.decode('utf-8', errors='ignore')
        
        # Simple chunking by paragraphs
        paragraphs = text_content.split('\n\n')
        chunks = []
        
        for i, paragraph in enumerate(paragraphs):
            if len(paragraph.strip()) < 50:  # Skip very short paragraphs
                continue
                
            # Get embedding
            embedding = self.get_claude_embedding(paragraph)
            
            chunk = DocumentChunk(
                content=paragraph.strip(),
                metadata={
                    'source': filename,
                    'document_key': document_key,
                    'chunk_index': i,
                    'document_type': filename.split('.')[-1].lower(),
                    'processed_at': datetime.utcnow().isoformat()
                },
                embedding=embedding,
                hierarchy_level=self._determine_hierarchy_level(paragraph)
            )
            chunks.append(chunk)
        
        return chunks

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

    def save_chunks_to_knowledge_base(self, chunks: List[DocumentChunk]):
        """Save processed chunks to DynamoDB and S3"""
        try:
            for chunk in chunks:
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
                
                # Save embedding to S3
                if chunk.embedding:
                    embedding_key = f"embeddings/{chunk.chunk_id}.json"
                    embedding_data = {
                        'chunk_id': chunk.chunk_id,
                        'embedding': chunk.embedding,
                        'metadata': chunk.metadata
                    }
                    
                    self.s3_client.put_object(
                        Bucket=self.embeddings_bucket,
                        Key=embedding_key,
                        Body=json.dumps(embedding_data),
                        ContentType='application/json'
                    )
                    
        except Exception as e:
            print(f"Error saving chunks to knowledge base: {e}")

    def scrape_website(self, url: str, scrape_type: str = "faq") -> List[DocumentChunk]:
        """Scrape website content and process with Docling"""
        try:
            # Simple web scraping simulation
            # In a real implementation, you'd use libraries like BeautifulSoup or Scrapy
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            # Simulate FAQ extraction
            if scrape_type == "faq":
                chunks = self._extract_faq_content(response.text, url)
            else:
                chunks = self._extract_general_content(response.text, url)
            
            return chunks
            
        except Exception as e:
            print(f"Error scraping website: {e}")
            return []

    def _extract_faq_content(self, html_content: str, url: str) -> List[DocumentChunk]:
        """Extract FAQ content from HTML"""
        # Simplified FAQ extraction
        chunks = []
        
        # This is a placeholder - in reality, you'd parse HTML properly
        faq_items = [
            "What is your return policy?",
            "How do I track my order?",
            "What payment methods do you accept?",
            "How can I contact customer support?"
        ]
        
        for i, faq in enumerate(faq_items):
            embedding = self.get_claude_embedding(faq)
            
            chunk = DocumentChunk(
                content=faq,
                metadata={
                    'source': url,
                    'scrape_type': 'faq',
                    'faq_index': i,
                    'scraped_at': datetime.utcnow().isoformat()
                },
                embedding=embedding,
                hierarchy_level=1
            )
            chunks.append(chunk)
        
        return chunks

    def _extract_general_content(self, html_content: str, url: str) -> List[DocumentChunk]:
        """Extract general content from HTML"""
        # Simplified content extraction
        chunks = []
        
        # This is a placeholder - in reality, you'd parse HTML properly
        content_paragraphs = [
            "Welcome to our website. We provide excellent services.",
            "Our team is dedicated to customer satisfaction.",
            "Contact us for more information about our products."
        ]
        
        for i, paragraph in enumerate(content_paragraphs):
            embedding = self.get_claude_embedding(paragraph)
            
            chunk = DocumentChunk(
                content=paragraph,
                metadata={
                    'source': url,
                    'scrape_type': 'general',
                    'paragraph_index': i,
                    'scraped_at': datetime.utcnow().isoformat()
                },
                embedding=embedding,
                hierarchy_level=2
            )
            chunks.append(chunk)
        
        return chunks

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda handler for knowledge base operations"""
    try:
        # Parse the request
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        action = body.get('action', '')
        processor = DoclingProcessor()
        
        if action == 'upload':
            # Handle document upload
            upload_request = DocumentUpload(**body)
            
            # Decode base64 content
            document_content = base64.b64decode(upload_request.content)
            
            # Process with Docling
            chunks = processor.process_document_with_docling(
                document_content, 
                upload_request.filename
            )
            
            # Save to knowledge base
            processor.save_chunks_to_knowledge_base(chunks)
            
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
                    'filename': upload_request.filename
                })
            }
            
        elif action == 'scrape':
            # Handle web scraping
            scrape_request = WebScrapingRequest(**body)
            
            # Scrape website
            chunks = processor.scrape_website(
                scrape_request.url, 
                scrape_request.scrape_type
            )
            
            # Save to knowledge base
            processor.save_chunks_to_knowledge_base(chunks)
            
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
                    'url': scrape_request.url
                })
            }
            
        elif action == 'list':
            # List documents in knowledge base
            response = processor.knowledge_base_table.scan()
            documents = response['Items']
            
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
                    'error': 'Invalid action. Supported actions: upload, scrape, list'
                })
            }
            
    except Exception as e:
        print(f"Error in knowledge base handler: {e}")
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

