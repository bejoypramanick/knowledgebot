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

class DocumentManagementService:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name='ap-south-1')
        self.dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
        self.main_bucket = MAIN_BUCKET
        self.knowledge_base_table = self.dynamodb.Table(KNOWLEDGE_BASE_TABLE)

    def list_documents(self, limit: int = 10) -> List[Dict[str, Any]]:
        """List documents in the knowledge base"""
        try:
            # Get all documents from DynamoDB
            response = self.knowledge_base_table.scan()
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
            
            # Sort by processed_at and limit results
            documents.sort(key=lambda x: x.get('processed_at', ''), reverse=True)
            return documents[:limit]
            
        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            return []

    def get_document_content(self, document_id: str) -> Dict[str, Any]:
        """Get all chunks for a specific document"""
        try:
            # Get all chunks for the document
            response = self.knowledge_base_table.query(
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
                        'page_number': item.get('metadata', {}).get('page_number', 0),
                        'element_type': item.get('metadata', {}).get('element_type', 'text'),
                        'metadata': item.get('metadata', {})
                    })
            
            # Sort by hierarchy level and position
            chunks.sort(key=lambda x: (x['hierarchy_level'], x['chunk_id']))
            
            return {
                'document_id': document_id,
                'chunks': chunks,
                'chunk_count': len(chunks)
            }
            
        except Exception as e:
            logger.error(f"Error getting document content: {e}")
            return {
                'document_id': document_id,
                'chunks': [],
                'chunk_count': 0,
                'error': str(e)
            }

    def get_document_metadata(self, document_id: str) -> Dict[str, Any]:
        """Get metadata for a specific document"""
        try:
            # Get first chunk to extract document metadata
            response = self.knowledge_base_table.query(
                IndexName='document_id-index',
                KeyConditionExpression='document_id = :doc_id',
                ExpressionAttributeValues={':doc_id': document_id},
                Limit=1
            )
            
            if 'Items' in response and len(response['Items']) > 0:
                item = response['Items'][0]
                metadata = item.get('metadata', {})
                
                return {
                    'document_id': document_id,
                    'source': metadata.get('source', 'Unknown'),
                    's3_key': metadata.get('s3_key', ''),
                    'original_filename': metadata.get('original_filename', ''),
                    'processed_at': metadata.get('processed_at', ''),
                    'author': metadata.get('author', 'unknown'),
                    'category': metadata.get('category', 'general'),
                    'tags': metadata.get('tags', [])
                }
            else:
                return {
                    'document_id': document_id,
                    'error': 'Document not found'
                }
                
        except Exception as e:
            logger.error(f"Error getting document metadata: {e}")
            return {
                'document_id': document_id,
                'error': str(e)
            }

    def search_documents(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search documents by filename or metadata"""
        try:
            # Get all documents
            documents = self.list_documents(limit=100)  # Get more for filtering
            
            # Filter documents based on query
            query_lower = query.lower()
            filtered_docs = []
            
            for doc in documents:
                if (query_lower in doc.get('original_filename', '').lower() or
                    query_lower in doc.get('source', '').lower()):
                    filtered_docs.append(doc)
            
            return filtered_docs[:limit]
            
        except Exception as e:
            logger.error(f"Error searching documents: {e}")
            return []

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for document management operations"""
    try:
        logger.info(f"Document Management event: {json.dumps(event)}")
        
        # Handle direct API calls
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        action = body.get('action', '')
        logger.info(f"Action: {action}")
        
        doc_service = DocumentManagementService()
        
        if action == 'list_documents':
            limit = body.get('limit', 10)
            logger.info(f"Listing documents with limit: {limit}")
            
            try:
                documents = doc_service.list_documents(limit)
                
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
                result = doc_service.get_document_content(document_id)
                
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
        
        elif action == 'get_document_metadata':
            document_id = body.get('document_id', '')
            logger.info(f"Getting metadata for document: {document_id}")
            
            try:
                result = doc_service.get_document_metadata(document_id)
                
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
                logger.error(f"Error getting document metadata: {e}")
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Failed to get document metadata',
                        'message': str(e)
                    })
                }
        
        elif action == 'search_documents':
            query = body.get('query', '')
            limit = body.get('limit', 10)
            logger.info(f"Searching documents for: {query}")
            
            try:
                documents = doc_service.search_documents(query, limit)
                
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
                        'query': query,
                        'count': len(documents)
                    })
                }
            except Exception as e:
                logger.error(f"Error searching documents: {e}")
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Failed to search documents',
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
        logger.error(f"Error in document management: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': 'Document management failed',
                'message': str(e)
            })
        }
