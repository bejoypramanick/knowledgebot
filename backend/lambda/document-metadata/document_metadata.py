"""
Document Metadata Lambda - Manage document metadata
Responsibility: Retrieve, update, and manage document metadata
"""
import json
import boto3
import os
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
MAIN_BUCKET = os.environ.get('MAIN_BUCKET', 'chatbot-storage-ap-south-1')
KNOWLEDGE_BASE_TABLE = os.environ.get('KNOWLEDGE_BASE_TABLE', 'chatbot-knowledge-base')

class DocumentMetadataService:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name='ap-south-1')
        self.dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
        self.main_bucket = MAIN_BUCKET
        self.knowledge_base_table = self.dynamodb.Table(KNOWLEDGE_BASE_TABLE)

    def get_document_metadata(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a specific document"""
        try:
            # Query chunks for the document to get metadata
            response = self.knowledge_base_table.query(
                IndexName='document-id-index',
                KeyConditionExpression='document_id = :doc_id',
                ExpressionAttributeValues={':doc_id': document_id},
                Limit=1
            )
            
            if 'Items' not in response or not response['Items']:
                logger.info(f"No chunks found for document {document_id}")
                return None
            
            # Get metadata from the first chunk
            first_chunk = response['Items'][0]
            metadata = first_chunk.get('metadata', {})
            
            # Get total chunk count for this document
            total_chunks = len(response['Items'])
            
            # Build comprehensive document metadata
            document_metadata = {
                'document_id': document_id,
                'source': metadata.get('source', 'Unknown'),
                's3_key': metadata.get('s3_key', ''),
                's3_bucket': self.main_bucket,
                'original_filename': metadata.get('original_filename', ''),
                'processed_at': metadata.get('processed_at', ''),
                'total_chunks': total_chunks,
                'file_type': metadata.get('file_type', 'unknown'),
                'file_size': metadata.get('file_size', 0),
                'page_count': metadata.get('page_count', 0),
                'language': metadata.get('language', 'en'),
                'created_at': metadata.get('created_at', ''),
                'updated_at': datetime.utcnow().isoformat()
            }
            
            return document_metadata
            
        except Exception as e:
            logger.error(f"Error getting document metadata for {document_id}: {e}")
            return None

    def get_document_chunks_metadata(self, document_id: str) -> List[Dict[str, Any]]:
        """Get metadata for all chunks of a document"""
        try:
            # Query all chunks for the document
            response = self.knowledge_base_table.query(
                IndexName='document-id-index',
                KeyConditionExpression='document_id = :doc_id',
                ExpressionAttributeValues={':doc_id': document_id}
            )
            
            if 'Items' not in response or not response['Items']:
                logger.info(f"No chunks found for document {document_id}")
                return []
            
            # Build chunk metadata list
            chunks_metadata = []
            for item in response['Items']:
                chunk_metadata = {
                    'chunk_id': item.get('chunk_id'),
                    'content_preview': item.get('content', '')[:200] + '...' if len(item.get('content', '')) > 200 else item.get('content', ''),
                    'hierarchy_level': item.get('hierarchy_level', 0),
                    'parent_id': item.get('parent_id'),
                    'element_type': item.get('metadata', {}).get('element_type', 'text'),
                    'page_number': item.get('metadata', {}).get('page_number', 0),
                    'source': item.get('metadata', {}).get('source', 'Unknown'),
                    'processed_at': item.get('metadata', {}).get('processed_at', ''),
                    'has_embedding': True  # Assume true if chunk exists
                }
                chunks_metadata.append(chunk_metadata)
            
            # Sort by hierarchy level and page number
            chunks_metadata.sort(key=lambda x: (x['page_number'], x['hierarchy_level']))
            
            return chunks_metadata
            
        except Exception as e:
            logger.error(f"Error getting chunks metadata for document {document_id}: {e}")
            return []

    def get_document_structure(self, document_id: str) -> Dict[str, Any]:
        """Get document structure and hierarchy"""
        try:
            # Get all chunks for the document
            chunks_metadata = self.get_document_chunks_metadata(document_id)
            
            if not chunks_metadata:
                return {
                    'document_id': document_id,
                    'structure': {},
                    'hierarchy_levels': [],
                    'element_types': {},
                    'total_chunks': 0
                }
            
            # Build structure by element type
            structure = {
                'headings': [],
                'tables': [],
                'figures': [],
                'text_blocks': []
            }
            
            # Count by element type
            element_types = {}
            hierarchy_levels = set()
            
            for chunk in chunks_metadata:
                element_type = chunk['element_type'].lower()
                hierarchy_levels.add(chunk['hierarchy_level'])
                
                # Count element types
                element_types[chunk['element_type']] = element_types.get(chunk['element_type'], 0) + 1
                
                # Categorize by element type
                if 'heading' in element_type or 'title' in element_type:
                    structure['headings'].append(chunk)
                elif 'table' in element_type:
                    structure['tables'].append(chunk)
                elif 'figure' in element_type or 'image' in element_type:
                    structure['figures'].append(chunk)
                else:
                    structure['text_blocks'].append(chunk)
            
            return {
                'document_id': document_id,
                'structure': structure,
                'hierarchy_levels': sorted(list(hierarchy_levels)),
                'element_types': element_types,
                'total_chunks': len(chunks_metadata)
            }
            
        except Exception as e:
            logger.error(f"Error getting document structure for {document_id}: {e}")
            return {
                'document_id': document_id,
                'structure': {},
                'hierarchy_levels': [],
                'element_types': {},
                'total_chunks': 0,
                'error': str(e)
            }

    def update_document_metadata(self, document_id: str, metadata_updates: Dict[str, Any]) -> bool:
        """Update document metadata"""
        try:
            # Get existing chunks for the document
            response = self.knowledge_base_table.query(
                IndexName='document-id-index',
                KeyConditionExpression='document_id = :doc_id',
                ExpressionAttributeValues={':doc_id': document_id}
            )
            
            if 'Items' not in response or not response['Items']:
                logger.warning(f"No chunks found for document {document_id}")
                return False
            
            # Update metadata for all chunks
            updated_count = 0
            for item in response['Items']:
                chunk_id = item.get('chunk_id')
                if not chunk_id:
                    continue
                
                # Get current metadata
                current_metadata = item.get('metadata', {})
                
                # Update with new values
                updated_metadata = {**current_metadata, **metadata_updates}
                updated_metadata['updated_at'] = datetime.utcnow().isoformat()
                
                # Update the chunk
                self.knowledge_base_table.update_item(
                    Key={'chunk_id': chunk_id},
                    UpdateExpression='SET metadata = :metadata',
                    ExpressionAttributeValues={':metadata': updated_metadata}
                )
                updated_count += 1
            
            logger.info(f"Updated metadata for {updated_count} chunks in document {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating document metadata for {document_id}: {e}")
            return False

    def get_all_documents_metadata(self) -> List[Dict[str, Any]]:
        """Get metadata for all documents"""
        try:
            # Scan all chunks to get unique documents
            response = self.knowledge_base_table.scan()
            
            if 'Items' not in response or not response['Items']:
                logger.info("No documents found")
                return []
            
            # Group by document_id
            documents = {}
            for item in response['Items']:
                doc_id = item.get('document_id', '')
                if not doc_id:
                    continue
                
                if doc_id not in documents:
                    metadata = item.get('metadata', {})
                    documents[doc_id] = {
                        'document_id': doc_id,
                        'source': metadata.get('source', 'Unknown'),
                        's3_key': metadata.get('s3_key', ''),
                        'original_filename': metadata.get('original_filename', ''),
                        'processed_at': metadata.get('processed_at', ''),
                        'file_type': metadata.get('file_type', 'unknown'),
                        'chunk_count': 0
                    }
                
                documents[doc_id]['chunk_count'] += 1
            
            # Convert to list and sort by processed_at
            documents_list = list(documents.values())
            documents_list.sort(key=lambda x: x.get('processed_at', ''), reverse=True)
            
            return documents_list
            
        except Exception as e:
            logger.error(f"Error getting all documents metadata: {e}")
            return []

    def delete_document_metadata(self, document_id: str) -> bool:
        """Delete all metadata for a document"""
        try:
            # Get all chunks for the document
            response = self.knowledge_base_table.query(
                IndexName='document-id-index',
                KeyConditionExpression='document_id = :doc_id',
                ExpressionAttributeValues={':doc_id': document_id}
            )
            
            if 'Items' not in response or not response['Items']:
                logger.info(f"No chunks found for document {document_id}")
                return True
            
            # Delete all chunks
            deleted_count = 0
            for item in response['Items']:
                chunk_id = item.get('chunk_id')
                if not chunk_id:
                    continue
                
                # Delete from DynamoDB
                self.knowledge_base_table.delete_item(
                    Key={'chunk_id': chunk_id}
                )
                
                # Delete embedding from S3
                try:
                    embedding_key = f"embeddings/{chunk_id}.json"
                    self.s3_client.delete_object(
                        Bucket=self.main_bucket,
                        Key=embedding_key
                    )
                except Exception as e:
                    logger.warning(f"Could not delete embedding for chunk {chunk_id}: {e}")
                
                deleted_count += 1
            
            logger.info(f"Deleted {deleted_count} chunks for document {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting document metadata for {document_id}: {e}")
            return False

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for document metadata operations"""
    try:
        logger.info(f"Document Metadata event: {json.dumps(event)}")
        
        # Handle direct API calls
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        action = body.get('action', '')
        logger.info(f"Action: {action}")
        
        metadata_service = DocumentMetadataService()
        
        if action == 'get_document_metadata':
            document_id = body.get('document_id', '')
            
            if not document_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'document_id is required'
                    })
                }
            
            logger.info(f"Getting metadata for document: {document_id}")
            
            # Get document metadata
            metadata = metadata_service.get_document_metadata(document_id)
            
            if metadata:
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps(metadata)
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
                        'error': 'Document not found',
                        'document_id': document_id
                    })
                }
        
        elif action == 'get_document_chunks_metadata':
            document_id = body.get('document_id', '')
            
            if not document_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'document_id is required'
                    })
                }
            
            logger.info(f"Getting chunks metadata for document: {document_id}")
            
            # Get chunks metadata
            chunks_metadata = metadata_service.get_document_chunks_metadata(document_id)
            
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
                    'chunks': chunks_metadata,
                    'count': len(chunks_metadata)
                })
            }
        
        elif action == 'get_document_structure':
            document_id = body.get('document_id', '')
            
            if not document_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'document_id is required'
                    })
                }
            
            logger.info(f"Getting structure for document: {document_id}")
            
            # Get document structure
            structure = metadata_service.get_document_structure(document_id)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps(structure)
            }
        
        elif action == 'update_document_metadata':
            document_id = body.get('document_id', '')
            metadata_updates = body.get('metadata_updates', {})
            
            if not document_id or not metadata_updates:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'document_id and metadata_updates are required'
                    })
                }
            
            logger.info(f"Updating metadata for document: {document_id}")
            
            # Update document metadata
            success = metadata_service.update_document_metadata(document_id, metadata_updates)
            
            if success:
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'success': True,
                        'document_id': document_id,
                        'message': 'Metadata updated successfully'
                    })
                }
            else:
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Failed to update metadata',
                        'document_id': document_id
                    })
                }
        
        elif action == 'get_all_documents_metadata':
            logger.info("Getting metadata for all documents")
            
            # Get all documents metadata
            documents = metadata_service.get_all_documents_metadata()
            
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
        
        elif action == 'delete_document_metadata':
            document_id = body.get('document_id', '')
            
            if not document_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'document_id is required'
                    })
                }
            
            logger.info(f"Deleting metadata for document: {document_id}")
            
            # Delete document metadata
            success = metadata_service.delete_document_metadata(document_id)
            
            if success:
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'success': True,
                        'document_id': document_id,
                        'message': 'Document metadata deleted successfully'
                    })
                }
            else:
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Failed to delete document metadata',
                        'document_id': document_id
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
                    'message': f'Action "{action}" not supported. Supported: get_document_metadata, get_document_chunks_metadata, get_document_structure, update_document_metadata, get_all_documents_metadata, delete_document_metadata'
                })
            }
        
    except Exception as e:
        logger.error(f"Error in document metadata service: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': 'Document metadata service failed',
                'message': str(e)
            })
        }
