"""
Vector Search Lambda - Perform vector similarity search
Responsibility: Search for similar vectors using FAISS and cosine similarity
"""
import json
import boto3
import os
from typing import Dict, Any, List, Optional
import logging
import numpy as np
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
MAIN_BUCKET = os.environ.get('MAIN_BUCKET', 'chatbot-storage-ap-south-1')
KNOWLEDGE_BASE_TABLE = os.environ.get('KNOWLEDGE_BASE_TABLE', 'chatbot-knowledge-base')

class VectorSearchService:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name='ap-south-1')
        self.dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
        self.main_bucket = MAIN_BUCKET
        self.knowledge_base_table = self.dynamodb.Table(KNOWLEDGE_BASE_TABLE)
        
        # Initialize FAISS index
        self._faiss_index = None
        self._index_loaded = False

    def get_faiss_index(self):
        """Get or initialize FAISS index"""
        if not self._index_loaded:
            try:
                import faiss
                
                # Create FAISS index for 384-dimensional vectors (all-MiniLM-L6-v2)
                dimension = 384
                self._faiss_index = faiss.IndexFlatIP(dimension)  # Inner product (cosine similarity)
                self._index_loaded = True
                logger.info(f"Initialized FAISS index with dimension {dimension}")
            except Exception as e:
                logger.error(f"Error initializing FAISS index: {e}")
                raise Exception(f"Failed to initialize FAISS index: {e}")
        
        return self._faiss_index

    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            # Convert to numpy arrays
            a = np.array(vec1, dtype=np.float32)
            b = np.array(vec2, dtype=np.float32)
            
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

    def search_similar_vectors(self, query_embedding: List[float], limit: int = 5, threshold: float = 0.0) -> List[Dict[str, Any]]:
        """Search for similar vectors using cosine similarity"""
        try:
            # Get all chunks from DynamoDB
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
                    similarity = self.cosine_similarity(query_embedding, chunk_embedding)
                    
                    # Filter by threshold
                    if similarity >= threshold:
                        chunk_data = {
                            'chunk_id': chunk_id,
                            'content': item.get('content', ''),
                            'metadata': item.get('metadata', {}),
                            'hierarchy_level': item.get('hierarchy_level', 0),
                            'parent_id': item.get('parent_id'),
                            'similarity_score': similarity,
                            'document_id': item.get('document_id', ''),
                            'source': item.get('metadata', {}).get('source', 'Unknown'),
                            'page_number': item.get('metadata', {}).get('page_number', 0),
                            'element_type': item.get('metadata', {}).get('element_type', 'text')
                        }
                        similar_chunks.append(chunk_data)
                    
                except Exception as e:
                    logger.warning(f"Could not retrieve embedding for chunk {chunk_id}: {e}")
                    continue
            
            # Sort by similarity score and return top results
            similar_chunks.sort(key=lambda x: x['similarity_score'], reverse=True)
            logger.info(f"Found {len(similar_chunks)} chunks above threshold {threshold}, returning top {limit}")
            return similar_chunks[:limit]
            
        except Exception as e:
            logger.error(f"Error in vector search: {e}")
            return []

    def search_by_document(self, query_embedding: List[float], document_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search for similar vectors within a specific document"""
        try:
            # Query chunks for specific document
            response = self.knowledge_base_table.query(
                IndexName='document-id-index',
                KeyConditionExpression='document_id = :doc_id',
                ExpressionAttributeValues={':doc_id': document_id}
            )
            
            if 'Items' not in response or not response['Items']:
                logger.info(f"No chunks found for document {document_id}")
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
                    similarity = self.cosine_similarity(query_embedding, chunk_embedding)
                    
                    chunk_data = {
                        'chunk_id': chunk_id,
                        'content': item.get('content', ''),
                        'metadata': item.get('metadata', {}),
                        'hierarchy_level': item.get('hierarchy_level', 0),
                        'parent_id': item.get('parent_id'),
                        'similarity_score': similarity,
                        'document_id': document_id,
                        'source': item.get('metadata', {}).get('source', 'Unknown'),
                        'page_number': item.get('metadata', {}).get('page_number', 0),
                        'element_type': item.get('metadata', {}).get('element_type', 'text')
                    }
                    similar_chunks.append(chunk_data)
                    
                except Exception as e:
                    logger.warning(f"Could not retrieve embedding for chunk {chunk_id}: {e}")
                    continue
            
            # Sort by similarity score and return top results
            similar_chunks.sort(key=lambda x: x['similarity_score'], reverse=True)
            logger.info(f"Found {len(similar_chunks)} chunks in document {document_id}, returning top {limit}")
            return similar_chunks[:limit]
            
        except Exception as e:
            logger.error(f"Error in document vector search: {e}")
            return []

    def search_by_element_type(self, query_embedding: List[float], element_type: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search for similar vectors within specific element types (headings, tables, etc.)"""
        try:
            # Get all chunks from DynamoDB
            response = self.knowledge_base_table.scan()
            if 'Items' not in response or not response['Items']:
                logger.info("No chunks found in knowledge base")
                return []
            
            # Filter by element type and calculate similarities
            similar_chunks = []
            
            for item in response['Items']:
                chunk_id = item.get('chunk_id')
                if not chunk_id:
                    continue
                
                # Check element type
                item_element_type = item.get('metadata', {}).get('element_type', 'text')
                if element_type.lower() not in item_element_type.lower():
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
                    similarity = self.cosine_similarity(query_embedding, chunk_embedding)
                    
                    chunk_data = {
                        'chunk_id': chunk_id,
                        'content': item.get('content', ''),
                        'metadata': item.get('metadata', {}),
                        'hierarchy_level': item.get('hierarchy_level', 0),
                        'parent_id': item.get('parent_id'),
                        'similarity_score': similarity,
                        'document_id': item.get('document_id', ''),
                        'source': item.get('metadata', {}).get('source', 'Unknown'),
                        'page_number': item.get('metadata', {}).get('page_number', 0),
                        'element_type': item_element_type
                    }
                    similar_chunks.append(chunk_data)
                    
                except Exception as e:
                    logger.warning(f"Could not retrieve embedding for chunk {chunk_id}: {e}")
                    continue
            
            # Sort by similarity score and return top results
            similar_chunks.sort(key=lambda x: x['similarity_score'], reverse=True)
            logger.info(f"Found {len(similar_chunks)} chunks of type {element_type}, returning top {limit}")
            return similar_chunks[:limit]
            
        except Exception as e:
            logger.error(f"Error in element type vector search: {e}")
            return []

    def get_vector_statistics(self) -> Dict[str, Any]:
        """Get statistics about the vector database"""
        try:
            # Get all chunks from DynamoDB
            response = self.knowledge_base_table.scan()
            total_chunks = len(response.get('Items', []))
            
            # Count by element type
            element_types = {}
            for item in response.get('Items', []):
                element_type = item.get('metadata', {}).get('element_type', 'text')
                element_types[element_type] = element_types.get(element_type, 0) + 1
            
            # Count by document
            documents = {}
            for item in response.get('Items', []):
                doc_id = item.get('document_id', 'unknown')
                documents[doc_id] = documents.get(doc_id, 0) + 1
            
            return {
                'total_chunks': total_chunks,
                'element_types': element_types,
                'documents': documents,
                'embedding_dimension': 384,
                'model': 'all-MiniLM-L6-v2'
            }
            
        except Exception as e:
            logger.error(f"Error getting vector statistics: {e}")
            return {
                'error': str(e),
                'total_chunks': 0,
                'element_types': {},
                'documents': {}
            }

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for vector search operations"""
    try:
        logger.info(f"Vector Search event: {json.dumps(event)}")
        
        # Handle direct API calls
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        action = body.get('action', '')
        logger.info(f"Action: {action}")
        
        vector_search_service = VectorSearchService()
        
        if action == 'search':
            query_embedding = body.get('query_embedding', [])
            limit = body.get('limit', 5)
            threshold = body.get('threshold', 0.0)
            
            if not query_embedding:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'query_embedding is required'
                    })
                }
            
            logger.info(f"Searching for similar vectors with threshold {threshold}")
            
            # Search for similar vectors
            results = vector_search_service.search_similar_vectors(query_embedding, limit, threshold)
            
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
                    'count': len(results),
                    'threshold': threshold,
                    'search_method': 'cosine_similarity'
                })
            }
        
        elif action == 'search_by_document':
            query_embedding = body.get('query_embedding', [])
            document_id = body.get('document_id', '')
            limit = body.get('limit', 5)
            
            if not query_embedding or not document_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'query_embedding and document_id are required'
                    })
                }
            
            logger.info(f"Searching for similar vectors in document {document_id}")
            
            # Search within specific document
            results = vector_search_service.search_by_document(query_embedding, document_id, limit)
            
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
                    'document_id': document_id,
                    'count': len(results),
                    'search_method': 'document_cosine_similarity'
                })
            }
        
        elif action == 'search_by_element_type':
            query_embedding = body.get('query_embedding', [])
            element_type = body.get('element_type', 'text')
            limit = body.get('limit', 5)
            
            if not query_embedding:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'query_embedding is required'
                    })
                }
            
            logger.info(f"Searching for similar vectors in element type {element_type}")
            
            # Search within specific element type
            results = vector_search_service.search_by_element_type(query_embedding, element_type, limit)
            
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
                    'element_type': element_type,
                    'count': len(results),
                    'search_method': 'element_type_cosine_similarity'
                })
            }
        
        elif action == 'get_statistics':
            logger.info("Getting vector database statistics")
            
            # Get statistics
            stats = vector_search_service.get_vector_statistics()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps(stats)
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
                    'message': f'Action "{action}" not supported. Supported: search, search_by_document, search_by_element_type, get_statistics'
                })
            }
        
    except Exception as e:
        logger.error(f"Error in vector search: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': 'Vector search failed',
                'message': str(e)
            })
        }
