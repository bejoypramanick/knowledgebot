"""
Integration script to update existing orchestrator to work with AgentToolkit
This script modifies the existing orchestrator to route requests to the new agent-based system
"""

import json
import boto3
import os
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AgentToolkitIntegration:
    """Integration class to connect existing system with AgentToolkit"""
    
    def __init__(self):
        self.lambda_client = boto3.client('lambda', region_name='ap-south-1')
        self.agent_lambda_name = os.environ.get('AGENT_LAMBDA_NAME', 'chatbot-agent-toolkit')
        
    def route_to_agent_toolkit(self, event: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """
        Route requests to the AgentToolkit Lambda function
        This replaces the existing orchestrator logic for document processing and retrieval
        """
        try:
            logger.info("Routing request to AgentToolkit")
            logger.info(f"Event: {json.dumps(event)}")
            
            # Determine the type of request
            if 'Records' in event and event['Records']:
                # S3 event - document ingestion
                logger.info("S3 event detected - routing to document ingestion")
                return self._handle_document_ingestion(event, context)
            elif 'body' in event or 'query' in event:
                # API Gateway event - retrieval or presigned URL
                logger.info("API Gateway event detected - routing to retrieval")
                return self._handle_retrieval(event, context)
            else:
                # Direct invocation
                logger.info("Direct invocation - routing to retrieval")
                return self._handle_retrieval(event, context)
                
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
    
    def _handle_document_ingestion(self, event: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Handle document ingestion by calling AgentToolkit Lambda"""
        try:
            # Call the AgentToolkit Lambda function
            response = self.lambda_client.invoke(
                FunctionName=self.agent_lambda_name,
                InvocationType='RequestResponse',
                Payload=json.dumps(event)
            )
            
            # Parse response
            payload = response['Payload'].read()
            result = json.loads(payload)
            
            logger.info(f"AgentToolkit response: {json.dumps(result)}")
            return result
            
        except Exception as e:
            logger.error(f"Error in document ingestion: {e}")
            return {
                'statusCode': 500,
                'body': json.dumps({
                    'error': 'Document ingestion failed',
                    'message': str(e)
                })
            }
    
    def _handle_retrieval(self, event: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """Handle retrieval requests by calling AgentToolkit Lambda"""
        try:
            # Prepare the request for AgentToolkit
            if 'body' in event:
                body = json.loads(event['body'])
            else:
                body = event
            
            # Ensure the request has the correct format
            if 'query' not in body and 'action' not in body:
                # This might be a chat request from the existing system
                if 'message' in body:
                    body['query'] = body['message']
                    body['action'] = 'search'
            
            # Call the AgentToolkit Lambda function
            response = self.lambda_client.invoke(
                FunctionName=self.agent_lambda_name,
                InvocationType='RequestResponse',
                Payload=json.dumps(body)
            )
            
            # Parse response
            payload = response['Payload'].read()
            result = json.loads(payload)
            
            # Transform response to match existing system format
            if result.get('statusCode') == 200:
                body_data = json.loads(result.get('body', '{}'))
                
                # Map AgentToolkit response to existing system format
                transformed_response = {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'response': self._generate_response_from_context(body_data),
                        'sources': body_data.get('sources', []),
                        'conversation_id': body.get('conversation_id', ''),
                        'timestamp': datetime.utcnow().isoformat(),
                        'agent_processed': True
                    })
                }
                
                logger.info("Response transformed for existing system")
                return transformed_response
            else:
                return result
                
        except Exception as e:
            logger.error(f"Error in retrieval: {e}")
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'error': 'Retrieval failed',
                    'message': str(e)
                })
            }
    
    def _generate_response_from_context(self, body_data: Dict[str, Any]) -> str:
        """Generate a response from the retrieved context"""
        try:
            sources = body_data.get('sources', [])
            
            if not sources:
                return "I couldn't find any relevant information in the knowledge base for your query."
            
            # Create a response based on the retrieved sources
            response_parts = []
            
            # Add main response
            if len(sources) == 1:
                response_parts.append(f"Based on the available information: {sources[0].get('content', '')[:500]}...")
            else:
                response_parts.append(f"I found {len(sources)} relevant sources. Here's the most relevant information:")
                for i, source in enumerate(sources[:3], 1):  # Show top 3 sources
                    response_parts.append(f"{i}. {source.get('content', '')[:200]}...")
            
            # Add source information
            if sources:
                response_parts.append(f"\nThis information was retrieved from {len(sources)} document chunk(s).")
            
            return "\n".join(response_parts)
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return "I found some relevant information but had trouble processing it. Please try rephrasing your question."

def update_existing_orchestrator():
    """
    Function to update the existing orchestrator.py file
    This adds the AgentToolkit integration to the existing system
    """
    
    # Read the existing orchestrator file
    orchestrator_path = "/Users/bejoypramanick/iCloud Drive (Archive) - 1/Desktop/globistaan/projects/chatbot/knowledgebot/backend/lambda/orchestrator/orchestrator.py"
    
    try:
        with open(orchestrator_path, 'r') as f:
            content = f.read()
        
        # Add the integration import at the top
        integration_import = """
# AgentToolkit Integration
from agent_toolkit_integration import AgentToolkitIntegration
agent_integration = AgentToolkitIntegration()
"""
        
        # Find the imports section and add the integration
        if "from agent_toolkit_integration import AgentToolkitIntegration" not in content:
            # Add after the existing imports
            import_end = content.find("import logging")
            if import_end != -1:
                insert_pos = content.find("\n", import_end) + 1
                content = content[:insert_pos] + integration_import + content[insert_pos:]
        
        # Modify the lambda_handler function to use AgentToolkit for certain actions
        # This is a more sophisticated integration that preserves existing functionality
        
        # Add a new function to handle AgentToolkit routing
        agent_routing_function = """
def route_to_agent_toolkit(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    \"\"\"Route requests to AgentToolkit for enhanced processing\"\"\"
    try:
        # Check if this should be handled by AgentToolkit
        if 'body' in event:
            body = json.loads(event['body'])
            action = body.get('action', '')
            
            # Route specific actions to AgentToolkit
            if action in ['search', 'search_rag', 'get_document_content']:
                logger.info(f"Routing {action} to AgentToolkit")
                return agent_integration.route_to_agent_toolkit(event, context)
        
        # Check for S3 events (document ingestion)
        if 'Records' in event and event['Records']:
            record = event['Records'][0]
            if record.get('eventSource') == 'aws:s3':
                logger.info("Routing S3 event to AgentToolkit")
                return agent_integration.route_to_agent_toolkit(event, context)
        
        # For other actions, use existing logic
        return None
        
    except Exception as e:
        logger.error(f"Error in AgentToolkit routing: {e}")
        return None
"""
        
        # Add the routing function before the main lambda_handler
        if "def route_to_agent_toolkit" not in content:
            lambda_handler_pos = content.find("def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:")
            if lambda_handler_pos != -1:
                content = content[:lambda_handler_pos] + agent_routing_function + "\n\n" + content[lambda_handler_pos:]
        
        # Modify the lambda_handler to check for AgentToolkit routing first
        lambda_handler_start = content.find("def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:")
        if lambda_handler_start != -1:
            # Find the first line of the function body
            first_line_pos = content.find("try:", lambda_handler_start)
            if first_line_pos != -1:
                # Add AgentToolkit routing check
                agent_check = """
        # Check if request should be handled by AgentToolkit
        agent_result = route_to_agent_toolkit(event, context)
        if agent_result:
            return agent_result
        
        """
                content = content[:first_line_pos] + agent_check + content[first_line_pos:]
        
        # Write the updated content back
        with open(orchestrator_path, 'w') as f:
            f.write(content)
        
        print("✅ Successfully updated orchestrator.py with AgentToolkit integration")
        
    except Exception as e:
        print(f"❌ Error updating orchestrator.py: {e}")

def create_integration_file():
    """Create the integration file that will be imported by the orchestrator"""
    
    integration_content = '''"""
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
'''
    
    # Write the integration file
    integration_path = "/Users/bejoypramanick/iCloud Drive (Archive) - 1/Desktop/globistaan/projects/chatbot/knowledgebot/backend/lambda/orchestrator/agent_toolkit_integration.py"
    
    try:
        with open(integration_path, 'w') as f:
            f.write(integration_content)
        print("✅ Successfully created agent_toolkit_integration.py")
    except Exception as e:
        print(f"❌ Error creating integration file: {e}")

if __name__ == "__main__":
    print("🔧 Setting up AgentToolkit integration with existing system...")
    
    # Create the integration file
    create_integration_file()
    
    # Update the existing orchestrator
    update_existing_orchestrator()
    
    print("✅ AgentToolkit integration setup completed!")
    print("\n📋 Next steps:")
    print("1. Deploy the updated orchestrator Lambda function")
    print("2. Set the AGENT_LAMBDA_NAME environment variable to 'chatbot-agent-toolkit'")
    print("3. Test the integration by uploading documents and making queries")
    print("4. Monitor the logs to ensure proper routing between systems")
