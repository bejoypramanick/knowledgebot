"""
Source Extractor Lambda - Extract and process source information
Responsibility: Extract source metadata and context from search results
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

# Configuration
MAIN_BUCKET = os.environ.get('MAIN_BUCKET', 'chatbot-storage-ap-south-1')
KNOWLEDGE_BASE_TABLE = os.environ.get('KNOWLEDGE_BASE_TABLE', 'chatbot-knowledge-base')

class SourceExtractorService:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name='ap-south-1')
        self.dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
        self.main_bucket = MAIN_BUCKET
        self.knowledge_base_table = self.dynamodb.Table(KNOWLEDGE_BASE_TABLE)

    def extract_source_metadata(self, search_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract and enhance source metadata from search results"""
        try:
            enhanced_sources = []
            
            for result in search_results:
                # Extract basic metadata
                chunk_id = result.get('chunk_id', '')
                content = result.get('content', '')
                metadata = result.get('metadata', {})
                similarity_score = result.get('similarity_score', 0.0)
                
                # Extract source information
                source_info = {
                    'chunk_id': chunk_id,
                    'content': content,
                    'similarity_score': similarity_score,
                    'source': metadata.get('source', 'Unknown'),
                    'document_id': result.get('document_id', ''),
                    's3_key': metadata.get('s3_key', ''),
                    's3_bucket': self.main_bucket,
                    'original_filename': metadata.get('original_filename', ''),
                    'page_number': metadata.get('page_number', 0),
                    'element_type': metadata.get('element_type', 'text'),
                    'hierarchy_level': result.get('hierarchy_level', 0),
                    'parent_id': result.get('parent_id'),
                    'processed_at': metadata.get('processed_at', ''),
                    'file_type': metadata.get('file_type', 'unknown'),
                    'language': metadata.get('language', 'en')
                }
                
                # Extract additional context
                context_info = self._extract_context_info(content, metadata)
                source_info.update(context_info)
                
                # Extract visual information if available
                visual_info = self._extract_visual_info(metadata)
                source_info.update(visual_info)
                
                # Extract structural information
                structural_info = self._extract_structural_info(result, metadata)
                source_info.update(structural_info)
                
                enhanced_sources.append(source_info)
            
            return enhanced_sources
            
        except Exception as e:
            logger.error(f"Error extracting source metadata: {e}")
            return []

    def _extract_context_info(self, content: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Extract contextual information from content and metadata"""
        try:
            context_info = {}
            
            # Extract key phrases (simple keyword extraction)
            words = re.findall(r'\b\w+\b', content.lower())
            word_freq = {}
            for word in words:
                if len(word) > 3:  # Only consider words longer than 3 characters
                    word_freq[word] = word_freq.get(word, 0) + 1
            
            # Get top keywords
            top_keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:5]
            context_info['keywords'] = [word for word, freq in top_keywords]
            
            # Extract sentences (simple sentence splitting)
            sentences = re.split(r'[.!?]+', content)
            sentences = [s.strip() for s in sentences if s.strip()]
            context_info['sentence_count'] = len(sentences)
            
            # Extract first sentence as summary
            if sentences:
                context_info['summary'] = sentences[0][:200] + '...' if len(sentences[0]) > 200 else sentences[0]
            
            # Extract word count
            context_info['word_count'] = len(words)
            context_info['character_count'] = len(content)
            
            # Extract reading time estimate (assuming 200 words per minute)
            context_info['estimated_reading_time'] = max(1, len(words) // 200)
            
            return context_info
            
        except Exception as e:
            logger.error(f"Error extracting context info: {e}")
            return {}

    def _extract_visual_info(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Extract visual information from metadata"""
        try:
            visual_info = {}
            
            # Check for bounding box information
            if 'bbox' in metadata:
                bbox = metadata['bbox']
                visual_info['has_position'] = True
                visual_info['position'] = {
                    'x': bbox.get('x', 0),
                    'y': bbox.get('y', 0),
                    'width': bbox.get('width', 0),
                    'height': bbox.get('height', 0)
                }
            else:
                visual_info['has_position'] = False
            
            # Check for color information
            if 'color' in metadata:
                visual_info['color'] = metadata['color']
            
            # Check for font information
            if 'font' in metadata:
                visual_info['font'] = metadata['font']
            
            # Check for size information
            if 'size' in metadata:
                visual_info['size'] = metadata['size']
            
            return visual_info
            
        except Exception as e:
            logger.error(f"Error extracting visual info: {e}")
            return {}

    def _extract_structural_info(self, result: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Extract structural information from result and metadata"""
        try:
            structural_info = {}
            
            # Element type classification
            element_type = metadata.get('element_type', 'text')
            structural_info['element_type'] = element_type
            structural_info['is_heading'] = 'heading' in element_type.lower() or 'title' in element_type.lower()
            structural_info['is_table'] = 'table' in element_type.lower()
            structural_info['is_figure'] = 'figure' in element_type.lower() or 'image' in element_type.lower()
            structural_info['is_text'] = not any([structural_info['is_heading'], structural_info['is_table'], structural_info['is_figure']])
            
            # Hierarchy information
            hierarchy_level = result.get('hierarchy_level', 0)
            structural_info['hierarchy_level'] = hierarchy_level
            structural_info['parent_id'] = result.get('parent_id')
            
            # Determine importance based on hierarchy and element type
            importance_score = 0
            if structural_info['is_heading']:
                importance_score += 10 - hierarchy_level  # Higher level headings are more important
            elif structural_info['is_table']:
                importance_score += 5
            elif structural_info['is_figure']:
                importance_score += 3
            else:
                importance_score += 1
            
            structural_info['importance_score'] = importance_score
            
            # Document structure context
            structural_info['document_structure'] = {
                'level': hierarchy_level,
                'is_structural': structural_info['is_heading'],
                'is_visual': structural_info['is_figure'],
                'is_tabular': structural_info['is_table']
            }
            
            return structural_info
            
        except Exception as e:
            logger.error(f"Error extracting structural info: {e}")
            return {}

    def extract_sources_from_response(self, response_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract sources from a response data structure"""
        try:
            sources = []
            
            # Handle different response formats
            if 'sources' in response_data:
                sources = response_data['sources']
            elif 'results' in response_data:
                sources = response_data['results']
            elif isinstance(response_data, list):
                sources = response_data
            
            # Extract and enhance source metadata
            enhanced_sources = self.extract_source_metadata(sources)
            
            return enhanced_sources
            
        except Exception as e:
            logger.error(f"Error extracting sources from response: {e}")
            return []

    def group_sources_by_document(self, sources: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Group sources by document"""
        try:
            grouped_sources = {}
            
            for source in sources:
                document_id = source.get('document_id', 'unknown')
                if document_id not in grouped_sources:
                    grouped_sources[document_id] = []
                grouped_sources[document_id].append(source)
            
            # Sort sources within each document by similarity score
            for doc_id in grouped_sources:
                grouped_sources[doc_id].sort(key=lambda x: x.get('similarity_score', 0), reverse=True)
            
            return grouped_sources
            
        except Exception as e:
            logger.error(f"Error grouping sources by document: {e}")
            return {}

    def rank_sources_by_relevance(self, sources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Rank sources by relevance score"""
        try:
            ranked_sources = []
            
            for source in sources:
                # Calculate relevance score
                similarity_score = source.get('similarity_score', 0.0)
                importance_score = source.get('importance_score', 1)
                
                # Weighted relevance score
                relevance_score = (similarity_score * 0.7) + (importance_score * 0.3)
                source['relevance_score'] = relevance_score
                
                ranked_sources.append(source)
            
            # Sort by relevance score
            ranked_sources.sort(key=lambda x: x['relevance_score'], reverse=True)
            
            return ranked_sources
            
        except Exception as e:
            logger.error(f"Error ranking sources by relevance: {e}")
            return sources

    def extract_source_summary(self, sources: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Extract summary information from sources"""
        try:
            if not sources:
                return {
                    'total_sources': 0,
                    'documents': [],
                    'element_types': {},
                    'average_similarity': 0.0,
                    'total_content_length': 0
                }
            
            # Count documents
            documents = set()
            element_types = {}
            total_similarity = 0.0
            total_content_length = 0
            
            for source in sources:
                documents.add(source.get('document_id', 'unknown'))
                
                element_type = source.get('element_type', 'text')
                element_types[element_type] = element_types.get(element_type, 0) + 1
                
                total_similarity += source.get('similarity_score', 0.0)
                total_content_length += source.get('character_count', 0)
            
            return {
                'total_sources': len(sources),
                'documents': list(documents),
                'document_count': len(documents),
                'element_types': element_types,
                'average_similarity': total_similarity / len(sources) if sources else 0.0,
                'total_content_length': total_content_length,
                'average_content_length': total_content_length / len(sources) if sources else 0
            }
            
        except Exception as e:
            logger.error(f"Error extracting source summary: {e}")
            return {
                'total_sources': 0,
                'documents': [],
                'element_types': {},
                'average_similarity': 0.0,
                'total_content_length': 0
            }

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for source extraction operations"""
    try:
        logger.info(f"Source Extractor event: {json.dumps(event)}")
        
        # Handle direct API calls
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        action = body.get('action', '')
        logger.info(f"Action: {action}")
        
        source_extractor = SourceExtractorService()
        
        if action == 'extract_source_metadata':
            search_results = body.get('search_results', [])
            
            if not search_results:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'search_results is required'
                    })
                }
            
            logger.info(f"Extracting metadata from {len(search_results)} search results")
            
            # Extract source metadata
            enhanced_sources = source_extractor.extract_source_metadata(search_results)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'sources': enhanced_sources,
                    'count': len(enhanced_sources)
                })
            }
        
        elif action == 'extract_sources_from_response':
            response_data = body.get('response_data', {})
            
            if not response_data:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'response_data is required'
                    })
                }
            
            logger.info("Extracting sources from response data")
            
            # Extract sources from response
            sources = source_extractor.extract_sources_from_response(response_data)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'sources': sources,
                    'count': len(sources)
                })
            }
        
        elif action == 'group_sources_by_document':
            sources = body.get('sources', [])
            
            if not sources:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'sources is required'
                    })
                }
            
            logger.info(f"Grouping {len(sources)} sources by document")
            
            # Group sources by document
            grouped_sources = source_extractor.group_sources_by_document(sources)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'grouped_sources': grouped_sources,
                    'document_count': len(grouped_sources)
                })
            }
        
        elif action == 'rank_sources_by_relevance':
            sources = body.get('sources', [])
            
            if not sources:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'sources is required'
                    })
                }
            
            logger.info(f"Ranking {len(sources)} sources by relevance")
            
            # Rank sources by relevance
            ranked_sources = source_extractor.rank_sources_by_relevance(sources)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'sources': ranked_sources,
                    'count': len(ranked_sources)
                })
            }
        
        elif action == 'extract_source_summary':
            sources = body.get('sources', [])
            
            logger.info(f"Extracting summary from {len(sources)} sources")
            
            # Extract source summary
            summary = source_extractor.extract_source_summary(sources)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps(summary)
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
                    'message': f'Action "{action}" not supported. Supported: extract_source_metadata, extract_sources_from_response, group_sources_by_document, rank_sources_by_relevance, extract_source_summary'
                })
            }
        
    except Exception as e:
        logger.error(f"Error in source extractor service: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': 'Source extractor service failed',
                'message': str(e)
            })
        }
