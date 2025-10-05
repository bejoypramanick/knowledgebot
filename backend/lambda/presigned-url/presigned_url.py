import json
import boto3
import os
from typing import Dict, Any
import logging
import uuid
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Force rebuild trigger - presigned-url Lambda deployment - Updated S3 key prefix

# Configuration
MAIN_BUCKET = os.environ.get('MAIN_BUCKET', 'chatbot-storage-ap-south-1')

class PresignedUrlService:
    def __init__(self):
        # Configure S3 client to use regional endpoint
        self.s3_client = boto3.client(
            's3', 
            region_name='ap-south-1',
            endpoint_url='https://s3.ap-south-1.amazonaws.com'
        )
        self.main_bucket = MAIN_BUCKET

    def generate_presigned_upload_url(self, filename: str, content_type: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate a presigned URL for uploading a file to S3"""
        try:
            # Generate unique S3 key
            file_extension = os.path.splitext(filename)[1]
            s3_key = f"documents/{uuid.uuid4()}{file_extension}"
            
            # Generate presigned URL for PUT operation with regional endpoint
            # Don't include metadata in the presigned URL signature to avoid timestamp mismatch
            presigned_url = self.s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.main_bucket,
                    'Key': s3_key,
                    'ContentType': content_type
                },
                ExpiresIn=3600  # 1 hour
            )
            
            return {
                'presigned_url': presigned_url,
                's3_key': s3_key,
                'bucket': self.main_bucket,
                'expires_in': 3600
            }
            
        except Exception as e:
            logger.error(f"Error generating presigned URL: {e}")
            raise e

    def generate_presigned_download_url(self, s3_key: str, expires_in: int = 3600) -> Dict[str, Any]:
        """Generate a presigned URL for downloading a file from S3"""
        try:
            presigned_url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.main_bucket,
                    'Key': s3_key
                },
                ExpiresIn=expires_in
            )
            
            return {
                'presigned_url': presigned_url,
                's3_key': s3_key,
                'bucket': self.main_bucket,
                'expires_in': expires_in
            }
            
        except Exception as e:
            logger.error(f"Error generating download URL: {e}")
            raise e

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for presigned URL operations"""
    try:
        logger.info(f"Presigned URL event: {json.dumps(event)}")
        logger.info(f"Event type: {type(event)}")
        logger.info(f"Event keys: {list(event.keys()) if isinstance(event, dict) else 'Not a dict'}")
        
        # Handle direct API calls
        if 'body' in event:
            logger.info("Processing API Gateway event with body")
            body = json.loads(event['body'])
        else:
            logger.info("Processing direct Lambda invocation")
            body = event
        
        action = body.get('action', '')
        logger.info(f"Action received: '{action}'")
        logger.info(f"Body keys: {list(body.keys()) if isinstance(body, dict) else 'Not a dict'}")
        logger.info(f"Full body: {json.dumps(body)}")
        
        service = PresignedUrlService()
        
        if action == 'get-upload-url' or action == 'get_presigned_url':
            logger.info(f"Processing {action} request")
            filename = body.get('filename', '')
            content_type = body.get('content_type', 'application/octet-stream')
            metadata = body.get('metadata', {})
            
            logger.info(f"Filename: '{filename}'")
            logger.info(f"Content type: '{content_type}'")
            logger.info(f"Metadata: {json.dumps(metadata)}")
            
            if not filename:
                logger.warning("Missing filename in request")
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Missing filename',
                        'message': 'Filename is required for presigned URL generation'
                    })
                }
            
            logger.info("Generating presigned upload URL...")
            result = service.generate_presigned_upload_url(filename, content_type, metadata)
            logger.info(f"Generated presigned URL result: {json.dumps(result)}")
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps(result)
            }
            
        elif action == 'get-download-url':
            s3_key = body.get('s3_key', '')
            expires_in = body.get('expires_in', 3600)
            
            if not s3_key:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Missing s3_key',
                        'message': 'S3 key is required for download URL generation'
                    })
                }
            
            result = service.generate_presigned_download_url(s3_key, expires_in)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps(result)
            }
            
        else:
            logger.warning(f"Unsupported action received: '{action}'")
            logger.info(f"Supported actions: get-upload-url, get_presigned_url, get-download-url")
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'error': 'Invalid action',
                    'message': f'Action "{action}" not supported'
                })
            }
            
    except Exception as e:
        logger.error(f"Error in presigned URL handler: {e}")
        logger.error(f"Exception type: {type(e)}")
        logger.error(f"Exception args: {e.args}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }
