"""
Python Lambda Handlers using AgentBuilder SDKs
This module provides Lambda handlers that use the Python AgentBuilder SDKs directly
"""

import json
import os
import asyncio
from typing import Dict, Any
import logging

# Import our workflow modules
from document_ingestion_workflow import run_document_ingestion_workflow, WorkflowInput as IngestionInput
from retrieval_workflow import run_retrieval_workflow, WorkflowInput as RetrievalInput

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def retrieval_handler_async(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Async Lambda handler for retrieval workflow"""
    try:
        # Extract query from event
        query = event.get('query', '')
        if not query:
            return {
                "statusCode": 400,
                "body": json.dumps({
                    "error": "Query parameter is required"
                })
            }
        
        # Create workflow input
        workflow_input = RetrievalInput(input_as_text=query)
        
        # Run the retrieval workflow
        result = await run_retrieval_workflow(workflow_input)
        
        return {
            "statusCode": 200,
            "body": json.dumps(result)
        }
        
    except Exception as e:
        logger.error(f"Error in retrieval handler: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": str(e)
            })
        }

async def document_ingestion_handler_async(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Async Lambda handler for document ingestion workflow"""
    try:
        # Extract S3 event information
        records = event.get('Records', [])
        if not records:
            return {
                "statusCode": 400,
                "body": json.dumps({
                    "error": "No S3 records found in event"
                })
            }
        
        record = records[0]
        s3_info = record.get('s3', {})
        bucket = s3_info.get('bucket', {}).get('name', '')
        key = s3_info.get('object', {}).get('key', '')
        
        # Create workflow input
        workflow_input = IngestionInput(input_as_text=f"S3 Event: Bucket={bucket}, Key={key}")
        
        # Run the document ingestion workflow
        result = await run_document_ingestion_workflow(workflow_input)
        
        return {
            "statusCode": 200,
            "body": json.dumps(result)
        }
        
    except Exception as e:
        logger.error(f"Error in document ingestion handler: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": str(e)
            })
        }

# Synchronous wrappers for Lambda
def lambda_handler_retrieval(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Synchronous wrapper for retrieval handler"""
    return asyncio.run(retrieval_handler_async(event, context))

def lambda_handler_document_ingestion(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Synchronous wrapper for document ingestion handler"""
    return asyncio.run(document_ingestion_handler_async(event, context))

# Alternative handlers that can be used directly
def retrieval_lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Direct retrieval Lambda handler"""
    return lambda_handler_retrieval(event, context)

def document_ingestion_lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Direct document ingestion Lambda handler"""
    return lambda_handler_document_ingestion(event, context)
