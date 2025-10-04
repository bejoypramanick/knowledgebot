"""
Conversation Manager Lambda - Manage conversation history and context
Responsibility: Store, retrieve, and manage conversation history
"""
import json
import boto3
import os
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime, timedelta
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
CONVERSATIONS_TABLE = os.environ.get('CONVERSATIONS_TABLE', 'chatbot-conversations')

class ConversationManagerService:
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
        self.conversations_table = self.dynamodb.Table(CONVERSATIONS_TABLE)

    def create_conversation(self, user_id: str = None, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create a new conversation"""
        try:
            conversation_id = f"conv_{uuid.uuid4().hex[:12]}"
            timestamp = datetime.utcnow().isoformat()
            
            conversation = {
                'conversation_id': conversation_id,
                'user_id': user_id or 'anonymous',
                'created_at': timestamp,
                'updated_at': timestamp,
                'message_count': 0,
                'status': 'active',
                'metadata': metadata or {},
                'messages': []
            }
            
            # Store in DynamoDB
            self.conversations_table.put_item(Item=conversation)
            
            logger.info(f"Created conversation {conversation_id}")
            return conversation
            
        except Exception as e:
            logger.error(f"Error creating conversation: {e}")
            return {
                'conversation_id': f"conv_{uuid.uuid4().hex[:12]}",
                'user_id': user_id or 'anonymous',
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
                'message_count': 0,
                'status': 'active',
                'metadata': metadata or {},
                'messages': [],
                'error': str(e)
            }

    def get_conversation(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """Get a conversation by ID"""
        try:
            response = self.conversations_table.get_item(
                Key={'conversation_id': conversation_id}
            )
            
            if 'Item' in response:
                return response['Item']
            else:
                logger.info(f"Conversation {conversation_id} not found")
                return None
                
        except Exception as e:
            logger.error(f"Error getting conversation {conversation_id}: {e}")
            return None

    def add_message(self, conversation_id: str, message: Dict[str, Any]) -> bool:
        """Add a message to a conversation"""
        try:
            # Get current conversation
            conversation = self.get_conversation(conversation_id)
            if not conversation:
                logger.warning(f"Conversation {conversation_id} not found")
                return False
            
            # Add message with timestamp
            message['timestamp'] = datetime.utcnow().isoformat()
            message['message_id'] = f"msg_{uuid.uuid4().hex[:8]}"
            
            # Add to messages list
            messages = conversation.get('messages', [])
            messages.append(message)
            
            # Update conversation
            self.conversations_table.update_item(
                Key={'conversation_id': conversation_id},
                UpdateExpression='SET messages = :messages, message_count = :count, updated_at = :updated',
                ExpressionAttributeValues={
                    ':messages': messages,
                    ':count': len(messages),
                    ':updated': datetime.utcnow().isoformat()
                }
            )
            
            logger.info(f"Added message to conversation {conversation_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error adding message to conversation {conversation_id}: {e}")
            return False

    def get_conversation_messages(self, conversation_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get messages from a conversation"""
        try:
            conversation = self.get_conversation(conversation_id)
            if not conversation:
                return []
            
            messages = conversation.get('messages', [])
            
            # Return last N messages
            if limit > 0:
                messages = messages[-limit:]
            
            return messages
            
        except Exception as e:
            logger.error(f"Error getting messages for conversation {conversation_id}: {e}")
            return []

    def get_conversation_context(self, conversation_id: str, context_length: int = 10) -> str:
        """Get conversation context as a formatted string"""
        try:
            messages = self.get_conversation_messages(conversation_id, context_length)
            
            if not messages:
                return ""
            
            context_parts = []
            for message in messages:
                role = message.get('role', 'user')
                content = message.get('content', '')
                timestamp = message.get('timestamp', '')
                
                if role == 'user':
                    context_parts.append(f"User: {content}")
                elif role == 'assistant':
                    context_parts.append(f"Assistant: {content}")
                else:
                    context_parts.append(f"{role.title()}: {content}")
            
            return "\n".join(context_parts)
            
        except Exception as e:
            logger.error(f"Error getting conversation context for {conversation_id}: {e}")
            return ""

    def update_conversation_metadata(self, conversation_id: str, metadata_updates: Dict[str, Any]) -> bool:
        """Update conversation metadata"""
        try:
            conversation = self.get_conversation(conversation_id)
            if not conversation:
                return False
            
            # Merge metadata
            current_metadata = conversation.get('metadata', {})
            updated_metadata = {**current_metadata, **metadata_updates}
            
            # Update conversation
            self.conversations_table.update_item(
                Key={'conversation_id': conversation_id},
                UpdateExpression='SET metadata = :metadata, updated_at = :updated',
                ExpressionAttributeValues={
                    ':metadata': updated_metadata,
                    ':updated': datetime.utcnow().isoformat()
                }
            )
            
            logger.info(f"Updated metadata for conversation {conversation_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating conversation metadata for {conversation_id}: {e}")
            return False

    def close_conversation(self, conversation_id: str) -> bool:
        """Close a conversation"""
        try:
            conversation = self.get_conversation(conversation_id)
            if not conversation:
                return False
            
            # Update conversation status
            self.conversations_table.update_item(
                Key={'conversation_id': conversation_id},
                UpdateExpression='SET #status = :status, updated_at = :updated',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':status': 'closed',
                    ':updated': datetime.utcnow().isoformat()
                }
            )
            
            logger.info(f"Closed conversation {conversation_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error closing conversation {conversation_id}: {e}")
            return False

    def list_user_conversations(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """List conversations for a user"""
        try:
            # Query conversations by user_id
            response = self.conversations_table.query(
                IndexName='user-id-index',
                KeyConditionExpression='user_id = :user_id',
                ExpressionAttributeValues={':user_id': user_id},
                ScanIndexForward=False,  # Sort by created_at descending
                Limit=limit
            )
            
            conversations = response.get('Items', [])
            
            # Remove messages from list view to reduce payload
            for conv in conversations:
                conv['message_count'] = len(conv.get('messages', []))
                conv.pop('messages', None)  # Remove full messages
            
            return conversations
            
        except Exception as e:
            logger.error(f"Error listing conversations for user {user_id}: {e}")
            return []

    def search_conversations(self, query: str, user_id: str = None, limit: int = 20) -> List[Dict[str, Any]]:
        """Search conversations by content"""
        try:
            # Scan conversations table
            scan_kwargs = {
                'FilterExpression': 'contains(messages, :query)',
                'ExpressionAttributeValues': {':query': query}
            }
            
            if user_id:
                scan_kwargs['FilterExpression'] += ' AND user_id = :user_id'
                scan_kwargs['ExpressionAttributeValues'][':user_id'] = user_id
            
            response = self.conversations_table.scan(**scan_kwargs)
            conversations = response.get('Items', [])
            
            # Sort by updated_at descending
            conversations.sort(key=lambda x: x.get('updated_at', ''), reverse=True)
            
            # Limit results
            conversations = conversations[:limit]
            
            # Remove messages from search results
            for conv in conversations:
                conv['message_count'] = len(conv.get('messages', []))
                conv.pop('messages', None)
            
            return conversations
            
        except Exception as e:
            logger.error(f"Error searching conversations: {e}")
            return []

    def cleanup_old_conversations(self, days_old: int = 30) -> int:
        """Clean up old conversations"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)
            cutoff_iso = cutoff_date.isoformat()
            
            # Scan for old conversations
            response = self.conversations_table.scan(
                FilterExpression='updated_at < :cutoff',
                ExpressionAttributeValues={':cutoff': cutoff_iso}
            )
            
            old_conversations = response.get('Items', [])
            deleted_count = 0
            
            # Delete old conversations
            for conv in old_conversations:
                try:
                    self.conversations_table.delete_item(
                        Key={'conversation_id': conv['conversation_id']}
                    )
                    deleted_count += 1
                except Exception as e:
                    logger.warning(f"Error deleting conversation {conv['conversation_id']}: {e}")
            
            logger.info(f"Cleaned up {deleted_count} old conversations")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error cleaning up old conversations: {e}")
            return 0

    def get_conversation_stats(self, conversation_id: str) -> Dict[str, Any]:
        """Get conversation statistics"""
        try:
            conversation = self.get_conversation(conversation_id)
            if not conversation:
                return {}
            
            messages = conversation.get('messages', [])
            
            # Calculate stats
            user_messages = [m for m in messages if m.get('role') == 'user']
            assistant_messages = [m for m in messages if m.get('role') == 'assistant']
            
            total_chars = sum(len(m.get('content', '')) for m in messages)
            total_words = sum(len(m.get('content', '').split()) for m in messages)
            
            return {
                'conversation_id': conversation_id,
                'total_messages': len(messages),
                'user_messages': len(user_messages),
                'assistant_messages': len(assistant_messages),
                'total_characters': total_chars,
                'total_words': total_words,
                'average_message_length': total_chars / len(messages) if messages else 0,
                'created_at': conversation.get('created_at'),
                'updated_at': conversation.get('updated_at'),
                'status': conversation.get('status'),
                'message_count': conversation.get('message_count', 0)
            }
            
        except Exception as e:
            logger.error(f"Error getting conversation stats for {conversation_id}: {e}")
            return {}

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for conversation management operations"""
    try:
        logger.info(f"Conversation Manager event: {json.dumps(event)}")
        
        # Handle direct API calls
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        action = body.get('action', '')
        logger.info(f"Action: {action}")
        
        conversation_manager = ConversationManagerService()
        
        if action == 'create_conversation':
            user_id = body.get('user_id')
            metadata = body.get('metadata', {})
            
            logger.info(f"Creating conversation for user: {user_id}")
            
            # Create conversation
            conversation = conversation_manager.create_conversation(user_id, metadata)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps(conversation)
            }
        
        elif action == 'get_conversation':
            conversation_id = body.get('conversation_id', '')
            
            if not conversation_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'conversation_id is required'
                    })
                }
            
            logger.info(f"Getting conversation: {conversation_id}")
            
            # Get conversation
            conversation = conversation_manager.get_conversation(conversation_id)
            
            if conversation:
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps(conversation)
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
                        'error': 'Conversation not found',
                        'conversation_id': conversation_id
                    })
                }
        
        elif action == 'add_message':
            conversation_id = body.get('conversation_id', '')
            message = body.get('message', {})
            
            if not conversation_id or not message:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'conversation_id and message are required'
                    })
                }
            
            logger.info(f"Adding message to conversation: {conversation_id}")
            
            # Add message
            success = conversation_manager.add_message(conversation_id, message)
            
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
                        'conversation_id': conversation_id,
                        'message': 'Message added successfully'
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
                        'error': 'Failed to add message',
                        'conversation_id': conversation_id
                    })
                }
        
        elif action == 'get_conversation_messages':
            conversation_id = body.get('conversation_id', '')
            limit = body.get('limit', 50)
            
            if not conversation_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'conversation_id is required'
                    })
                }
            
            logger.info(f"Getting messages for conversation: {conversation_id}")
            
            # Get messages
            messages = conversation_manager.get_conversation_messages(conversation_id, limit)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'conversation_id': conversation_id,
                    'messages': messages,
                    'count': len(messages)
                })
            }
        
        elif action == 'get_conversation_context':
            conversation_id = body.get('conversation_id', '')
            context_length = body.get('context_length', 10)
            
            if not conversation_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'conversation_id is required'
                    })
                }
            
            logger.info(f"Getting context for conversation: {conversation_id}")
            
            # Get context
            context = conversation_manager.get_conversation_context(conversation_id, context_length)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'conversation_id': conversation_id,
                    'context': context,
                    'context_length': context_length
                })
            }
        
        elif action == 'list_user_conversations':
            user_id = body.get('user_id', '')
            limit = body.get('limit', 20)
            
            if not user_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'user_id is required'
                    })
                }
            
            logger.info(f"Listing conversations for user: {user_id}")
            
            # List conversations
            conversations = conversation_manager.list_user_conversations(user_id, limit)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'user_id': user_id,
                    'conversations': conversations,
                    'count': len(conversations)
                })
            }
        
        elif action == 'get_conversation_stats':
            conversation_id = body.get('conversation_id', '')
            
            if not conversation_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'conversation_id is required'
                    })
                }
            
            logger.info(f"Getting stats for conversation: {conversation_id}")
            
            # Get stats
            stats = conversation_manager.get_conversation_stats(conversation_id)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps(stats)
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
                    'message': f'Action "{action}" not supported. Supported: create_conversation, get_conversation, add_message, get_conversation_messages, get_conversation_context, list_user_conversations, get_conversation_stats'
                })
            }
        
    except Exception as e:
        logger.error(f"Error in conversation manager service: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': 'Conversation manager service failed',
                'message': str(e)
            })
        }
