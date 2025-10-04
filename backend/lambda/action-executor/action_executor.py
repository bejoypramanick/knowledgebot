"""
Action Executor Lambda - Executes planned actions
Responsibility: Execute individual actions by calling appropriate microservices
"""
import json
import boto3
import os
import time
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import logging
import sys
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor

# Note: Shared utilities not available in this deployment
# from error_handler import error_handler, ErrorHandler, ErrorType, ErrorSeverity, ExternalServiceError, ValidationError, retry_with_backoff, claude_circuit_breaker, dynamodb_circuit_breaker, s3_circuit_breaker

# Simple retry decorator
def retry_with_backoff(max_retries: int = 3, base_delay: float = 1.0, max_delay: float = 10.0):
    def decorator(func):
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise e
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
                    time.sleep(delay)
            return func(*args, **kwargs)
        return wrapper
    return decorator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
RAG_SEARCH_LAMBDA = os.environ.get('RAG_SEARCH_LAMBDA', 'chatbot-rag-search')
DOCUMENT_METADATA_LAMBDA = os.environ.get('DOCUMENT_METADATA_LAMBDA', 'chatbot-document-metadata')
DOCUMENT_CONTENT_LAMBDA = os.environ.get('DOCUMENT_CONTENT_LAMBDA', 'chatbot-document-content')
EMBEDDING_SERVICE_LAMBDA = os.environ.get('EMBEDDING_SERVICE_LAMBDA', 'chatbot-embedding-service')
VECTOR_SEARCH_LAMBDA = os.environ.get('VECTOR_SEARCH_LAMBDA', 'chatbot-vector-search')

# Pydantic models
class LambdaAction(BaseModel):
    action_type: str = Field(..., description="Type of action")
    parameters: Dict[str, Any] = Field(default={}, description="Action parameters")
    priority: int = Field(default=1, description="Action priority (1=highest)")
    can_parallelize: bool = Field(default=True, description="Whether this action can run in parallel")
    depends_on: List[str] = Field(default=[], description="Action IDs this action depends on")

class ActionResult(BaseModel):
    action_type: str
    success: bool
    result: Dict[str, Any]
    error: Optional[str] = None
    execution_time: float = 0.0
    retry_count: int = 0

class ActionExecutorService:
    def __init__(self):
        self.lambda_client = boto3.client('lambda', region_name='ap-south-1')

    @retry_with_backoff(max_retries=3, base_delay=1.0, max_delay=10.0)
    def call_lambda_service(self, function_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Call a lambda service with retry logic and circuit breaker"""
        try:
            response = self.lambda_client.invoke(
                FunctionName=function_name,
                InvocationType='RequestResponse',
                Payload=json.dumps(payload)
            )
            
            result = json.loads(response['Payload'].read())
            
            if result.get('statusCode') != 200:
                raise Exception(f"Lambda {function_name} returned error: {result.get('body', 'Unknown error')}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error calling {function_name}: {e}")
            raise Exception(f"Failed to call {function_name}: {str(e)}")

    def execute_search_rag_action(self, action: LambdaAction) -> ActionResult:
        """Execute RAG search action"""
        start_time = time.time()
        try:
            query = action.parameters.get("query", "")
            limit = action.parameters.get("limit", 5)
            
            if not query:
                raise ValidationError("Query parameter is required for search_rag", 
                    ErrorHandler.classify_error(ValueError("Missing query"), "action-executor", "execute_search_rag_action"))
            
            result = self.call_lambda_service(RAG_SEARCH_LAMBDA, {
                'action': 'search',
                'query': query,
                'limit': limit
            })
            
            return ActionResult(
                action_type="search_rag",
                success=True,
                result=result,
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            error_context = ErrorHandler.classify_error(e, "action-executor", "execute_search_rag_action")
            ErrorHandler.log_error(error_context, e, {'action': action.dict()})
            return ActionResult(
                action_type="search_rag",
                success=False,
                result={},
                error=str(e),
                execution_time=time.time() - start_time
            )

    def execute_list_documents_action(self, action: LambdaAction) -> ActionResult:
        """Execute list documents action"""
        start_time = time.time()
        try:
            limit = action.parameters.get("limit", 10)
            
            result = self.call_lambda_service(DOCUMENT_METADATA_LAMBDA, {
                'action': 'list_documents',
                'limit': limit
            })
            
            return ActionResult(
                action_type="list_documents",
                success=True,
                result=result,
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            error_context = ErrorHandler.classify_error(e, "action-executor", "execute_list_documents_action")
            ErrorHandler.log_error(error_context, e, {'action': action.dict()})
            return ActionResult(
                action_type="list_documents",
                success=False,
                result={},
                error=str(e),
                execution_time=time.time() - start_time
            )

    def execute_generate_embeddings_action(self, action: LambdaAction) -> ActionResult:
        """Execute generate embeddings action"""
        start_time = time.time()
        try:
            text = action.parameters.get("text", "")
            
            if not text:
                raise ValidationError("Text parameter is required for generate_embeddings", 
                    ErrorHandler.classify_error(ValueError("Missing text"), "action-executor", "execute_generate_embeddings_action"))
            
            result = self.call_lambda_service(EMBEDDING_SERVICE_LAMBDA, {
                'action': 'generate_embeddings',
                'text': text
            })
            
            return ActionResult(
                action_type="generate_embeddings",
                success=True,
                result=result,
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            error_context = ErrorHandler.classify_error(e, "action-executor", "execute_generate_embeddings_action")
            ErrorHandler.log_error(error_context, e, {'action': action.dict()})
            return ActionResult(
                action_type="generate_embeddings",
                success=False,
                result={},
                error=str(e),
                execution_time=time.time() - start_time
            )

    def execute_get_document_content_action(self, action: LambdaAction) -> ActionResult:
        """Execute get document content action"""
        start_time = time.time()
        try:
            document_id = action.parameters.get("document_id", "")
            
            if not document_id:
                raise ValidationError("Document ID parameter is required for get_document_content", 
                    ErrorHandler.classify_error(ValueError("Missing document_id"), "action-executor", "execute_get_document_content_action"))
            
            result = self.call_lambda_service(DOCUMENT_CONTENT_LAMBDA, {
                'action': 'get_document_content',
                'document_id': document_id
            })
            
            return ActionResult(
                action_type="get_document_content",
                success=True,
                result=result,
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            error_context = ErrorHandler.classify_error(e, "action-executor", "execute_get_document_content_action")
            ErrorHandler.log_error(error_context, e, {'action': action.dict()})
            return ActionResult(
                action_type="get_document_content",
                success=False,
                result={},
                error=str(e),
                execution_time=time.time() - start_time
            )

    def execute_simple_response_action(self, action: LambdaAction) -> ActionResult:
        """Execute simple response action (no external calls)"""
        start_time = time.time()
        try:
            response_text = action.parameters.get("response_text", "")
            
            if not response_text:
                raise ValidationError("Response text parameter is required for simple_response", 
                    ErrorHandler.classify_error(ValueError("Missing response_text"), "action-executor", "execute_simple_response_action"))
            
            return ActionResult(
                action_type="simple_response",
                success=True,
                result={
                    'response': response_text,
                    'sources': []
                },
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            error_context = ErrorHandler.classify_error(e, "action-executor", "execute_simple_response_action")
            ErrorHandler.log_error(error_context, e, {'action': action.dict()})
            return ActionResult(
                action_type="simple_response",
                success=False,
                result={},
                error=str(e),
                execution_time=time.time() - start_time
            )

    def execute_single_action(self, action: LambdaAction) -> ActionResult:
        """Execute a single action based on its type"""
        action_type = action.action_type
        
        if action_type == "search_rag":
            return self.execute_search_rag_action(action)
        elif action_type == "list_documents":
            return self.execute_list_documents_action(action)
        elif action_type == "generate_embeddings":
            return self.execute_generate_embeddings_action(action)
        elif action_type == "get_document_content":
            return self.execute_get_document_content_action(action)
        elif action_type == "simple_response":
            return self.execute_simple_response_action(action)
        else:
            error_context = ErrorHandler.classify_error(ValueError(f"Unknown action type: {action_type}"), "action-executor", "execute_single_action")
            return ActionResult(
                action_type=action_type,
                success=False,
                result={},
                error=f"Unknown action type: {action_type}",
                execution_time=0.0
            )

    def execute_actions_parallel(self, actions: List[LambdaAction]) -> List[ActionResult]:
        """Execute actions in parallel"""
        results = []
        
        with ThreadPoolExecutor(max_workers=min(len(actions), 5)) as executor:
            # Submit all actions for parallel execution
            future_to_action = {
                executor.submit(self.execute_single_action, action): action 
                for action in actions
            }
            
            # Collect results as they complete
            for future in concurrent.futures.as_completed(future_to_action):
                action = future_to_action[future]
                try:
                    result = future.result()
                    results.append(result)
                    logger.info(f"Completed parallel action: {action.action_type}")
                except Exception as e:
                    error_context = ErrorHandler.classify_error(e, "action-executor", "execute_actions_parallel")
                    ErrorHandler.log_error(error_context, e, {'action': action.dict()})
                    results.append(ActionResult(
                        action_type=action.action_type,
                        success=False,
                        result={},
                        error=str(e),
                        execution_time=0.0
                    ))
        
        return results

    def execute_actions_sequential(self, actions: List[LambdaAction]) -> List[ActionResult]:
        """Execute actions sequentially"""
        results = []
        
        for action in actions:
            try:
                result = self.execute_single_action(action)
                results.append(result)
                logger.info(f"Completed sequential action: {action.action_type}")
            except Exception as e:
                error_context = ErrorHandler.classify_error(e, "action-executor", "execute_actions_sequential")
                ErrorHandler.log_error(error_context, e, {'action': action.dict()})
                results.append(ActionResult(
                    action_type=action.action_type,
                    success=False,
                    result={},
                    error=str(e),
                    execution_time=0.0
                ))
        
        return results

    @error_handler("action-executor", "execute_actions")
    def execute_actions(self, actions: List[LambdaAction], execution_type: str = "parallel") -> Dict[str, Any]:
        """Execute a list of actions with specified execution type"""
        try:
            if not actions:
                return {
                    'results': [],
                    'execution_type': execution_type,
                    'total_actions': 0,
                    'successful_actions': 0,
                    'failed_actions': 0
                }
            
            # Validate execution type
            if execution_type not in ["parallel", "sequential"]:
                raise ValidationError(f"Invalid execution type: {execution_type}", 
                    ErrorHandler.classify_error(ValueError("Invalid execution type"), "action-executor", "execute_actions"))
            
            # Execute actions based on type
            if execution_type == "parallel":
                results = self.execute_actions_parallel(actions)
            else:
                results = self.execute_actions_sequential(actions)
            
            # Calculate statistics
            successful_actions = sum(1 for r in results if r.success)
            failed_actions = len(results) - successful_actions
            
            return {
                'results': [result.dict() for result in results],
                'execution_type': execution_type,
                'total_actions': len(actions),
                'successful_actions': successful_actions,
                'failed_actions': failed_actions,
                'execution_time': sum(r.execution_time for r in results)
            }
            
        except (ValidationError, ExternalServiceError):
            # Re-raise custom errors
            raise
        except Exception as e:
            error_context = ErrorHandler.classify_error(e, "action-executor", "execute_actions")
            raise ExternalServiceError(f"Action execution failed: {str(e)}", error_context)

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for action execution"""
    try:
        logger.info(f"Action Executor event: {json.dumps(event)}")
        
        # Handle OPTIONS request for CORS preflight
        if event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Max-Age': '86400'
                },
                'body': ''
            }
        
        # Parse the request
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        action = body.get('action', '')
        
        if action != 'execute_actions':
            return ErrorHandler.create_error_response(
                ErrorHandler.classify_error(ValueError("Invalid action"), "action-executor", "lambda_handler"),
                f"Action '{action}' not supported. Expected 'execute_actions'",
                status_code=400
            )
        
        # Parse actions and execution type
        actions_data = body.get('actions', [])
        execution_type = body.get('execution_type', 'parallel')
        
        if not actions_data:
            return ErrorHandler.create_error_response(
                ErrorHandler.classify_error(ValueError("Missing actions"), "action-executor", "lambda_handler"),
                "actions list is required",
                status_code=400
            )
        
        # Convert to LambdaAction objects
        try:
            actions = [LambdaAction(**action_data) for action_data in actions_data]
        except Exception as e:
            return ErrorHandler.create_error_response(
                ErrorHandler.classify_error(e, "action-executor", "lambda_handler"),
                f"Invalid action format: {str(e)}",
                status_code=400
            )
        
        # Initialize service and execute actions
        service = ActionExecutorService()
        result = service.execute_actions(actions, execution_type)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'result': result,
                'success': True,
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    except (ValidationError, ExternalServiceError) as e:
        # Handle custom errors
        return ErrorHandler.create_error_response(
            e.error_context, 
            e.message,
            status_code=400 if e.error_context.error_type == ErrorType.VALIDATION_ERROR else 500
        )
    except Exception as e:
        # Handle unexpected errors
        error_context = ErrorHandler.classify_error(e, "action-executor", "lambda_handler")
        ErrorHandler.log_error(error_context, e)
        return ErrorHandler.create_error_response(error_context, str(e), status_code=500)
