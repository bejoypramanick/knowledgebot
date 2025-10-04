"""
Response Formatter Lambda - Format and structure responses
Responsibility: Format responses with proper structure, citations, and formatting
"""
import json
import boto3
import os
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ResponseFormatterService:
    def __init__(self):
        pass

    def format_chat_response(self, response_text: str, sources: List[Dict[str, Any]], 
                           conversation_id: str, include_sources: bool = True) -> Dict[str, Any]:
        """Format a chat response with sources and metadata"""
        try:
            # Format the response text
            formatted_text = self._format_response_text(response_text)
            
            # Format sources if provided
            formatted_sources = []
            if include_sources and sources:
                formatted_sources = self._format_sources(sources)
            
            # Create response structure
            response = {
                'response': formatted_text,
                'conversation_id': conversation_id,
                'timestamp': datetime.utcnow().isoformat(),
                'sources': formatted_sources,
                'source_count': len(formatted_sources),
                'formatted': True
            }
            
            # Add metadata
            response['metadata'] = {
                'has_sources': len(formatted_sources) > 0,
                'response_length': len(formatted_text),
                'word_count': len(formatted_text.split()),
                'formatted_at': datetime.utcnow().isoformat()
            }
            
            return response
            
        except Exception as e:
            logger.error(f"Error formatting chat response: {e}")
            return {
                'response': response_text,
                'conversation_id': conversation_id,
                'timestamp': datetime.utcnow().isoformat(),
                'sources': sources or [],
                'source_count': len(sources) if sources else 0,
                'formatted': False,
                'error': str(e)
            }

    def _format_response_text(self, text: str) -> str:
        """Format response text with proper formatting"""
        try:
            # Clean up the text
            formatted_text = text.strip()
            
            # Fix common formatting issues
            formatted_text = re.sub(r'\n\s*\n\s*\n', '\n\n', formatted_text)  # Remove excessive line breaks
            formatted_text = re.sub(r'[ \t]+', ' ', formatted_text)  # Normalize whitespace
            
            # Add proper paragraph breaks
            paragraphs = formatted_text.split('\n\n')
            formatted_paragraphs = []
            
            for paragraph in paragraphs:
                paragraph = paragraph.strip()
                if paragraph:
                    # Ensure proper sentence endings
                    if not paragraph.endswith(('.', '!', '?', ':')):
                        paragraph += '.'
                    formatted_paragraphs.append(paragraph)
            
            formatted_text = '\n\n'.join(formatted_paragraphs)
            
            return formatted_text
            
        except Exception as e:
            logger.error(f"Error formatting response text: {e}")
            return text

    def _format_sources(self, sources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Format sources with proper structure and metadata"""
        try:
            formatted_sources = []
            
            for i, source in enumerate(sources, 1):
                # Extract basic information
                chunk_id = source.get('chunk_id', f'source_{i}')
                content = source.get('content', '')
                similarity_score = source.get('similarity_score', 0.0)
                metadata = source.get('metadata', {})
                
                # Create formatted source
                formatted_source = {
                    'chunk_id': chunk_id,
                    'content': self._truncate_content(content, 300),
                    'full_content': content,
                    'similarity_score': round(similarity_score, 3),
                    'relevance_percentage': round(similarity_score * 100, 1),
                    'source': metadata.get('source', 'Unknown'),
                    'document_id': source.get('document_id', ''),
                    's3_key': metadata.get('s3_key', ''),
                    's3_bucket': source.get('s3_bucket', ''),
                    'original_filename': metadata.get('original_filename', ''),
                    'page_number': metadata.get('page_number', 0),
                    'element_type': metadata.get('element_type', 'text'),
                    'hierarchy_level': source.get('hierarchy_level', 0),
                    'processed_at': metadata.get('processed_at', ''),
                    'file_type': metadata.get('file_type', 'unknown'),
                    'language': metadata.get('language', 'en')
                }
                
                # Add visual information if available
                if 'position' in source:
                    formatted_source['position'] = source['position']
                    formatted_source['has_position'] = True
                else:
                    formatted_source['has_position'] = False
                
                # Add structural information
                formatted_source['is_heading'] = 'heading' in metadata.get('element_type', '').lower()
                formatted_source['is_table'] = 'table' in metadata.get('element_type', '').lower()
                formatted_source['is_figure'] = 'figure' in metadata.get('element_type', '').lower()
                
                # Add context information
                if 'keywords' in source:
                    formatted_source['keywords'] = source['keywords']
                if 'summary' in source:
                    formatted_source['summary'] = source['summary']
                
                formatted_sources.append(formatted_source)
            
            # Sort by similarity score
            formatted_sources.sort(key=lambda x: x['similarity_score'], reverse=True)
            
            return formatted_sources
            
        except Exception as e:
            logger.error(f"Error formatting sources: {e}")
            return sources

    def _truncate_content(self, content: str, max_length: int) -> str:
        """Truncate content to specified length with ellipsis"""
        try:
            if len(content) <= max_length:
                return content
            
            # Find the last complete word within the limit
            truncated = content[:max_length]
            last_space = truncated.rfind(' ')
            
            if last_space > max_length * 0.8:  # If we can find a good break point
                truncated = truncated[:last_space]
            
            return truncated + '...'
            
        except Exception as e:
            logger.error(f"Error truncating content: {e}")
            return content[:max_length] + '...' if len(content) > max_length else content

    def format_error_response(self, error_message: str, error_code: str = 'GENERIC_ERROR', 
                            conversation_id: str = '') -> Dict[str, Any]:
        """Format an error response"""
        try:
            return {
                'response': f"I apologize, but I encountered an error: {error_message}",
                'conversation_id': conversation_id,
                'timestamp': datetime.utcnow().isoformat(),
                'sources': [],
                'source_count': 0,
                'formatted': True,
                'error': {
                    'code': error_code,
                    'message': error_message,
                    'timestamp': datetime.utcnow().isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Error formatting error response: {e}")
            return {
                'response': "I apologize, but I encountered an error processing your request.",
                'conversation_id': conversation_id,
                'timestamp': datetime.utcnow().isoformat(),
                'sources': [],
                'source_count': 0,
                'formatted': False,
                'error': {
                    'code': 'FORMATTING_ERROR',
                    'message': str(e)
                }
            }

    def format_clarification_response(self, clarification_text: str, conversation_id: str) -> Dict[str, Any]:
        """Format a clarification response"""
        try:
            return {
                'response': clarification_text,
                'conversation_id': conversation_id,
                'timestamp': datetime.utcnow().isoformat(),
                'sources': [],
                'source_count': 0,
                'formatted': True,
                'needs_clarification': True,
                'metadata': {
                    'response_type': 'clarification',
                    'has_sources': False,
                    'response_length': len(clarification_text),
                    'word_count': len(clarification_text.split())
                }
            }
            
        except Exception as e:
            logger.error(f"Error formatting clarification response: {e}")
            return {
                'response': clarification_text,
                'conversation_id': conversation_id,
                'timestamp': datetime.utcnow().isoformat(),
                'sources': [],
                'source_count': 0,
                'formatted': False,
                'needs_clarification': True,
                'error': str(e)
            }

    def format_search_results(self, search_results: List[Dict[str, Any]], query: str) -> Dict[str, Any]:
        """Format search results for display"""
        try:
            formatted_results = []
            
            for i, result in enumerate(search_results, 1):
                formatted_result = {
                    'rank': i,
                    'chunk_id': result.get('chunk_id', f'result_{i}'),
                    'content': self._truncate_content(result.get('content', ''), 200),
                    'similarity_score': round(result.get('similarity_score', 0.0), 3),
                    'relevance_percentage': round(result.get('similarity_score', 0.0) * 100, 1),
                    'source': result.get('metadata', {}).get('source', 'Unknown'),
                    'page_number': result.get('metadata', {}).get('page_number', 0),
                    'element_type': result.get('metadata', {}).get('element_type', 'text'),
                    'document_id': result.get('document_id', '')
                }
                formatted_results.append(formatted_result)
            
            return {
                'query': query,
                'results': formatted_results,
                'count': len(formatted_results),
                'formatted': True,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error formatting search results: {e}")
            return {
                'query': query,
                'results': search_results,
                'count': len(search_results),
                'formatted': False,
                'error': str(e)
            }

    def format_document_list(self, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Format document list for display"""
        try:
            formatted_documents = []
            
            for doc in documents:
                formatted_doc = {
                    'document_id': doc.get('document_id', ''),
                    'source': doc.get('source', 'Unknown'),
                    'original_filename': doc.get('original_filename', ''),
                    'file_type': doc.get('file_type', 'unknown'),
                    'chunk_count': doc.get('chunk_count', 0),
                    'processed_at': doc.get('processed_at', ''),
                    's3_key': doc.get('s3_key', ''),
                    'language': doc.get('language', 'en')
                }
                formatted_documents.append(formatted_doc)
            
            # Sort by processed_at (newest first)
            formatted_documents.sort(key=lambda x: x.get('processed_at', ''), reverse=True)
            
            return {
                'documents': formatted_documents,
                'count': len(formatted_documents),
                'formatted': True,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error formatting document list: {e}")
            return {
                'documents': documents,
                'count': len(documents),
                'formatted': False,
                'error': str(e)
            }

    def add_citations_to_response(self, response_text: str, sources: List[Dict[str, Any]]) -> str:
        """Add citation markers to response text"""
        try:
            if not sources:
                return response_text
            
            # Simple citation addition - can be enhanced with more sophisticated matching
            cited_response = response_text
            
            # Add source references at the end
            if sources:
                cited_response += "\n\n**Sources:**\n"
                for i, source in enumerate(sources[:5], 1):  # Limit to top 5 sources
                    source_name = source.get('source', 'Unknown')
                    page_number = source.get('page_number', 0)
                    if page_number > 0:
                        cited_response += f"{i}. {source_name} (Page {page_number})\n"
                    else:
                        cited_response += f"{i}. {source_name}\n"
            
            return cited_response
            
        except Exception as e:
            logger.error(f"Error adding citations to response: {e}")
            return response_text

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for response formatting operations"""
    try:
        logger.info(f"Response Formatter event: {json.dumps(event)}")
        
        # Handle direct API calls
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        action = body.get('action', '')
        logger.info(f"Action: {action}")
        
        formatter = ResponseFormatterService()
        
        if action == 'format_chat_response':
            response_text = body.get('response_text', '')
            sources = body.get('sources', [])
            conversation_id = body.get('conversation_id', '')
            include_sources = body.get('include_sources', True)
            
            if not response_text:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'response_text is required'
                    })
                }
            
            logger.info(f"Formatting chat response for conversation {conversation_id}")
            
            # Format chat response
            formatted_response = formatter.format_chat_response(
                response_text, sources, conversation_id, include_sources
            )
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps(formatted_response)
            }
        
        elif action == 'format_error_response':
            error_message = body.get('error_message', 'An unknown error occurred')
            error_code = body.get('error_code', 'GENERIC_ERROR')
            conversation_id = body.get('conversation_id', '')
            
            logger.info(f"Formatting error response: {error_code}")
            
            # Format error response
            formatted_response = formatter.format_error_response(
                error_message, error_code, conversation_id
            )
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps(formatted_response)
            }
        
        elif action == 'format_clarification_response':
            clarification_text = body.get('clarification_text', '')
            conversation_id = body.get('conversation_id', '')
            
            if not clarification_text:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'clarification_text is required'
                    })
                }
            
            logger.info(f"Formatting clarification response for conversation {conversation_id}")
            
            # Format clarification response
            formatted_response = formatter.format_clarification_response(
                clarification_text, conversation_id
            )
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps(formatted_response)
            }
        
        elif action == 'format_search_results':
            search_results = body.get('search_results', [])
            query = body.get('query', '')
            
            logger.info(f"Formatting {len(search_results)} search results for query: {query}")
            
            # Format search results
            formatted_results = formatter.format_search_results(search_results, query)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps(formatted_results)
            }
        
        elif action == 'format_document_list':
            documents = body.get('documents', [])
            
            logger.info(f"Formatting {len(documents)} documents")
            
            # Format document list
            formatted_documents = formatter.format_document_list(documents)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps(formatted_documents)
            }
        
        elif action == 'add_citations_to_response':
            response_text = body.get('response_text', '')
            sources = body.get('sources', [])
            
            if not response_text:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'response_text is required'
                    })
                }
            
            logger.info("Adding citations to response")
            
            # Add citations to response
            cited_response = formatter.add_citations_to_response(response_text, sources)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'response_text': cited_response,
                    'sources': sources,
                    'citation_count': len(sources)
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
                    'message': f'Action "{action}" not supported. Supported: format_chat_response, format_error_response, format_clarification_response, format_search_results, format_document_list, add_citations_to_response'
                })
            }
        
    except Exception as e:
        logger.error(f"Error in response formatter service: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': 'Response formatter service failed',
                'message': str(e)
            })
        }
