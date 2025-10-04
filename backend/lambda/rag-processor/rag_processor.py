import json
import boto3
import os
import tempfile
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from anthropic import Anthropic
from datetime import datetime
import uuid
import base64
from io import BytesIO
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Trigger workflow - S3 notification permissions added manually

# Configuration
DOCUMENTS_BUCKET = os.environ.get('DOCUMENTS_BUCKET', 'chatbot-documents-ap-south-1')
EMBEDDINGS_BUCKET = os.environ.get('EMBEDDINGS_BUCKET', 'chatbot-embeddings-ap-south-1')
KNOWLEDGE_BASE_TABLE = os.environ.get('KNOWLEDGE_BASE_TABLE', 'chatbot-knowledge-base')
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY', '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')

# Pydantic models
class DocumentChunk(BaseModel):
    content: str = Field(..., description="Chunk content")
    metadata: Dict[str, Any] = Field(default={}, description="Chunk metadata")
    embedding: List[float] = Field(default=[], description="Vector embedding")
    hierarchy_level: int = Field(default=0, description="Hierarchy level in document")
    chunk_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique chunk identifier")
    parent_id: Optional[str] = Field(default=None, description="Parent chunk ID for hierarchical structure")

class RAGProcessor:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name='ap-south-1')
        self.dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
        self.documents_bucket = DOCUMENTS_BUCKET
        self.embeddings_bucket = EMBEDDINGS_BUCKET
        self.knowledge_base_table = self.dynamodb.Table(KNOWLEDGE_BASE_TABLE)
        
        # Initialize Anthropic client with explicit configuration
        try:
            self.anthropic_client = Anthropic(
                api_key=CLAUDE_API_KEY
            )
        except Exception as e:
            logger.error(f"Error initializing Anthropic client: {e}")
            self.anthropic_client = None
        
        # Initialize Docling converter
        self.converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfPipelineOptions(
                    do_ocr=True,
                    do_table_structure=True,
                    table_structure_options={"do_cell_matching": True}
                )
            }
        )
        
        # Docling-focused RAG processor

    def get_docling_embedding(self, text: str) -> List[float]:
        """Get embedding using a simple text-based approach"""
        try:
            # For now, use a simple text-based embedding approach
            # In production, you'd integrate with a proper embedding service like OpenAI or Cohere
            import hashlib
            import numpy as np
            
            # Create a more sophisticated text-based embedding
            # This is a placeholder - in production, use a real embedding model
            text_lower = text.lower()
            
            # Create features based on text characteristics
            features = []
            
            # Text length features
            features.append(len(text))
            features.append(len(text.split()))
            
            # Character frequency features
            char_counts = {}
            for char in text_lower:
                char_counts[char] = char_counts.get(char, 0) + 1
            
            # Add top character frequencies
            sorted_chars = sorted(char_counts.items(), key=lambda x: x[1], reverse=True)
            for i in range(10):
                if i < len(sorted_chars):
                    features.append(sorted_chars[i][1])
                else:
                    features.append(0)
            
            # Word frequency features
            words = text_lower.split()
            word_counts = {}
            for word in words:
                word_counts[word] = word_counts.get(word, 0) + 1
            
            # Add top word frequencies
            sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
            for i in range(10):
                if i < len(sorted_words):
                    features.append(sorted_words[i][1])
                else:
                    features.append(0)
            
            # Create a 384-dimensional embedding by repeating and scaling features
            embedding = []
            for i in range(384):
                feature_idx = i % len(features)
                # Normalize and scale the feature
                normalized_feature = features[feature_idx] / max(1, len(text))
                embedding.append(float(normalized_feature * 2 - 1))  # Scale to [-1, 1]
            
            return embedding
            
        except Exception as e:
            logger.error(f"Error getting Docling embedding: {e}")
            # Fallback to zero embedding
            return [0.0] * 384

    def process_document_with_docling(self, s3_bucket: str, s3_key: str) -> List[DocumentChunk]:
        """Process document using Docling and create hierarchical chunks"""
        try:
            logger.info(f"Processing document: {s3_bucket}/{s3_key}")
            
            # Download document from S3
            response = self.s3_client.get_object(Bucket=s3_bucket, Key=s3_key)
            document_content = response['Body'].read()
            
            # Get metadata from S3 object
            metadata_response = self.s3_client.head_object(Bucket=s3_bucket, Key=s3_key)
            s3_metadata = metadata_response.get('Metadata', {})
            
            # Save to temporary file for Docling processing
            with tempfile.NamedTemporaryFile(suffix=f".{s3_key.split('.')[-1]}", delete=False) as temp_file:
                temp_file.write(document_content)
                temp_file_path = temp_file.name
            
            try:
                # Process with Docling
                doc = self.converter.convert(temp_file_path)
                
                # Extract hierarchical chunks
                chunks = self._extract_hierarchical_chunks(doc, s3_key, s3_metadata)
                
                logger.info(f"Created {len(chunks)} hierarchical chunks")
                return chunks
                
            finally:
                # Clean up temporary file
                os.unlink(temp_file_path)
                
        except Exception as e:
            logger.error(f"Error processing document with Docling: {e}")
            return []

    def _extract_hierarchical_chunks(self, doc, s3_key: str, s3_metadata: Dict[str, Any]) -> List[DocumentChunk]:
        """Extract hierarchical chunks from Docling document"""
        chunks = []
        document_id = s3_metadata.get('document_id', str(uuid.uuid4()))
        filename = s3_key.split('/')[-1]
        
        # Process document structure
        for page_idx, page in enumerate(doc.pages):
            for element in page.elements:
                chunk = self._create_chunk_from_element(
                    element, 
                    document_id, 
                    filename, 
                    s3_key, 
                    s3_metadata,
                    page_idx
                )
                if chunk:
                    chunks.append(chunk)
        
        # Create parent-child relationships
        chunks = self._establish_hierarchy(chunks)
        
        return chunks

    def _create_chunk_from_element(self, element, document_id: str, filename: str, s3_key: str, s3_metadata: Dict[str, Any], page_idx: int) -> Optional[DocumentChunk]:
        """Create a chunk from a Docling element"""
        try:
            # Extract text content
            content = element.text.strip() if hasattr(element, 'text') else str(element)
            
            if len(content) < 10:  # Skip very short content
                return None
            
            # Determine hierarchy level based on element type
            hierarchy_level = self._determine_hierarchy_level(element, content)
            
            # Get embedding using Docling
            embedding = self.get_docling_embedding(content)
            
            # Create chunk with embedding
            chunk = DocumentChunk(
                content=content,
                metadata={
                    'document_id': document_id,
                    'source': filename,
                    's3_key': s3_key,
                    's3_bucket': self.documents_bucket,
                    'page_number': page_idx + 1,
                    'element_type': type(element).__name__,
                    'processed_at': datetime.utcnow().isoformat(),
                    'original_filename': s3_metadata.get('original_filename', filename),
                    **{k: v for k, v in s3_metadata.items() if k not in ['document_id', 'original_filename', 'upload_timestamp']}
                },
                embedding=embedding,
                hierarchy_level=hierarchy_level
            )
            
            return chunk
            
        except Exception as e:
            logger.error(f"Error creating chunk from element: {e}")
            return None

    def _determine_hierarchy_level(self, element, content: str) -> int:
        """Determine hierarchy level based on element type and content"""
        content_lower = content.lower().strip()
        
        # Check element type for hierarchy clues
        element_type = type(element).__name__.lower()
        
        if 'title' in element_type or 'heading' in element_type:
            return 1
        elif 'subtitle' in element_type or 'subheading' in element_type:
            return 2
        elif 'table' in element_type:
            return 3
        elif 'figure' in element_type or 'image' in element_type:
            return 4
        else:
            # Fallback to content-based analysis
            if len(content) < 100 and (content_lower.startswith('#') or content.isupper()):
                return 1
            elif 'section' in content_lower or 'chapter' in content_lower:
                return 2
            else:
                return 3

    def _establish_hierarchy(self, chunks: List[DocumentChunk]) -> List[DocumentChunk]:
        """Establish parent-child relationships between chunks"""
        # Sort chunks by hierarchy level and position
        chunks.sort(key=lambda x: (x.hierarchy_level, x.metadata.get('page_number', 0)))
        
        # Establish parent-child relationships
        for i, chunk in enumerate(chunks):
            if chunk.hierarchy_level > 1:
                # Find the most recent parent chunk
                for j in range(i-1, -1, -1):
                    if chunks[j].hierarchy_level < chunk.hierarchy_level:
                        chunk.parent_id = chunks[j].chunk_id
                        break
        
        return chunks

    def save_chunks_to_knowledge_base(self, chunks: List[DocumentChunk]):
        """Save processed chunks to DynamoDB and embeddings to S3"""
        try:
            for chunk in chunks:
                # Save text chunk to DynamoDB
                self.knowledge_base_table.put_item(
                    Item={
                        'chunk_id': chunk.chunk_id,
                        'document_id': chunk.metadata.get('document_id', ''),
                        'content': chunk.content,
                        'metadata': chunk.metadata,
                        'hierarchy_level': chunk.hierarchy_level,
                        'parent_id': chunk.parent_id,
                        'created_at': datetime.utcnow().isoformat()
                    }
                )
                
                # Save embedding to S3
                if chunk.embedding:
                    embedding_key = f"embeddings/{chunk.chunk_id}.json"
                    embedding_data = {
                        'chunk_id': chunk.chunk_id,
                        'document_id': chunk.metadata.get('document_id', ''),
                        'embedding': chunk.embedding,
                        'metadata': chunk.metadata,
                        'hierarchy_level': chunk.hierarchy_level,
                        'parent_id': chunk.parent_id
                    }
                    
                    self.s3_client.put_object(
                        Bucket=self.embeddings_bucket,
                        Key=embedding_key,
                        Body=json.dumps(embedding_data),
                        ContentType='application/json'
                    )
            
            logger.info(f"Saved {len(chunks)} chunks to DynamoDB and embeddings to S3")
                    
        except Exception as e:
            logger.error(f"Error saving chunks to knowledge base: {e}")

    def search_similar_chunks(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search for similar chunks using Docling embeddings"""
        try:
            # Use Docling embedding-based search
            return self._search_docling_embeddings(query, limit)
            
        except Exception as e:
            logger.error(f"Error searching similar chunks with Docling: {e}")
            return []

    def _search_docling_embeddings(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Search using Docling embeddings for vector similarity"""
        try:
            # Get query embedding using Docling
            query_embedding = self.get_docling_embedding(query)
            if not query_embedding:
                logger.error("Docling could not generate query embedding")
                return []
            
            # Get all chunk IDs from DynamoDB
            response = self.knowledge_base_table.scan()
            if 'Items' not in response or not response['Items']:
                logger.info("No chunks found in knowledge base")
                return []
            
            # Calculate similarities and collect results
            similar_chunks = []
            
            for item in response['Items']:
                chunk_id = item.get('chunk_id')
                if not chunk_id:
                    continue
                
                try:
                    # Get embedding from S3
                    embedding_key = f"embeddings/{chunk_id}.json"
                    embedding_response = self.s3_client.get_object(
                        Bucket=self.embeddings_bucket,
                        Key=embedding_key
                    )
                    embedding_data = json.loads(embedding_response['Body'].read())
                    chunk_embedding = embedding_data.get('embedding', [])
                    
                    if not chunk_embedding:
                        continue
                    
                    # Calculate cosine similarity
                    similarity = self._cosine_similarity(query_embedding, chunk_embedding)
                    
                    # Add to results
                    chunk_data = {
                        'chunk_id': chunk_id,
                        'content': item.get('content', ''),
                        'metadata': {
                            'source': item.get('metadata', {}).get('source', 'Unknown'),
                            'document_id': item.get('document_id', ''),
                            's3_key': item.get('metadata', {}).get('s3_key', ''),
                            's3_bucket': self.documents_bucket,
                            'page_number': item.get('metadata', {}).get('page_number', 0),
                            'element_type': item.get('metadata', {}).get('element_type', 'text')
                        },
                        'hierarchy_level': item.get('hierarchy_level', 0),
                        'parent_id': item.get('parent_id'),
                        'similarity_score': similarity
                    }
                    similar_chunks.append(chunk_data)
                    
                except Exception as e:
                    logger.warning(f"Could not retrieve Docling embedding for chunk {chunk_id}: {e}")
                    continue
            
            # Sort by similarity score and return top results
            similar_chunks.sort(key=lambda x: x['similarity_score'], reverse=True)
            logger.info(f"Docling found {len(similar_chunks)} chunks, returning top {limit}")
            return similar_chunks[:limit]
            
        except Exception as e:
            logger.error(f"Error in Docling embedding search: {e}")
            return []

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            import numpy as np
            
            # Convert to numpy arrays
            a = np.array(vec1)
            b = np.array(vec2)
            
            # Calculate cosine similarity
            dot_product = np.dot(a, b)
            norm_a = np.linalg.norm(a)
            norm_b = np.linalg.norm(b)
            
            if norm_a == 0 or norm_b == 0:
                return 0.0
            
            similarity = dot_product / (norm_a * norm_b)
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error calculating cosine similarity: {e}")
            return 0.0

    def _determine_hierarchy_level_from_docling(self, docling_result: Dict[str, Any]) -> int:
        """Determine hierarchy level from Docling search result"""
        element_type = docling_result.get('element_type', '').lower()
        
        if 'title' in element_type or 'heading' in element_type:
            return 1
        elif 'subtitle' in element_type or 'subheading' in element_type:
            return 2
        elif 'table' in element_type:
            return 3
        elif 'figure' in element_type or 'image' in element_type:
            return 4
        else:
            return 3


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for RAG processing and direct Docling search"""
    try:
        logger.info(f"RAG Processor event: {json.dumps(event)}")
        
        processor = RAGProcessor()
        
        # Handle S3 event
        if 'Records' in event:
            # Process S3 upload events
            for record in event.get('Records', []):
                if record.get('eventName') == 's3:ObjectCreated:Put':
                    bucket = record['s3']['bucket']['name']
                    key = record['s3']['object']['key']
                    
                    # Only process documents in the documents folder
                    if key.startswith('documents/'):
                        logger.info(f"Processing new document: {bucket}/{key}")
                        
                        # Process the document
                        chunks = processor.process_document_with_docling(bucket, key)
                        
                        # Save to knowledge base
                        processor.save_chunks_to_knowledge_base(chunks)
                        
                        logger.info(f"Created {len(chunks)} chunks for document {key}")
        
        # Handle direct API calls from API Gateway
        elif 'body' in event:
            body = json.loads(event['body'])
            action = body.get('action', '')
            
            if action == 'search' or action == 'chat':
                query = body.get('query', '') or body.get('message', '')
                limit = body.get('limit', 5)
                
                logger.info(f"Docling embedding search for query: {query}")
                
                # Use Docling embedding search
                results = processor.search_similar_chunks(query, limit)
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'results': results,
                        'query': query,
                        'count': len(results),
                        'search_method': 'docling_embeddings'
                    })
                }
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'RAG processing completed',
                'processed_records': len(event.get('Records', []))
            })
        }
        
    except Exception as e:
        logger.error(f"Error in RAG processor: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': 'RAG processing failed',
                'message': str(e)
            })
        }
