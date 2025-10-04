"""
Embedding Service Lambda - Generate embeddings for text
Responsibility: Generate vector embeddings using sentence-transformers
"""
import json
import boto3
import os
from typing import Dict, Any, List
import logging
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
MAIN_BUCKET = os.environ.get('MAIN_BUCKET', 'chatbot-storage-ap-south-1')

class EmbeddingService:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name='ap-south-1')
        self.main_bucket = MAIN_BUCKET
        
        # Initialize embedding model
        self._embedding_model = None

    def get_embedding_model(self):
        """Get or initialize the embedding model"""
        if self._embedding_model is None:
            try:
                from sentence_transformers import SentenceTransformer
                # Use a lightweight, efficient sentence transformer model
                model_name = "all-MiniLM-L6-v2"  # 384-dimensional embeddings
                self._embedding_model = SentenceTransformer(model_name)
                logger.info(f"Initialized embedding model: {model_name}")
            except Exception as e:
                logger.error(f"Error initializing embedding model: {e}")
                raise Exception(f"Failed to initialize embedding model: {e}")
        
        return self._embedding_model

    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for given text"""
        try:
            model = self.get_embedding_model()
            
            # Clean and prepare text
            if not text or not text.strip():
                raise ValueError("Text cannot be empty")
            
            # Generate embedding
            embedding = model.encode(text.strip(), convert_to_tensor=False)
            
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            raise Exception(f"Failed to generate embedding: {e}")

    def generate_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        try:
            model = self.get_embedding_model()
            
            # Filter out empty texts
            valid_texts = [text.strip() for text in texts if text and text.strip()]
            
            if not valid_texts:
                raise ValueError("No valid texts provided")
            
            # Generate embeddings in batch
            embeddings = model.encode(valid_texts, convert_to_tensor=False)
            
            return embeddings.tolist()
            
        except Exception as e:
            logger.error(f"Error generating batch embeddings: {e}")
            raise Exception(f"Failed to generate batch embeddings: {e}")

    def save_embedding(self, chunk_id: str, embedding: List[float], metadata: Dict[str, Any] = None) -> bool:
        """Save embedding to S3"""
        try:
            embedding_data = {
                'chunk_id': chunk_id,
                'embedding': embedding,
                'dimension': len(embedding),
                'model': 'all-MiniLM-L6-v2',
                'metadata': metadata or {}
            }
            
            # Save to S3
            embedding_key = f"embeddings/{chunk_id}.json"
            self.s3_client.put_object(
                Bucket=self.main_bucket,
                Key=embedding_key,
                Body=json.dumps(embedding_data),
                ContentType='application/json'
            )
            
            logger.info(f"Saved embedding for chunk {chunk_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving embedding: {e}")
            return False

    def get_embedding(self, chunk_id: str) -> Dict[str, Any]:
        """Retrieve embedding from S3"""
        try:
            embedding_key = f"embeddings/{chunk_id}.json"
            response = self.s3_client.get_object(
                Bucket=self.main_bucket,
                Key=embedding_key
            )
            
            embedding_data = json.loads(response['Body'].read())
            return embedding_data
            
        except Exception as e:
            logger.error(f"Error retrieving embedding for chunk {chunk_id}: {e}")
            return None

    def calculate_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """Calculate cosine similarity between two embeddings"""
        try:
            # Convert to numpy arrays
            a = np.array(embedding1)
            b = np.array(embedding2)
            
            # Calculate cosine similarity
            dot_product = np.dot(a, b)
            norm_a = np.linalg.norm(a)
            norm_b = np.linalg.norm(b)
            
            if norm_a == 0 or norm_b == 0:
                return 0.0
            
            similarity = dot_product / (norm_a * norm_b)
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error calculating similarity: {e}")
            return 0.0

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for embedding operations"""
    try:
        logger.info(f"Embedding Service event: {json.dumps(event)}")
        
        # Handle direct API calls
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        action = body.get('action', '')
        logger.info(f"Action: {action}")
        
        embedding_service = EmbeddingService()
        
        if action == 'generate_embedding':
            text = body.get('text', '')
            chunk_id = body.get('chunk_id', '')
            metadata = body.get('metadata', {})
            
            logger.info(f"Generating embedding for text: {text[:100]}...")
            
            try:
                # Generate embedding
                embedding = embedding_service.generate_embedding(text)
                
                # Save embedding if chunk_id provided
                if chunk_id:
                    embedding_service.save_embedding(chunk_id, embedding, metadata)
                
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
                        'chunk_id': chunk_id,
                        'dimension': len(embedding),
                        'model': 'all-MiniLM-L6-v2',
                        'metadata': metadata
                    })
                }
            except Exception as e:
                logger.error(f"Error generating embedding: {e}")
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Failed to generate embedding',
                        'message': str(e)
                    })
                }
        
        elif action == 'generate_batch_embeddings':
            texts = body.get('texts', [])
            chunk_ids = body.get('chunk_ids', [])
            metadata_list = body.get('metadata_list', [])
            
            logger.info(f"Generating batch embeddings for {len(texts)} texts")
            
            try:
                # Generate batch embeddings
                embeddings = embedding_service.generate_batch_embeddings(texts)
                
                # Save embeddings if chunk_ids provided
                results = []
                for i, (embedding, text) in enumerate(zip(embeddings, texts)):
                    chunk_id = chunk_ids[i] if i < len(chunk_ids) else f"batch_{i}"
                    metadata = metadata_list[i] if i < len(metadata_list) else {}
                    
                    if chunk_id:
                        embedding_service.save_embedding(chunk_id, embedding, metadata)
                    
                    results.append({
                        'chunk_id': chunk_id,
                        'embedding': embedding,
                        'text': text,
                        'dimension': len(embedding),
                        'metadata': metadata
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'embeddings': results,
                        'count': len(results),
                        'model': 'all-MiniLM-L6-v2'
                    })
                }
            except Exception as e:
                logger.error(f"Error generating batch embeddings: {e}")
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Failed to generate batch embeddings',
                        'message': str(e)
                    })
                }
        
        elif action == 'get_embedding':
            chunk_id = body.get('chunk_id', '')
            
            if not chunk_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'chunk_id is required'
                    })
                }
            
            logger.info(f"Retrieving embedding for chunk: {chunk_id}")
            
            try:
                embedding_data = embedding_service.get_embedding(chunk_id)
                
                if embedding_data:
                    return {
                        'statusCode': 200,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type',
                            'Access-Control-Allow-Methods': 'POST, OPTIONS'
                        },
                        'body': json.dumps(embedding_data)
                    }
                else:
                    return {
                        'statusCode': 404,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type',
                            'Access-Control-Allow-Methods': 'POST, OPTIONS'
                        },
                        'body': json.dumps({
                            'error': 'Embedding not found',
                            'chunk_id': chunk_id
                        })
                    }
            except Exception as e:
                logger.error(f"Error retrieving embedding: {e}")
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Failed to retrieve embedding',
                        'message': str(e)
                    })
                }
        
        elif action == 'calculate_similarity':
            embedding1 = body.get('embedding1', [])
            embedding2 = body.get('embedding2', [])
            
            if not embedding1 or not embedding2:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Both embedding1 and embedding2 are required'
                    })
                }
            
            try:
                similarity = embedding_service.calculate_similarity(embedding1, embedding2)
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'similarity': similarity,
                        'embedding1_dimension': len(embedding1),
                        'embedding2_dimension': len(embedding2)
                    })
                }
            except Exception as e:
                logger.error(f"Error calculating similarity: {e}")
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Failed to calculate similarity',
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
                    'message': f'Action "{action}" not supported. Supported: generate_embedding, generate_batch_embeddings, get_embedding, calculate_similarity'
                })
            }
        
    except Exception as e:
        logger.error(f"Error in embedding service: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': 'Embedding service failed',
                'message': str(e)
            })
        }
