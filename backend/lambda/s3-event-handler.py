# This file is deprecated - use the containerized rag-processor instead
# See backend/lambda/rag-processor/ for the new implementation

import json

def lambda_handler(event, context):
    return {
        'statusCode': 410,
        'body': json.dumps({
            'error': 'This Lambda function is deprecated',
            'message': 'Please use the containerized rag-processor Lambda function instead'
        })
    }