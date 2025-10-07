"""
AgentToolkit Integration Module
This module provides integration between the existing orchestrator and the new AgentToolkit system
"""

import json
import boto3
import os
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class AgentToolkitIntegration:
    """Integration class to connect existing system with AgentToolkit"""
    
    def __init__(self):
        self.lambda_client = boto3.client('lambda', region_name='ap-south-1')
        self.agent_lambda_name = os.environ.get('AGENT_LAMBDA_NAME', 'chatbot-agent-toolkit')
        
    def route_to_agent_toolkit(self, event: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Route requests to the AgentToolkit Lambda function"""
        try:
            logger.info("Routing request to AgentToolkit")
            
            # Call the AgentToolkit Lambda function
            response = self.lambda_client.invoke(
                FunctionName=self.agent_lambda_name,
                InvocationType='RequestResponse',
                Payload=json.dumps(event)
            )
            
            # Parse response
            payload = response['Payload'].read()
            result = json.loads(payload)
            
            logger.info("AgentToolkit response received")
            return result
            
        except Exception as e:
            logger.error(f"Error routing to AgentToolkit: {e}")
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'error': 'AgentToolkit routing failed',
                    'message': str(e)
                })
            }
