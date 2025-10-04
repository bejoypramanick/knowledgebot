"""
Document Content Lambda - Retrieve and manage document content
Responsibility: Get document content from S3 and provide content retrieval services
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

class DocumentContentService:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name='ap-south-1')
        self.main_bucket = MAIN_BUCKET

    def get_document_content(self, s3_key: str) -> Optional[Dict[str, Any]]:
        """Get document content from S3"""
        try:
            # Get object from S3
            response = self.s3_client.get_object(
                Bucket=self.main_bucket,
                Key=s3_key
            )
            
            # Read content
            content = response['Body'].read()
            
            # Determine content type
            content_type = response.get('ContentType', 'application/octet-stream')
            
            # Get metadata
            metadata = response.get('Metadata', {})
            
            # Get object metadata
            last_modified = response.get('LastModified', datetime.utcnow())
            content_length = response.get('ContentLength', len(content))
            
            return {
                's3_key': s3_key,
                's3_bucket': self.main_bucket,
                'content': content.decode('utf-8') if content_type.startswith('text/') else content,
                'content_type': content_type,
                'content_length': content_length,
                'last_modified': last_modified.isoformat(),
                'metadata': metadata,
                'is_text': content_type.startswith('text/')
            }
            
        except Exception as e:
            logger.error(f"Error getting document content for {s3_key}: {e}")
            return None

    def get_document_text_content(self, s3_key: str) -> Optional[str]:
        """Get document text content (for text-based documents)"""
        try:
            content_data = self.get_document_content(s3_key)
            
            if not content_data or not content_data['is_text']:
                logger.warning(f"Document {s3_key} is not a text document")
                return None
            
            return content_data['content']
            
        except Exception as e:
            logger.error(f"Error getting text content for {s3_key}: {e}")
            return None

    def get_document_binary_content(self, s3_key: str) -> Optional[bytes]:
        """Get document binary content (for binary documents)"""
        try:
            content_data = self.get_document_content(s3_key)
            
            if not content_data:
                return None
            
            if content_data['is_text']:
                # Convert text back to bytes
                return content_data['content'].encode('utf-8')
            else:
                # Return binary content
                return content_data['content']
            
        except Exception as e:
            logger.error(f"Error getting binary content for {s3_key}: {e}")
            return None

    def get_document_preview(self, s3_key: str, max_length: int = 1000) -> Optional[Dict[str, Any]]:
        """Get a preview of document content"""
        try:
            content_data = self.get_document_content(s3_key)
            
            if not content_data:
                return None
            
            # Create preview
            if content_data['is_text']:
                full_content = content_data['content']
                preview = full_content[:max_length]
                is_truncated = len(full_content) > max_length
            else:
                preview = f"[Binary content - {content_data['content_type']}]"
                is_truncated = False
            
            return {
                's3_key': s3_key,
                's3_bucket': self.main_bucket,
                'preview': preview,
                'is_truncated': is_truncated,
                'content_type': content_data['content_type'],
                'content_length': content_data['content_length'],
                'is_text': content_data['is_text'],
                'last_modified': content_data['last_modified']
            }
            
        except Exception as e:
            logger.error(f"Error getting document preview for {s3_key}: {e}")
            return None

    def search_in_document_content(self, s3_key: str, search_term: str, case_sensitive: bool = False) -> List[Dict[str, Any]]:
        """Search for text within document content"""
        try:
            text_content = self.get_document_text_content(s3_key)
            
            if not text_content:
                logger.warning(f"Cannot search in non-text document {s3_key}")
                return []
            
            # Prepare search
            if not case_sensitive:
                search_term = search_term.lower()
                text_to_search = text_content.lower()
            else:
                text_to_search = text_content
            
            # Find all occurrences
            matches = []
            start = 0
            
            while True:
                pos = text_to_search.find(search_term, start)
                if pos == -1:
                    break
                
                # Get context around the match
                context_start = max(0, pos - 50)
                context_end = min(len(text_content), pos + len(search_term) + 50)
                context = text_content[context_start:context_end]
                
                # Calculate line number (approximate)
                line_number = text_content[:pos].count('\n') + 1
                
                matches.append({
                    'position': pos,
                    'line_number': line_number,
                    'context': context,
                    'match_length': len(search_term)
                })
                
                start = pos + 1
            
            return matches
            
        except Exception as e:
            logger.error(f"Error searching in document content for {s3_key}: {e}")
            return []

    def get_document_info(self, s3_key: str) -> Optional[Dict[str, Any]]:
        """Get document information without downloading content"""
        try:
            # Get object metadata
            response = self.s3_client.head_object(
                Bucket=self.main_bucket,
                Key=s3_key
            )
            
            # Extract information
            content_type = response.get('ContentType', 'application/octet-stream')
            content_length = response.get('ContentLength', 0)
            last_modified = response.get('LastModified', datetime.utcnow())
            metadata = response.get('Metadata', {})
            
            # Determine if it's a text document
            is_text = content_type.startswith('text/') or content_type in [
                'application/json',
                'application/xml',
                'text/xml',
                'application/javascript',
                'text/css',
                'text/html'
            ]
            
            return {
                's3_key': s3_key,
                's3_bucket': self.main_bucket,
                'content_type': content_type,
                'content_length': content_length,
                'last_modified': last_modified.isoformat(),
                'metadata': metadata,
                'is_text': is_text,
                'file_extension': s3_key.split('.')[-1] if '.' in s3_key else '',
                'file_name': s3_key.split('/')[-1]
            }
            
        except Exception as e:
            logger.error(f"Error getting document info for {s3_key}: {e}")
            return None

    def list_document_versions(self, s3_key: str) -> List[Dict[str, Any]]:
        """List all versions of a document (if versioning is enabled)"""
        try:
            # List object versions
            response = self.s3_client.list_object_versions(
                Bucket=self.main_bucket,
                Prefix=s3_key
            )
            
            versions = []
            
            # Process versions
            for version in response.get('Versions', []):
                versions.append({
                    'version_id': version['VersionId'],
                    'is_latest': version['IsLatest'],
                    'last_modified': version['LastModified'].isoformat(),
                    'size': version['Size'],
                    'storage_class': version['StorageClass']
                })
            
            # Process delete markers
            for delete_marker in response.get('DeleteMarkers', []):
                versions.append({
                    'version_id': delete_marker['VersionId'],
                    'is_latest': delete_marker['IsLatest'],
                    'last_modified': delete_marker['LastModified'].isoformat(),
                    'is_delete_marker': True
                })
            
            # Sort by last modified (newest first)
            versions.sort(key=lambda x: x['last_modified'], reverse=True)
            
            return versions
            
        except Exception as e:
            logger.error(f"Error listing document versions for {s3_key}: {e}")
            return []

    def generate_presigned_url(self, s3_key: str, expiration: int = 3600) -> Optional[str]:
        """Generate a presigned URL for document access"""
        try:
            # Generate presigned URL
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.main_bucket,
                    'Key': s3_key
                },
                ExpiresIn=expiration
            )
            
            return url
            
        except Exception as e:
            logger.error(f"Error generating presigned URL for {s3_key}: {e}")
            return None

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for document content operations"""
    try:
        logger.info(f"Document Content event: {json.dumps(event)}")
        
        # Handle direct API calls
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        action = body.get('action', '')
        logger.info(f"Action: {action}")
        
        content_service = DocumentContentService()
        
        if action == 'get_document_content':
            s3_key = body.get('s3_key', '')
            
            if not s3_key:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 's3_key is required'
                    })
                }
            
            logger.info(f"Getting content for document: {s3_key}")
            
            # Get document content
            content_data = content_service.get_document_content(s3_key)
            
            if content_data:
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps(content_data)
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
                        's3_key': s3_key
                    })
                }
        
        elif action == 'get_document_text_content':
            s3_key = body.get('s3_key', '')
            
            if not s3_key:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 's3_key is required'
                    })
                }
            
            logger.info(f"Getting text content for document: {s3_key}")
            
            # Get text content
            text_content = content_service.get_document_text_content(s3_key)
            
            if text_content is not None:
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        's3_key': s3_key,
                        'content': text_content,
                        'is_text': True
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
                        'error': 'Document is not a text document or not found',
                        's3_key': s3_key
                    })
                }
        
        elif action == 'get_document_preview':
            s3_key = body.get('s3_key', '')
            max_length = body.get('max_length', 1000)
            
            if not s3_key:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 's3_key is required'
                    })
                }
            
            logger.info(f"Getting preview for document: {s3_key}")
            
            # Get document preview
            preview_data = content_service.get_document_preview(s3_key, max_length)
            
            if preview_data:
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps(preview_data)
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
                        's3_key': s3_key
                    })
                }
        
        elif action == 'search_in_document_content':
            s3_key = body.get('s3_key', '')
            search_term = body.get('search_term', '')
            case_sensitive = body.get('case_sensitive', False)
            
            if not s3_key or not search_term:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 's3_key and search_term are required'
                    })
                }
            
            logger.info(f"Searching in document: {s3_key} for: {search_term}")
            
            # Search in document content
            matches = content_service.search_in_document_content(s3_key, search_term, case_sensitive)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    's3_key': s3_key,
                    'search_term': search_term,
                    'matches': matches,
                    'count': len(matches),
                    'case_sensitive': case_sensitive
                })
            }
        
        elif action == 'get_document_info':
            s3_key = body.get('s3_key', '')
            
            if not s3_key:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 's3_key is required'
                    })
                }
            
            logger.info(f"Getting info for document: {s3_key}")
            
            # Get document info
            info = content_service.get_document_info(s3_key)
            
            if info:
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps(info)
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
                        's3_key': s3_key
                    })
                }
        
        elif action == 'generate_presigned_url':
            s3_key = body.get('s3_key', '')
            expiration = body.get('expiration', 3600)
            
            if not s3_key:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 's3_key is required'
                    })
                }
            
            logger.info(f"Generating presigned URL for document: {s3_key}")
            
            # Generate presigned URL
            url = content_service.generate_presigned_url(s3_key, expiration)
            
            if url:
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        's3_key': s3_key,
                        'presigned_url': url,
                        'expiration': expiration
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
                        'error': 'Failed to generate presigned URL',
                        's3_key': s3_key
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
                    'message': f'Action "{action}" not supported. Supported: get_document_content, get_document_text_content, get_document_preview, search_in_document_content, get_document_info, generate_presigned_url'
                })
            }
        
    except Exception as e:
        logger.error(f"Error in document content service: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': 'Document content service failed',
                'message': str(e)
            })
        }
