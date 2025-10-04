import json
import boto3
import os
from typing import Dict, Any, List
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
MAIN_BUCKET = os.environ.get('MAIN_BUCKET', 'chatbot-storage-ap-south-1')
KNOWLEDGE_BASE_TABLE = os.environ.get('KNOWLEDGE_BASE_TABLE', 'chatbot-knowledge-base')

class RAGSearchService:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name='ap-south-1')
        self.dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
        self.main_bucket = MAIN_BUCKET
        self.knowledge_base_table = self.dynamodb.Table(KNOWLEDGE_BASE_TABLE)
        
        # Initialize embedding model
        self._embedding_model = None

    def get_embedding(self, text: str) -> List[float]:
        """Get embedding using HuggingFace sentence-transformers model"""
        try:
            from sentence_transformers import SentenceTransformer
            
            # Use a lightweight, efficient sentence transformer model
            model_name = "all-MiniLM-L6-v2"  # 384-dimensional embeddings
            
            # Initialize the model (it will be cached after first use)
            if not self._embedding_model:
                self._embedding_model = SentenceTransformer(model_name)
            
            # Generate embedding
            embedding = self._embedding_model.encode(text, convert_to_tensor=False)
            
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"Error generating embedding with sentence-transformers: {e}")
            raise Exception(f"Failed to generate embedding with sentence-transformers: {e}")

    def search_similar_chunks(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search for similar chunks using sentence-transformers embeddings"""
        try:
            # Get query embedding
            query_embedding = self.get_embedding(query)
            if not query_embedding:
                logger.error("Could not generate query embedding")
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
                    logger.warning(f"Could not retrieve embedding for chunk {chunk_id}: {e}")
                    continue
            
            # Sort by similarity score and return top results
            similar_chunks.sort(key=lambda x: x['similarity_score'], reverse=True)
            logger.info(f"Found {len(similar_chunks)} chunks, returning top {limit}")
            return similar_chunks[:limit]
            
        except Exception as e:
            logger.error(f"Error in embedding search: {e}")
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

    def generate_embeddings(self, text: str) -> Dict[str, Any]:
        """Generate embeddings for given text"""
        try:
            embedding = self.get_embedding(text)
            return {
                'embedding': embedding,
                'text': text,
                'dimension': len(embedding),
                'model': 'all-MiniLM-L6-v2'
            }
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            raise Exception(f"Failed to generate embeddings: {e}")

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for RAG search operations"""
    try:
        logger.info(f"RAG Search event: {json.dumps(event)}")
        
        # Handle direct API calls
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        action = body.get('action', '')
        logger.info(f"Action: {action}")
        
        rag_service = RAGSearchService()
        
        if action == 'search':
            query = body.get('query', '')
            limit = body.get('limit', 5)
            
            logger.info(f"Searching for query: {query}")
            
            # Search for similar chunks
            results = rag_service.search_similar_chunks(query, limit)
            
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
                result = rag_service.generate_embeddings(text)
                
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
        logger.error(f"Error in RAG search: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': 'RAG search failed',
                'message': str(e)
            })
        }
