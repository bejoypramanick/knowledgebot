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

# Configure detailed logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    force=True
)
logger = logging.getLogger(__name__)

# Add console handler for better visibility
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# Trigger workflow - S3 notification permissions added manually - Enhanced logging added

# Configuration
MAIN_BUCKET = os.environ.get('MAIN_BUCKET', 'chatbot-storage-ap-south-1')
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
        logger.info("🚀 Starting RAGProcessor initialization...")
        
        try:
            logger.info(f"📋 Environment variables - MAIN_BUCKET: {MAIN_BUCKET}, KNOWLEDGE_BASE_TABLE: {KNOWLEDGE_BASE_TABLE}")
            
            # Initialize S3 client
            logger.info("🔧 Initializing S3 client...")
            self.s3_client = boto3.client('s3', region_name='ap-south-1')
            logger.info("✅ S3 client initialized successfully")
            
            # Initialize DynamoDB client
            logger.info("🔧 Initializing DynamoDB client...")
            self.dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
            self.main_bucket = MAIN_BUCKET
            self.knowledge_base_table = self.dynamodb.Table(KNOWLEDGE_BASE_TABLE)
            logger.info("✅ DynamoDB client initialized successfully")
            
            # Initialize Anthropic client with explicit configuration
            logger.info("🔧 Initializing Anthropic client...")
            try:
                self.anthropic_client = Anthropic(
                    api_key=CLAUDE_API_KEY
                )
                logger.info("✅ Anthropic client initialized successfully")
            except Exception as e:
                logger.error(f"❌ Error initializing Anthropic client: {e}")
                self.anthropic_client = None
            
            # Initialize Docling converter with /tmp artifacts path
            logger.info("🔧 Initializing Docling converter...")
            try:
                # Create artifacts directory in /tmp for writable access
                artifacts_path = "/tmp/docling_artifacts"
                os.makedirs(artifacts_path, exist_ok=True)
                
                self.converter = DocumentConverter(
                    artifacts_path=artifacts_path,
                    format_options={
                        InputFormat.PDF: PdfPipelineOptions(
                            do_ocr=False,  # Disable OCR temporarily to speed up initialization
                            do_table_structure=True,
                            table_structure_options={"do_cell_matching": True}
                        )
                    }
                )
                logger.info(f"✅ Docling converter initialized successfully with artifacts path: {artifacts_path}")
            except Exception as e:
                logger.error(f"❌ Error initializing Docling converter: {e}")
                raise e
            
            logger.info("🎉 RAGProcessor initialization completed successfully!")
            
        except Exception as e:
            logger.error(f"❌ Critical error during RAGProcessor initialization: {e}")
            logger.error(f"❌ Error type: {type(e).__name__}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            raise e

    def get_docling_embedding(self, text: str) -> List[float]:
        """Get embedding using HuggingFace sentence-transformers model"""
        try:
            from sentence_transformers import SentenceTransformer
            
            # Use a lightweight, efficient sentence transformer model
            # This model is optimized for semantic similarity and works well with Docling
            model_name = "all-MiniLM-L6-v2"  # 384-dimensional embeddings
            
            # Initialize the model (it will be cached after first use)
            if not hasattr(self, '_embedding_model'):
                self._embedding_model = SentenceTransformer(model_name)
            
            # Generate embedding
            embedding = self._embedding_model.encode(text, convert_to_tensor=False)
            
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"Error generating Docling embedding with sentence-transformers: {e}")
            raise Exception(f"Failed to generate embedding with sentence-transformers: {e}")

    def save_markdown_to_s3(self, doc, s3_key: str, s3_metadata: Dict[str, Any]) -> str:
        """Save Docling-generated markdown to S3 bucket"""
        try:
            # Export document to markdown using Docling
            markdown_content = doc.document.export_to_markdown()
            
            # Create markdown key in S3 with prefix
            filename = s3_key.split('/')[-1]
            base_name = filename.rsplit('.', 1)[0] if '.' in filename else filename
            markdown_key = f"markdown/{base_name}.md"
            
            # Upload markdown to S3
            self.s3_client.put_object(
                Bucket=self.main_bucket,
                Key=markdown_key,
                Body=markdown_content.encode('utf-8'),
                ContentType='text/markdown',
                Metadata={
                    'original_s3_key': s3_key,
                    'document_id': s3_metadata.get('document_id', ''),
                    'original_filename': s3_metadata.get('original_filename', filename),
                    'processed_at': datetime.utcnow().isoformat(),
                    'source': 'docling'
                }
            )
            
            logger.info(f"Markdown saved to S3: {self.main_bucket}/{markdown_key}")
            return markdown_key
            
        except Exception as e:
            logger.error(f"Error saving markdown to S3: {e}")
            return ""

    def process_document_with_docling(self, s3_bucket: str, s3_key: str) -> List[DocumentChunk]:
        """Process document using Docling and create hierarchical chunks"""
        logger.info(f"🔧 Starting document processing: {s3_bucket}/{s3_key}")
        
        try:
            # Download document from S3
            logger.info(f"📥 Downloading document from S3...")
            response = self.s3_client.get_object(Bucket=s3_bucket, Key=s3_key)
            document_content = response['Body'].read()
            logger.info(f"✅ Document downloaded - Size: {len(document_content)} bytes")
            
            # Get metadata from S3 object
            logger.info(f"📋 Retrieving S3 object metadata...")
            metadata_response = self.s3_client.head_object(Bucket=s3_bucket, Key=s3_key)
            s3_metadata = metadata_response.get('Metadata', {})
            logger.info(f"✅ Metadata retrieved: {s3_metadata}")
            
            # Save to temporary file for Docling processing
            logger.info(f"💾 Creating temporary file for Docling processing...")
            file_extension = s3_key.split('.')[-1] if '.' in s3_key else 'txt'
            with tempfile.NamedTemporaryFile(suffix=f".{file_extension}", delete=False) as temp_file:
                temp_file.write(document_content)
                temp_file_path = temp_file.name
            logger.info(f"✅ Temporary file created: {temp_file_path}")
            
            try:
                # Process with Docling
                logger.info(f"🔧 Processing document with Docling converter...")
                doc = self.converter.convert(temp_file_path)
                logger.info(f"✅ Docling conversion completed successfully")
                
                # Save markdown to S3
                logger.info(f"💾 Saving markdown to S3...")
                markdown_key = self.save_markdown_to_s3(doc, s3_key, s3_metadata)
                if markdown_key:
                    logger.info(f"✅ Markdown saved successfully: {markdown_key}")
                else:
                    logger.warning("⚠️ Failed to save markdown to S3")
                
                # Extract hierarchical chunks
                logger.info(f"🔧 Extracting hierarchical chunks...")
                chunks = self._extract_hierarchical_chunks(doc, s3_key, s3_metadata, markdown_key)
                logger.info(f"✅ Created {len(chunks)} hierarchical chunks")
                
                # If no hierarchical chunks were created, fall back to Docling's default chunking
                if len(chunks) == 0:
                    logger.info("🔄 No hierarchical chunks found, falling back to Docling default chunking...")
                    chunks = self._extract_default_chunks(doc, s3_key, s3_metadata, markdown_key)
                    logger.info(f"✅ Created {len(chunks)} default chunks")
                
                return chunks
                
            finally:
                # Clean up temporary file
                logger.info(f"🧹 Cleaning up temporary file: {temp_file_path}")
                os.unlink(temp_file_path)
                logger.info(f"✅ Temporary file cleaned up")
                
        except Exception as e:
            logger.error(f"❌ Error processing document with Docling: {e}")
            logger.error(f"❌ Error type: {type(e).__name__}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            return []

    def _extract_hierarchical_chunks(self, doc, s3_key: str, s3_metadata: Dict[str, Any], markdown_key: str = "") -> List[DocumentChunk]:
        """Extract hierarchical chunks from Docling document"""
        chunks = []
        # Generate a consistent document_id based on the S3 key
        # This ensures we can group chunks by document even if metadata doesn't contain document_id
        document_id = s3_metadata.get('document_id', s3_key.replace('documents/', '').split('.')[0])
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
                    page_idx,
                    markdown_key
                )
                if chunk:
                    chunks.append(chunk)
        
        # Create parent-child relationships
        chunks = self._establish_hierarchy(chunks)
        
        return chunks

    def _extract_default_chunks(self, doc, s3_key: str, s3_metadata: Dict[str, Any], markdown_key: str = "") -> List[DocumentChunk]:
        """Extract chunks using Docling's default chunking strategy as fallback"""
        chunks = []
        document_id = s3_metadata.get('document_id', s3_key.replace('documents/', '').split('.')[0])
        filename = s3_key.split('/')[-1]
        
        try:
            # Get the full text content from the document
            full_text = doc.document.export_to_markdown()
            
            if not full_text or len(full_text.strip()) < 10:
                logger.warning("⚠️ Document has no meaningful text content for chunking")
                return chunks
            
            # Split text into chunks using simple paragraph-based chunking
            paragraphs = [p.strip() for p in full_text.split('\n\n') if p.strip()]
            
            logger.info(f"📄 Found {len(paragraphs)} paragraphs for chunking")
            
            for i, paragraph in enumerate(paragraphs):
                if len(paragraph) < 10:  # Skip very short paragraphs
                    continue
                    
                # Create chunk
                chunk_id = f"{document_id}_chunk_{i+1}"
                
                # Get embedding
                embedding = self.get_docling_embedding(paragraph)
                
                chunk = DocumentChunk(
                    content=paragraph,
                    metadata={
                        'document_id': document_id,
                        'source': filename,
                        's3_key': s3_key,
                        's3_bucket': self.main_bucket,
                        'markdown_key': markdown_key,
                        'chunk_index': i + 1,
                        'total_chunks': len(paragraphs),
                        'chunking_method': 'default_paragraph',
                        'processed_at': datetime.utcnow().isoformat(),
                        'original_filename': s3_metadata.get('original_filename', filename),
                        **{k: v for k, v in s3_metadata.items() if k not in ['document_id', 'original_filename', 'upload_timestamp']}
                    },
                    embedding=embedding,
                    hierarchy_level=3  # Default level for paragraph chunks
                )
                
                chunks.append(chunk)
                logger.info(f"📝 Created chunk {i+1}: {paragraph[:50]}...")
            
            logger.info(f"✅ Default chunking created {len(chunks)} chunks")
            
        except Exception as e:
            logger.error(f"❌ Error in default chunking: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
        
        return chunks

    def _create_chunk_from_element(self, element, document_id: str, filename: str, s3_key: str, s3_metadata: Dict[str, Any], page_idx: int, markdown_key: str = "") -> Optional[DocumentChunk]:
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
                    's3_bucket': self.main_bucket,
                    'markdown_key': markdown_key,
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
                        Bucket=self.main_bucket,
                        Key=embedding_key,
                        Body=json.dumps(embedding_data),
                        ContentType='application/json'
                    )
            
            logger.info(f"Saved {len(chunks)} chunks to DynamoDB and embeddings to S3")
                    
        except Exception as e:
            logger.error(f"Error saving chunks to knowledge base: {e}")

    def search_similar_chunks(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search for similar chunks using sentence-transformers embeddings"""
        try:
            # Use sentence-transformers embedding-based search
            return self._search_docling_embeddings(query, limit)
            
        except Exception as e:
            logger.error(f"Error searching similar chunks with sentence-transformers: {e}")
            return []

    def _search_docling_embeddings(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Search using Docling sentence-transformers embeddings for vector similarity"""
        try:
            # Get query embedding using sentence-transformers
            query_embedding = self.get_docling_embedding(query)
            if not query_embedding:
                logger.error("Sentence-transformers could not generate query embedding")
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
                        Bucket=self.main_bucket,
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
                            's3_bucket': self.main_bucket,
                            'page_number': item.get('metadata', {}).get('page_number', 0),
                            'element_type': item.get('metadata', {}).get('element_type', 'text')
                        },
                        'hierarchy_level': item.get('hierarchy_level', 0),
                        'parent_id': item.get('parent_id'),
                        'similarity_score': similarity
                    }
                    similar_chunks.append(chunk_data)
                    
                except Exception as e:
                    logger.warning(f"Could not retrieve sentence-transformers embedding for chunk {chunk_id}: {e}")
                    continue
            
            # Sort by similarity score and return top results
            similar_chunks.sort(key=lambda x: x['similarity_score'], reverse=True)
            logger.info(f"Docling found {len(similar_chunks)} chunks, returning top {limit}")
            return similar_chunks[:limit]
            
        except Exception as e:
            logger.error(f"Error in sentence-transformers embedding search: {e}")
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
    logger.info("🚀 Lambda handler started")
    logger.info(f"📋 Event received: {json.dumps(event, indent=2)}")
    logger.info(f"📋 Context: {context}")
    
    try:
        logger.info("🔧 Initializing RAGProcessor...")
        processor = RAGProcessor()
        logger.info("✅ RAGProcessor initialized successfully")
        
        # Handle S3 event
        if 'Records' in event:
            logger.info(f"📦 Processing S3 event with {len(event.get('Records', []))} records")
            
            # Process S3 upload events
            for i, record in enumerate(event.get('Records', [])):
                logger.info(f"📄 Processing record {i+1}: {json.dumps(record, indent=2)}")
                
                if record.get('eventName') == 'ObjectCreated:Put':
                    bucket = record['s3']['bucket']['name']
                    key = record['s3']['object']['key']
                    
                    logger.info(f"📁 S3 ObjectCreated:Put event - Bucket: {bucket}, Key: {key}")
                    
                    # Only process documents in the documents folder
                    if key.startswith('documents/'):
                        logger.info(f"✅ Document matches filter - Processing: {bucket}/{key}")
                        
                        try:
                            # Process the document
                            logger.info(f"🔧 Starting document processing with Docling...")
                            chunks = processor.process_document_with_docling(bucket, key)
                            logger.info(f"✅ Document processing completed - Created {len(chunks)} chunks")
                            
                            # Save to knowledge base
                            logger.info(f"💾 Saving {len(chunks)} chunks to knowledge base...")
                            processor.save_chunks_to_knowledge_base(chunks)
                            logger.info(f"✅ Successfully saved {len(chunks)} chunks for document {key}")
                            
                        except Exception as e:
                            logger.error(f"❌ Error processing document {bucket}/{key}: {e}")
                            logger.error(f"❌ Error type: {type(e).__name__}")
                            import traceback
                            logger.error(f"❌ Traceback: {traceback.format_exc()}")
                            raise e
                    else:
                        logger.info(f"⏭️ Skipping document - Key does not start with 'documents/': {key}")
                else:
                    logger.info(f"⏭️ Skipping record - Not an ObjectCreated:Put event: {record.get('eventName')}")
        else:
            logger.info("📝 No S3 Records found in event")
        
        # Handle direct API calls from API Gateway
        if 'body' in event:
            body = json.loads(event['body'])
            action = body.get('action', '')
            
            if action == 'search' or action == 'chat':
                query = body.get('query', '') or body.get('message', '')
                limit = body.get('limit', 5)
                
                logger.info(f"Sentence-transformers embedding search for query: {query}")
                
                # Use sentence-transformers embedding search
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
                        'search_method': 'sentence_transformers'
                    })
                }
            
            elif action == 'generate_embeddings':
                text = body.get('text', '')
                logger.info(f"Generating embeddings for text: {text[:100]}...")
                
                try:
                    # Generate embedding using sentence-transformers
                    embedding = processor.get_docling_embedding(text)
                    
                    return {
                        'statusCode': 200,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type',
                            'Access-Control-Allow-Methods': 'POST, OPTIONS'
                        },
                        'body': json.dumps({
                            'embedding': embedding,
                            'text': text,
                            'dimension': len(embedding),
                            'model': 'all-MiniLM-L6-v2'
                        })
                    }
                except Exception as e:
                    logger.error(f"Error generating embeddings: {e}")
                    return {
                        'statusCode': 500,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type',
                            'Access-Control-Allow-Methods': 'POST, OPTIONS'
                        },
                        'body': json.dumps({
                            'error': 'Failed to generate embeddings',
                            'message': str(e)
                        })
                    }
            
            elif action == 'list_documents':
                logger.info("Listing documents in knowledge base")
                
                try:
                    # Get all documents from DynamoDB
                    response = processor.knowledge_base_table.scan()
                    documents = []
                    
                    if 'Items' in response:
                        # Group by document_id to get unique documents
                        doc_map = {}
                        for item in response['Items']:
                            doc_id = item.get('document_id', '')
                            if doc_id and doc_id not in doc_map:
                                metadata = item.get('metadata', {})
                                doc_map[doc_id] = {
                                    'document_id': doc_id,
                                    'source': metadata.get('source', 'Unknown'),
                                    's3_key': metadata.get('s3_key', ''),
                                    'original_filename': metadata.get('original_filename', ''),
                                    'processed_at': metadata.get('processed_at', ''),
                                    'chunk_count': 0
                                }
                            if doc_id in doc_map:
                                doc_map[doc_id]['chunk_count'] += 1
                        
                        documents = list(doc_map.values())
                    
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
                except Exception as e:
                    logger.error(f"Error listing documents: {e}")
                    return {
                        'statusCode': 500,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type',
                            'Access-Control-Allow-Methods': 'POST, OPTIONS'
                        },
                        'body': json.dumps({
                            'error': 'Failed to list documents',
                            'message': str(e)
                        })
                    }
            
            elif action == 'get_document_content':
                document_id = body.get('document_id', '')
                logger.info(f"Getting content for document: {document_id}")
                
                try:
                    # Get all chunks for the document
                    response = processor.knowledge_base_table.query(
                        IndexName='document_id-index',  # Assuming you have a GSI on document_id
                        KeyConditionExpression='document_id = :doc_id',
                        ExpressionAttributeValues={':doc_id': document_id}
                    )
                    
                    chunks = []
                    if 'Items' in response:
                        for item in response['Items']:
                            chunks.append({
                                'chunk_id': item.get('chunk_id', ''),
                                'content': item.get('content', ''),
                                'hierarchy_level': item.get('hierarchy_level', 0),
                                'metadata': item.get('metadata', {})
                            })
                    
                    # Sort by hierarchy level and position
                    chunks.sort(key=lambda x: (x['hierarchy_level'], x['chunk_id']))
                    
                    return {
                        'statusCode': 200,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type',
                            'Access-Control-Allow-Methods': 'POST, OPTIONS'
                        },
                        'body': json.dumps({
                            'document_id': document_id,
                            'chunks': chunks,
                            'chunk_count': len(chunks)
                        })
                    }
                except Exception as e:
                    logger.error(f"Error getting document content: {e}")
                    return {
                        'statusCode': 500,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type',
                            'Access-Control-Allow-Methods': 'POST, OPTIONS'
                        },
                        'body': json.dumps({
                            'error': 'Failed to get document content',
                            'message': str(e)
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
# Force new deployment - Sun Oct  5 00:47:02 CEST 2025
# Force deployment
