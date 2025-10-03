# This file is deprecated - use the containerized chat-handler instead
# See backend/lambda/chat-handler/ for the new implementation

import json

def lambda_handler(event, context):
    return {
        'statusCode': 410,
        'body': json.dumps({
            'error': 'This Lambda function is deprecated',
            'message': 'Please use the containerized chat-handler Lambda function instead'
        })
    }