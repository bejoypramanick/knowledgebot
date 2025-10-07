"""
Custom Agent Functions for OpenAI AgentToolkit
These functions handle all external service connections (S3, Pinecone, Neo4j, DynamoDB)
"""

import json
import boto3
import os
import uuid
import tempfile
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import numpy as np

# External service imports
try:
    import pinecone
    PINECONE_AVAILABLE = True
except ImportError:
    PINECONE_AVAILABLE = False

try:
    from neo4j import GraphDatabase
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False

try:
    from docling.document_converter import DocumentConverter
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    DOCLING_AVAILABLE = True
except ImportError:
    DOCLING_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AgentServiceConnections:
    """Centralized service connections for AgentToolkit"""
    
    def __init__(self):
        # AWS Configuration
        self.aws_region = os.environ.get('AWS_REGION', 'ap-south-1')
        self.s3_client = boto3.client('s3', region_name=self.aws_region)
        self.dynamodb = boto3.resource('dynamodb', region_name=self.aws_region)
        
        # Table and bucket names
        self.documents_bucket = os.environ.get('DOCUMENTS_BUCKET', 'chatbot-documents-ap-south-1')
        self.embeddings_bucket = os.environ.get('EMBEDDINGS_BUCKET', 'chatbot-embeddings-ap-south-1')
        self.knowledge_base_table = self.dynamodb.Table(os.environ.get('KNOWLEDGE_BASE_TABLE', 'chatbot-knowledge-base'))
        self.conversations_table = self.dynamodb.Table(os.environ.get('CONVERSATIONS_TABLE', 'chatbot-conversations'))
        self.metadata_table = self.dynamodb.Table(os.environ.get('METADATA_TABLE', 'chatbot-knowledge-base-metadata'))
        
        # Initialize external services
        self._pinecone_index = None
        self._neo4j_driver = None
        self._embedding_model = None
        self._docling_converter = None
        
        # Initialize services
        self._initialize_pinecone()
        self._initialize_neo4j()
        self._initialize_embedding_model()
        self._initialize_docling()

    def _initialize_pinecone(self):
        """Initialize Pinecone connection"""
        try:
            if PINECONE_AVAILABLE:
                pinecone.init(
                    api_key=os.environ.get('PINECONE_API_KEY'),
                    environment=os.environ.get('PINECONE_ENVIRONMENT')
                )
                self._pinecone_index = pinecone.Index(os.environ.get('PINECONE_INDEX_NAME', 'chatbot-embeddings'))
                logger.info("Pinecone initialized successfully")
            else:
                logger.warning("Pinecone not available - install pinecone-client")
        except Exception as e:
            logger.error(f"Error initializing Pinecone: {e}")

    def _initialize_neo4j(self):
        """Initialize Neo4j connection"""
        try:
            if NEO4J_AVAILABLE:
                self._neo4j_driver = GraphDatabase.driver(
                    os.environ.get('NEO4J_URI'),
                    auth=(os.environ.get('NEO4J_USER'), os.environ.get('NEO4J_PASSWORD'))
                )
                logger.info("Neo4j initialized successfully")
            else:
                logger.warning("Neo4j not available - install neo4j")
        except Exception as e:
            logger.error(f"Error initializing Neo4j: {e}")

    def _initialize_embedding_model(self):
        """Initialize sentence transformer model"""
        try:
            if SENTENCE_TRANSFORMERS_AVAILABLE:
                self._embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
                logger.info("Embedding model initialized successfully")
            else:
                logger.warning("Sentence transformers not available")
        except Exception as e:
            logger.error(f"Error initializing embedding model: {e}")

    def _initialize_docling(self):
        """Initialize Docling converter"""
        try:
            if DOCLING_AVAILABLE:
                self._docling_converter = DocumentConverter(
                    format_options={
                        InputFormat.PDF: PdfPipelineOptions(
                            do_ocr=True,
                            do_table_structure=True,
                            table_structure_options={"do_cell_matching": True}
                        )
                    }
                )
                logger.info("Docling converter initialized successfully")
            else:
                logger.warning("Docling not available")
        except Exception as e:
            logger.error(f"Error initializing Docling: {e}")

# Global service instance
agent_services = AgentServiceConnections()

# ============================================================================
# DOCUMENT INGESTION FUNCTIONS
# ============================================================================

def read_s3_data(bucket_name: str, object_key: str, aws_region: str, file_format: str) -> Dict[str, Any]:
    """
    Read data from an S3 bucket with support for different file formats
    
    Args:
        bucket_name: Name of the S3 bucket
        object_key: Key (path) of the object to read in the bucket
        aws_region: AWS region where the bucket is located
        file_format: Format of the file to read (csv, json, parquet, txt, other)
        
    Returns:
        Dictionary with file data and metadata
    """
    try:
        logger.info(f"Reading {file_format} data from s3://{bucket_name}/{object_key}")
        
        # Create S3 client for the specified region
        s3_client = boto3.client('s3', region_name=aws_region)
        
        # Download object from S3
        response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
        content = response['Body'].read()
        
        # Get metadata
        metadata = response.get('Metadata', {})
        content_type = response.get('ContentType', 'application/octet-stream')
        
        # Process content based on file format
        processed_data = None
        
        if file_format == 'json':
            try:
                processed_data = json.loads(content.decode('utf-8'))
            except json.JSONDecodeError as e:
                return {
                    'success': False,
                    'error': f'Invalid JSON format: {str(e)}',
                    'bucket_name': bucket_name,
                    'object_key': object_key
                }
        
        elif file_format == 'csv':
            try:
                import pandas as pd
                import io
                csv_data = pd.read_csv(io.StringIO(content.decode('utf-8')))
                processed_data = csv_data.to_dict('records')
            except Exception as e:
                return {
                    'success': False,
                    'error': f'Error parsing CSV: {str(e)}',
                    'bucket_name': bucket_name,
                    'object_key': object_key
                }
        
        elif file_format == 'parquet':
            try:
                import pandas as pd
                import io
                parquet_data = pd.read_parquet(io.BytesIO(content))
                processed_data = parquet_data.to_dict('records')
            except Exception as e:
                return {
                    'success': False,
                    'error': f'Error parsing Parquet: {str(e)}',
                    'bucket_name': bucket_name,
                    'object_key': object_key
                }
        
        elif file_format == 'txt':
            processed_data = content.decode('utf-8')
        
        else:  # 'other' format
            processed_data = content
        
        return {
            'success': True,
            'data': processed_data,
            'raw_content': content,
            'content_type': content_type,
            'file_format': file_format,
            'bucket_name': bucket_name,
            'object_key': object_key,
            'aws_region': aws_region,
            'metadata': metadata,
            'size': len(content)
        }
        
    except Exception as e:
        logger.error(f"Error reading data from S3: {e}")
        return {
            'success': False,
            'error': str(e),
            'bucket_name': bucket_name,
            'object_key': object_key,
            'aws_region': aws_region
        }

def download_document_from_s3(s3_bucket: str, s3_key: str) -> Dict[str, Any]:
    """
    Download document from S3 bucket
    
    Args:
        s3_bucket: S3 bucket name
        s3_key: S3 object key
        
    Returns:
        Dictionary with document data and metadata
    """
    try:
        logger.info(f"Downloading document from s3://{s3_bucket}/{s3_key}")
        
        # Download object from S3
        response = agent_services.s3_client.get_object(Bucket=s3_bucket, Key=s3_key)
        content = response['Body'].read()
        
        # Get metadata
        metadata = response.get('Metadata', {})
        content_type = response.get('ContentType', 'application/octet-stream')
        
        # Determine file extension
        file_extension = s3_key.split('.')[-1].lower() if '.' in s3_key else 'txt'
        
        return {
            'success': True,
            'content': content,
            'content_type': content_type,
            'file_extension': file_extension,
            's3_bucket': s3_bucket,
            's3_key': s3_key,
            'metadata': metadata,
            'size': len(content)
        }
        
    except Exception as e:
        logger.error(f"Error downloading document from S3: {e}")
        return {
            'success': False,
            'error': str(e),
            's3_bucket': s3_bucket,
            's3_key': s3_key
        }

def process_document_with_docling(document_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process document using Docling to extract structured content
    
    Args:
        document_data: Document data from S3
        
    Returns:
        Dictionary with processed document chunks and metadata
    """
    try:
        if not DOCLING_AVAILABLE or not agent_services._docling_converter:
            return {
                'success': False,
                'error': 'Docling not available'
            }
        
        logger.info(f"Processing document with Docling: {document_data['s3_key']}")
        
        # Save content to temporary file
        with tempfile.NamedTemporaryFile(suffix=f".{document_data['file_extension']}", delete=False) as temp_file:
            temp_file.write(document_data['content'])
            temp_file_path = temp_file.name
        
        try:
            # Convert document using Docling
            doc = agent_services._docling_converter.convert(temp_file_path)
            
            # Extract chunks with metadata
            chunks = []
            chunk_id = str(uuid.uuid4())
            
            for element in doc.iterate_items():
                if hasattr(element, 'text') and element.text.strip():
                    chunk_data = {
                        'chunk_id': f"{chunk_id}_{len(chunks)}",
                        'content': element.text.strip(),
                        'element_type': element.__class__.__name__.lower(),
                        'hierarchy_level': getattr(element, 'level', 0),
                        'page_number': getattr(element, 'page', 0),
                        'bbox': getattr(element, 'bbox', None),
                        'metadata': {
                            'source': f"s3://{document_data['s3_bucket']}/{document_data['s3_key']}",
                            's3_key': document_data['s3_key'],
                            's3_bucket': document_data['s3_bucket'],
                            'original_filename': document_data['s3_key'].split('/')[-1],
                            'processed_at': datetime.utcnow().isoformat(),
                            'content_type': document_data['content_type'],
                            'file_size': document_data['size']
                        }
                    }
                    chunks.append(chunk_data)
            
            return {
                'success': True,
                'chunks': chunks,
                'total_chunks': len(chunks),
                'document_id': chunk_id,
                'original_filename': document_data['s3_key'].split('/')[-1]
            }
            
        finally:
            # Clean up temporary file
            os.unlink(temp_file_path)
            
    except Exception as e:
        logger.error(f"Error processing document with Docling: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def store_chunks_in_dynamodb(chunks: List[Dict[str, Any]], document_id: str) -> Dict[str, Any]:
    """
    Store document chunks in DynamoDB
    
    Args:
        chunks: List of document chunks
        document_id: Unique document identifier
        
    Returns:
        Dictionary with storage results
    """
    try:
        logger.info(f"Storing {len(chunks)} chunks in DynamoDB for document {document_id}")
        
        stored_chunks = []
        
        for chunk in chunks:
            # Prepare DynamoDB item
            item = {
                'chunk_id': chunk['chunk_id'],
                'document_id': document_id,
                'content': chunk['content'],
                'hierarchy_level': chunk.get('hierarchy_level', 0),
                'element_type': chunk.get('element_type', 'text'),
                'page_number': chunk.get('page_number', 0),
                'metadata': chunk.get('metadata', {}),
                'created_at': datetime.utcnow().isoformat()
            }
            
            # Add bbox if available
            if chunk.get('bbox'):
                item['bbox'] = chunk['bbox']
            
            # Store in DynamoDB
            agent_services.knowledge_base_table.put_item(Item=item)
            stored_chunks.append(chunk['chunk_id'])
        
        # Store document metadata
        metadata_item = {
            'document_id': document_id,
            'original_filename': chunks[0]['metadata']['original_filename'] if chunks else 'unknown',
            's3_bucket': chunks[0]['metadata']['s3_bucket'] if chunks else '',
            's3_key': chunks[0]['metadata']['s3_key'] if chunks else '',
            'chunks_count': len(chunks),
            'processed_at': datetime.utcnow().isoformat(),
            'status': 'processed',
            'content_type': chunks[0]['metadata']['content_type'] if chunks else 'unknown',
            'file_size': chunks[0]['metadata']['file_size'] if chunks else 0
        }
        
        agent_services.metadata_table.put_item(Item=metadata_item)
        
        return {
            'success': True,
            'stored_chunks': stored_chunks,
            'total_chunks': len(chunks),
            'document_id': document_id
        }
        
    except Exception as e:
        logger.error(f"Error storing chunks in DynamoDB: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def generate_embeddings_for_chunks(chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generate embeddings for document chunks using SentenceTransformers
    
    Args:
        chunks: List of document chunks
        
    Returns:
        Dictionary with embeddings data
    """
    try:
        if not SENTENCE_TRANSFORMERS_AVAILABLE or not agent_services._embedding_model:
            return {
                'success': False,
                'error': 'Sentence transformers not available'
            }
        
        logger.info(f"Generating embeddings for {len(chunks)} chunks")
        
        embeddings_data = []
        
        for chunk in chunks:
            # Generate embedding
            embedding = agent_services._embedding_model.encode(chunk['content'], convert_to_tensor=False)
            
            # Store embedding in S3
            embedding_key = f"embeddings/{chunk['chunk_id']}.json"
            embedding_data = {
                'chunk_id': chunk['chunk_id'],
                'embedding': embedding.tolist(),
                'text': chunk['content'],
                'model': 'all-MiniLM-L6-v2',
                'dimension': len(embedding),
                'created_at': datetime.utcnow().isoformat()
            }
            
            agent_services.s3_client.put_object(
                Bucket=agent_services.embeddings_bucket,
                Key=embedding_key,
                Body=json.dumps(embedding_data),
                ContentType='application/json'
            )
            
            embeddings_data.append({
                'chunk_id': chunk['chunk_id'],
                'embedding_key': embedding_key,
                'dimension': len(embedding)
            })
        
        return {
            'success': True,
            'embeddings': embeddings_data,
            'total_embeddings': len(chunks)
        }
        
    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def store_embeddings_in_pinecone(embeddings_data: List[Dict[str, Any]], document_id: str) -> Dict[str, Any]:
    """
    Store embeddings in Pinecone vector database
    
    Args:
        embeddings_data: List of embedding data
        document_id: Document identifier
        
    Returns:
        Dictionary with Pinecone storage results
    """
    try:
        if not PINECONE_AVAILABLE or not agent_services._pinecone_index:
            return {
                'success': False,
                'error': 'Pinecone not available'
            }
        
        logger.info(f"Storing {len(embeddings_data)} embeddings in Pinecone")
        
        # Prepare vectors for Pinecone
        vectors = []
        
        for emb_data in embeddings_data:
            # Retrieve embedding from S3
            embedding_key = emb_data['embedding_key']
            response = agent_services.s3_client.get_object(
                Bucket=agent_services.embeddings_bucket,
                Key=embedding_key
            )
            embedding_data = json.loads(response['Body'].read())
            
            # Create Pinecone vector
            vector = {
                'id': emb_data['chunk_id'],
                'values': embedding_data['embedding'],
                'metadata': {
                    'document_id': document_id,
                    'chunk_id': emb_data['chunk_id'],
                    'dimension': emb_data['dimension']
                }
            }
            vectors.append(vector)
        
        # Upsert to Pinecone
        agent_services._pinecone_index.upsert(vectors=vectors)
        
        return {
            'success': True,
            'stored_vectors': len(vectors),
            'document_id': document_id
        }
        
    except Exception as e:
        logger.error(f"Error storing embeddings in Pinecone: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def build_knowledge_graph_in_neo4j(chunks: List[Dict[str, Any]], document_id: str) -> Dict[str, Any]:
    """
    Build knowledge graph in Neo4j from document chunks
    
    Args:
        chunks: List of document chunks
        document_id: Document identifier
        
    Returns:
        Dictionary with knowledge graph results
    """
    try:
        if not NEO4J_AVAILABLE or not agent_services._neo4j_driver:
            return {
                'success': False,
                'error': 'Neo4j not available'
            }
        
        logger.info(f"Building knowledge graph in Neo4j for document {document_id}")
        
        with agent_services._neo4j_driver.session() as session:
            # Create document node
            session.run("""
                MERGE (d:Document {id: $document_id})
                SET d.name = $document_name,
                    d.processed_at = $processed_at,
                    d.chunk_count = $chunk_count
            """, 
            document_id=document_id,
            document_name=chunks[0]['metadata']['original_filename'] if chunks else 'unknown',
            processed_at=datetime.utcnow().isoformat(),
            chunk_count=len(chunks)
            )
            
            # Create chunk nodes and relationships
            for i, chunk in enumerate(chunks):
                # Create chunk node
                session.run("""
                    MERGE (c:Chunk {id: $chunk_id})
                    SET c.content = $content,
                        c.element_type = $element_type,
                        c.hierarchy_level = $hierarchy_level,
                        c.page_number = $page_number
                """, 
                chunk_id=chunk['chunk_id'],
                content=chunk['content'][:500],  # Limit content length
                element_type=chunk.get('element_type', 'text'),
                hierarchy_level=chunk.get('hierarchy_level', 0),
                page_number=chunk.get('page_number', 0)
                )
                
                # Create relationship between document and chunk
                session.run("""
                    MATCH (d:Document {id: $document_id})
                    MATCH (c:Chunk {id: $chunk_id})
                    MERGE (d)-[:CONTAINS]->(c)
                """, 
                document_id=document_id,
                chunk_id=chunk['chunk_id']
                )
                
                # Create sequential relationships between chunks
                if i > 0:
                    session.run("""
                        MATCH (c1:Chunk {id: $prev_chunk_id})
                        MATCH (c2:Chunk {id: $chunk_id})
                        MERGE (c1)-[:NEXT]->(c2)
                    """, 
                    prev_chunk_id=chunks[i-1]['chunk_id'],
                    chunk_id=chunk['chunk_id']
                    )
        
        return {
            'success': True,
            'document_id': document_id,
            'chunks_processed': len(chunks),
            'graph_nodes': len(chunks) + 1  # chunks + document
        }
        
    except Exception as e:
        logger.error(f"Error building knowledge graph in Neo4j: {e}")
        return {
            'success': False,
            'error': str(e)
        }

# ============================================================================
# RETRIEVAL FUNCTIONS
# ============================================================================

def search_pinecone_embeddings(query: str, limit: int = 5) -> Dict[str, Any]:
    """
    Search for similar chunks using Pinecone vector search
    
    Args:
        query: Search query
        limit: Maximum number of results
        
    Returns:
        Dictionary with search results
    """
    try:
        if not PINECONE_AVAILABLE or not agent_services._pinecone_index:
            return {
                'success': False,
                'error': 'Pinecone not available'
            }
        
        if not SENTENCE_TRANSFORMERS_AVAILABLE or not agent_services._embedding_model:
            return {
                'success': False,
                'error': 'Embedding model not available'
            }
        
        logger.info(f"Searching Pinecone for query: {query}")
        
        # Generate query embedding
        query_embedding = agent_services._embedding_model.encode(query, convert_to_tensor=False)
        
        # Search Pinecone
        search_results = agent_services._pinecone_index.query(
            vector=query_embedding.tolist(),
            top_k=limit,
            include_metadata=True
        )
        
        # Process results
        results = []
        for match in search_results['matches']:
            results.append({
                'chunk_id': match['id'],
                'score': match['score'],
                'metadata': match['metadata']
            })
        
        return {
            'success': True,
            'results': results,
            'query': query,
            'total_results': len(results)
        }
        
    except Exception as e:
        logger.error(f"Error searching Pinecone: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def search_neo4j_knowledge_graph(query: str, limit: int = 5) -> Dict[str, Any]:
    """
    Search knowledge graph in Neo4j for related entities
    
    Args:
        query: Search query
        limit: Maximum number of results
        
    Returns:
        Dictionary with knowledge graph search results
    """
    try:
        if not NEO4J_AVAILABLE or not agent_services._neo4j_driver:
            return {
                'success': False,
                'error': 'Neo4j not available'
            }
        
        logger.info(f"Searching Neo4j knowledge graph for query: {query}")
        
        with agent_services._neo4j_driver.session() as session:
            # Search for chunks containing query terms
            result = session.run("""
                MATCH (c:Chunk)
                WHERE toLower(c.content) CONTAINS toLower($query)
                RETURN c.id as chunk_id, 
                       c.content as content,
                       c.element_type as element_type,
                       c.hierarchy_level as hierarchy_level,
                       c.page_number as page_number
                ORDER BY c.hierarchy_level, c.page_number
                LIMIT $limit
            """, query=query, limit=limit)
            
            results = []
            for record in result:
                results.append({
                    'chunk_id': record['chunk_id'],
                    'content': record['content'],
                    'element_type': record['element_type'],
                    'hierarchy_level': record['hierarchy_level'],
                    'page_number': record['page_number']
                })
        
        return {
            'success': True,
            'results': results,
            'query': query,
            'total_results': len(results)
        }
        
    except Exception as e:
        logger.error(f"Error searching Neo4j: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def get_chunk_details_from_dynamodb(chunk_ids: List[str]) -> Dict[str, Any]:
    """
    Get detailed chunk information from DynamoDB
    
    Args:
        chunk_ids: List of chunk IDs
        
    Returns:
        Dictionary with chunk details
    """
    try:
        logger.info(f"Getting details for {len(chunk_ids)} chunks from DynamoDB")
        
        chunks = []
        
        for chunk_id in chunk_ids:
            response = agent_services.knowledge_base_table.get_item(
                Key={'chunk_id': chunk_id}
            )
            
            if 'Item' in response:
                item = response['Item']
                chunks.append({
                    'chunk_id': item.get('chunk_id'),
                    'content': item.get('content'),
                    'document_id': item.get('document_id'),
                    'hierarchy_level': item.get('hierarchy_level', 0),
                    'element_type': item.get('element_type', 'text'),
                    'page_number': item.get('page_number', 0),
                    'metadata': item.get('metadata', {}),
                    'created_at': item.get('created_at')
                })
        
        return {
            'success': True,
            'chunks': chunks,
            'total_chunks': len(chunks)
        }
        
    except Exception as e:
        logger.error(f"Error getting chunk details from DynamoDB: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def aggregate_retrieval_context(pinecone_results: Dict[str, Any], neo4j_results: Dict[str, Any], dynamodb_chunks: Dict[str, Any]) -> Dict[str, Any]:
    """
    Aggregate context from all retrieval sources
    
    Args:
        pinecone_results: Results from Pinecone search
        neo4j_results: Results from Neo4j search
        dynamodb_chunks: Chunk details from DynamoDB
        
    Returns:
        Dictionary with aggregated context
    """
    try:
        logger.info("Aggregating retrieval context from all sources")
        
        # Combine all chunk IDs
        all_chunk_ids = set()
        
        if pinecone_results.get('success') and pinecone_results.get('results'):
            for result in pinecone_results['results']:
                all_chunk_ids.add(result['chunk_id'])
        
        if neo4j_results.get('success') and neo4j_results.get('results'):
            for result in neo4j_results['results']:
                all_chunk_ids.add(result['chunk_id'])
        
        # Get detailed information for all chunks
        chunk_details = get_chunk_details_from_dynamodb(list(all_chunk_ids))
        
        # Create aggregated context
        context = {
            'total_sources': len(all_chunk_ids),
            'pinecone_matches': len(pinecone_results.get('results', [])) if pinecone_results.get('success') else 0,
            'neo4j_matches': len(neo4j_results.get('results', [])) if neo4j_results.get('success') else 0,
            'chunks': chunk_details.get('chunks', []) if chunk_details.get('success') else [],
            'retrieval_summary': {
                'vector_search_success': pinecone_results.get('success', False),
                'graph_search_success': neo4j_results.get('success', False),
                'database_retrieval_success': chunk_details.get('success', False)
            }
        }
        
        return {
            'success': True,
            'context': context
        }
        
    except Exception as e:
        logger.error(f"Error aggregating retrieval context: {e}")
        return {
            'success': False,
            'error': str(e)
        }

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def generate_presigned_upload_url(filename: str, content_type: str) -> Dict[str, Any]:
    """
    Generate presigned URL for document upload
    
    Args:
        filename: Name of the file to upload
        content_type: MIME type of the file
        
    Returns:
        Dictionary with presigned URL and metadata
    """
    try:
        logger.info(f"Generating presigned URL for {filename}")
        
        # Generate unique S3 key
        file_extension = filename.split('.')[-1] if '.' in filename else 'txt'
        s3_key = f"documents/{uuid.uuid4()}.{file_extension}"
        
        # Generate presigned URL
        presigned_url = agent_services.s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': agent_services.documents_bucket,
                'Key': s3_key,
                'ContentType': content_type
            },
            ExpiresIn=3600  # 1 hour
        )
        
        return {
            'success': True,
            'presigned_url': presigned_url,
            's3_key': s3_key,
            's3_bucket': agent_services.documents_bucket,
            'expires_in': 3600
        }
        
    except Exception as e:
        logger.error(f"Error generating presigned URL: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def log_processing_status(document_id: str, status: str, message: str) -> Dict[str, Any]:
    """
    Log processing status to DynamoDB
    
    Args:
        document_id: Document identifier
        status: Processing status
        message: Status message
        
    Returns:
        Dictionary with logging result
    """
    try:
        logger.info(f"Logging status for document {document_id}: {status}")
        
        # Update metadata table
        agent_services.metadata_table.update_item(
            Key={'document_id': document_id},
            UpdateExpression='SET #status = :status, #message = :message, #updated_at = :updated_at',
            ExpressionAttributeNames={
                '#status': 'status',
                '#message': 'message',
                '#updated_at': 'updated_at'
            },
            ExpressionAttributeValues={
                ':status': status,
                ':message': message,
                ':updated_at': datetime.utcnow().isoformat()
            }
        )
        
        return {
            'success': True,
            'document_id': document_id,
            'status': status,
            'message': message
        }
        
    except Exception as e:
        logger.error(f"Error logging processing status: {e}")
        return {
            'success': False,
            'error': str(e)
        }
