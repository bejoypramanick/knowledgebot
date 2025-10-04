"""
Enhanced RAG Search Lambda with Docling Integration
Responsibility: Advanced search with Docling visualization and metadata features
"""
import json
import boto3
import os
from typing import Dict, Any, List, Optional
import logging
import numpy as np
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.document import Document
from docling.datamodel.text import TextElement
from docling.datamodel.table import Table
from docling.datamodel.figure import Figure
import tempfile
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
MAIN_BUCKET = os.environ.get('MAIN_BUCKET', 'chatbot-storage-ap-south-1')
KNOWLEDGE_BASE_TABLE = os.environ.get('KNOWLEDGE_BASE_TABLE', 'chatbot-knowledge-base')

class EnhancedRAGSearchService:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name='ap-south-1')
        self.dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
        self.main_bucket = MAIN_BUCKET
        self.knowledge_base_table = self.dynamodb.Table(KNOWLEDGE_BASE_TABLE)
        
        # Initialize Docling converter for advanced features
        self.converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfPipelineOptions(
                    do_ocr=True,
                    do_table_structure=True,
                    table_structure_options={"do_cell_matching": True}
                )
            }
        )
        
        # Initialize embedding model
        self._embedding_model = None

    def get_embedding(self, text: str) -> List[float]:
        """Get embedding using HuggingFace sentence-transformers model"""
        try:
            from sentence_transformers import SentenceTransformer
            
            # Use a lightweight, efficient sentence transformer model
            model_name = "all-MiniLM-L6-v2"  # 384-dimensional embeddings
            
            # Initialize the model (it will be cached after first use)
            if not self._embedding_model:
                self._embedding_model = SentenceTransformer(model_name)
            
            # Generate embedding
            embedding = self._embedding_model.encode(text, convert_to_tensor=False)
            
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"Error generating embedding with sentence-transformers: {e}")
            raise Exception(f"Failed to generate embedding with sentence-transformers: {e}")

    def search_with_docling_metadata(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Enhanced search using Docling metadata and visualization features"""
        try:
            # Get query embedding
            query_embedding = self.get_embedding(query)
            if not query_embedding:
                logger.error("Could not generate query embedding")
                return []
            
            # Get all chunk IDs from DynamoDB
            response = self.knowledge_base_table.scan()
            if 'Items' not in response or not response['Items']:
                logger.info("No chunks found in knowledge base")
                return []
            
            # Calculate similarities and collect results with Docling metadata
            similar_chunks = []
            
            for item in response['Items']:
                chunk_id = item.get('chunk_id')
                if not chunk_id:
                    continue
                
                try:
                    # Get embedding from S3
                    embedding_key = f"embeddings/{chunk_id}.json"
                    embedding_response = self.s3_client.get_object(
                        Bucket=self.main_bucket,
                        Key=embedding_key
                    )
                    embedding_data = json.loads(embedding_response['Body'].read())
                    chunk_embedding = embedding_data.get('embedding', [])
                    
                    if not chunk_embedding:
                        continue
                    
                    # Calculate cosine similarity
                    similarity = self._cosine_similarity(query_embedding, chunk_embedding)
                    
                    # Enhanced metadata with Docling features
                    metadata = item.get('metadata', {})
                    enhanced_metadata = self._enhance_metadata_with_docling(item, metadata)
                    
                    # Add to results with rich Docling metadata
                    chunk_data = {
                        'chunk_id': chunk_id,
                        'content': item.get('content', ''),
                        'metadata': enhanced_metadata,
                        'hierarchy_level': item.get('hierarchy_level', 0),
                        'parent_id': item.get('parent_id'),
                        'similarity_score': similarity,
                        'docling_features': self._extract_docling_features(item)
                    }
                    similar_chunks.append(chunk_data)
                    
                except Exception as e:
                    logger.warning(f"Could not retrieve embedding for chunk {chunk_id}: {e}")
                    continue
            
            # Sort by similarity score and return top results
            similar_chunks.sort(key=lambda x: x['similarity_score'], reverse=True)
            logger.info(f"Found {len(similar_chunks)} chunks, returning top {limit}")
            return similar_chunks[:limit]
            
        except Exception as e:
            logger.error(f"Error in enhanced Docling search: {e}")
            return []

    def _enhance_metadata_with_docling(self, item: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Enhance metadata with Docling-specific information"""
        enhanced = metadata.copy()
        
        # Add Docling element type information
        element_type = metadata.get('element_type', 'text')
        enhanced['docling_element_type'] = element_type
        
        # Add visual positioning information if available
        if 'bbox' in metadata:
            enhanced['visual_position'] = {
                'x': metadata['bbox'].get('x', 0),
                'y': metadata['bbox'].get('y', 0),
                'width': metadata['bbox'].get('width', 0),
                'height': metadata['bbox'].get('height', 0)
            }
        
        # Add document structure information
        enhanced['document_structure'] = {
            'hierarchy_level': item.get('hierarchy_level', 0),
            'parent_id': item.get('parent_id'),
            'is_heading': 'heading' in element_type.lower() or 'title' in element_type.lower(),
            'is_table': 'table' in element_type.lower(),
            'is_figure': 'figure' in element_type.lower() or 'image' in element_type.lower()
        }
        
        # Add processing information
        enhanced['processing_info'] = {
            'processed_at': metadata.get('processed_at', ''),
            'source': metadata.get('source', 'Unknown'),
            'page_number': metadata.get('page_number', 0),
            's3_key': metadata.get('s3_key', ''),
            's3_bucket': self.main_bucket
        }
        
        return enhanced

    def _extract_docling_features(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Extract Docling-specific features for visualization"""
        metadata = item.get('metadata', {})
        element_type = metadata.get('element_type', 'text')
        
        features = {
            'element_type': element_type,
            'is_structural': self._is_structural_element(element_type),
            'is_visual': self._is_visual_element(element_type),
            'is_tabular': self._is_tabular_element(element_type),
            'hierarchy_info': self._get_hierarchy_info(item),
            'visual_indicators': self._get_visual_indicators(metadata)
        }
        
        return features

    def _is_structural_element(self, element_type: str) -> bool:
        """Check if element is structural (headings, titles, etc.)"""
        structural_types = ['title', 'heading', 'subtitle', 'subheading', 'section']
        return any(struct_type in element_type.lower() for struct_type in structural_types)

    def _is_visual_element(self, element_type: str) -> bool:
        """Check if element is visual (figures, images, etc.)"""
        visual_types = ['figure', 'image', 'chart', 'diagram', 'graph']
        return any(visual_type in element_type.lower() for visual_type in visual_types)

    def _is_tabular_element(self, element_type: str) -> bool:
        """Check if element is tabular (tables, etc.)"""
        tabular_types = ['table', 'row', 'cell', 'header']
        return any(tabular_type in element_type.lower() for tabular_type in tabular_types)

    def _get_hierarchy_info(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Get hierarchy information for document structure"""
        return {
            'level': item.get('hierarchy_level', 0),
            'parent_id': item.get('parent_id'),
            'has_children': False,  # Would need to query for children
            'sibling_count': 0  # Would need to query for siblings
        }

    def _get_visual_indicators(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Get visual indicators for UI rendering"""
        indicators = {
            'has_position': 'bbox' in metadata,
            'has_color': 'color' in metadata,
            'has_font': 'font' in metadata,
            'has_size': 'size' in metadata
        }
        
        if 'bbox' in metadata:
            indicators['position'] = metadata['bbox']
        
        return indicators

    def search_by_document_structure(self, query: str, structure_type: str = "all", limit: int = 5) -> List[Dict[str, Any]]:
        """Search within specific document structure types (headings, tables, figures)"""
        try:
            # Get all chunks
            response = self.knowledge_base_table.scan()
            if 'Items' not in response or not response['Items']:
                return []
            
            # Filter by structure type
            filtered_items = []
            for item in response['Items']:
                element_type = item.get('metadata', {}).get('element_type', 'text')
                
                if structure_type == "all":
                    filtered_items.append(item)
                elif structure_type == "headings" and self._is_structural_element(element_type):
                    filtered_items.append(item)
                elif structure_type == "tables" and self._is_tabular_element(element_type):
                    filtered_items.append(item)
                elif structure_type == "figures" and self._is_visual_element(element_type):
                    filtered_items.append(item)
            
            # Perform similarity search on filtered items
            query_embedding = self.get_embedding(query)
            similar_chunks = []
            
            for item in filtered_items:
                try:
                    chunk_id = item.get('chunk_id')
                    embedding_key = f"embeddings/{chunk_id}.json"
                    embedding_response = self.s3_client.get_object(
                        Bucket=self.main_bucket,
                        Key=embedding_key
                    )
                    embedding_data = json.loads(embedding_response['Body'].read())
                    chunk_embedding = embedding_data.get('embedding', [])
                    
                    if chunk_embedding:
                        similarity = self._cosine_similarity(query_embedding, chunk_embedding)
                        
                        chunk_data = {
                            'chunk_id': chunk_id,
                            'content': item.get('content', ''),
                            'metadata': self._enhance_metadata_with_docling(item, item.get('metadata', {})),
                            'hierarchy_level': item.get('hierarchy_level', 0),
                            'similarity_score': similarity,
                            'structure_type': structure_type,
                            'docling_features': self._extract_docling_features(item)
                        }
                        similar_chunks.append(chunk_data)
                        
                except Exception as e:
                    logger.warning(f"Error processing chunk {chunk_id}: {e}")
                    continue
            
            # Sort and return top results
            similar_chunks.sort(key=lambda x: x['similarity_score'], reverse=True)
            return similar_chunks[:limit]
            
        except Exception as e:
            logger.error(f"Error in structure-based search: {e}")
            return []

    def get_document_visualization_data(self, document_id: str) -> Dict[str, Any]:
        """Get visualization data for a specific document"""
        try:
            # Get all chunks for the document
            response = self.knowledge_base_table.query(
                IndexName='document-id-index',
                KeyConditionExpression='document_id = :doc_id',
                ExpressionAttributeValues={':doc_id': document_id}
            )
            
            if 'Items' not in response or not response['Items']:
                return {'error': 'Document not found'}
            
            # Build document structure
            document_structure = {
                'document_id': document_id,
                'total_chunks': len(response['Items']),
                'structure': self._build_document_structure(response['Items']),
                'visual_elements': self._extract_visual_elements(response['Items']),
                'hierarchy_tree': self._build_hierarchy_tree(response['Items'])
            }
            
            return document_structure
            
        except Exception as e:
            logger.error(f"Error getting document visualization data: {e}")
            return {'error': str(e)}

    def _build_document_structure(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Build document structure from chunks"""
        structure = {
            'headings': [],
            'tables': [],
            'figures': [],
            'text_blocks': []
        }
        
        for item in items:
            element_type = item.get('metadata', {}).get('element_type', 'text')
            content = item.get('content', '')
            
            chunk_info = {
                'chunk_id': item.get('chunk_id'),
                'content': content[:200] + '...' if len(content) > 200 else content,
                'hierarchy_level': item.get('hierarchy_level', 0),
                'page_number': item.get('metadata', {}).get('page_number', 0)
            }
            
            if self._is_structural_element(element_type):
                structure['headings'].append(chunk_info)
            elif self._is_tabular_element(element_type):
                structure['tables'].append(chunk_info)
            elif self._is_visual_element(element_type):
                structure['figures'].append(chunk_info)
            else:
                structure['text_blocks'].append(chunk_info)
        
        return structure

    def _extract_visual_elements(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract visual elements for rendering"""
        visual_elements = []
        
        for item in items:
            metadata = item.get('metadata', {})
            if 'bbox' in metadata:
                visual_elements.append({
                    'chunk_id': item.get('chunk_id'),
                    'element_type': metadata.get('element_type', 'text'),
                    'position': metadata['bbox'],
                    'content': item.get('content', '')[:100],
                    'page_number': metadata.get('page_number', 0)
                })
        
        return visual_elements

    def _build_hierarchy_tree(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Build hierarchy tree for document navigation"""
        # Group by hierarchy level
        levels = {}
        for item in items:
            level = item.get('hierarchy_level', 0)
            if level not in levels:
                levels[level] = []
            levels[level].append({
                'chunk_id': item.get('chunk_id'),
                'content': item.get('content', '')[:100],
                'element_type': item.get('metadata', {}).get('element_type', 'text')
            })
        
        return levels

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            # Convert to numpy arrays
            a = np.array(vec1)
            b = np.array(vec2)
            
            # Calculate cosine similarity
            dot_product = np.dot(a, b)
            norm_a = np.linalg.norm(a)
            norm_b = np.linalg.norm(b)
            
            if norm_a == 0 or norm_b == 0:
                return 0.0
            
            similarity = dot_product / (norm_a * norm_b)
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error calculating cosine similarity: {e}")
            return 0.0

    def generate_embeddings(self, text: str) -> Dict[str, Any]:
        """Generate embeddings for given text"""
        try:
            embedding = self.get_embedding(text)
            return {
                'embedding': embedding,
                'text': text,
                'dimension': len(embedding),
                'model': 'all-MiniLM-L6-v2'
            }
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            raise Exception(f"Failed to generate embeddings: {e}")

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Enhanced Lambda handler with Docling features"""
    try:
        logger.info(f"Enhanced RAG Search event: {json.dumps(event)}")
        
        # Handle direct API calls
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        action = body.get('action', '')
        logger.info(f"Action: {action}")
        
        rag_service = EnhancedRAGSearchService()
        
        if action == 'search':
            query = body.get('query', '')
            limit = body.get('limit', 5)
            
            logger.info(f"Enhanced search for query: {query}")
            
            # Enhanced search with Docling metadata
            results = rag_service.search_with_docling_metadata(query, limit)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'results': results,
                    'query': query,
                    'count': len(results),
                    'search_method': 'enhanced_docling',
                    'features': ['metadata_enhancement', 'visual_indicators', 'structure_analysis']
                })
            }
        
        elif action == 'search_by_structure':
            query = body.get('query', '')
            structure_type = body.get('structure_type', 'all')
            limit = body.get('limit', 5)
            
            logger.info(f"Structure-based search: {query} in {structure_type}")
            
            results = rag_service.search_by_document_structure(query, structure_type, limit)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'results': results,
                    'query': query,
                    'structure_type': structure_type,
                    'count': len(results),
                    'search_method': 'structure_based_docling'
                })
            }
        
        elif action == 'get_document_visualization':
            document_id = body.get('document_id', '')
            
            logger.info(f"Getting visualization data for document: {document_id}")
            
            visualization_data = rag_service.get_document_visualization_data(document_id)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps(visualization_data)
            }
        
        elif action == 'generate_embeddings':
            text = body.get('text', '')
            logger.info(f"Generating embeddings for text: {text[:100]}...")
            
            try:
                result = rag_service.generate_embeddings(text)
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps(result)
                }
            except Exception as e:
                logger.error(f"Error generating embeddings: {e}")
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Failed to generate embeddings',
                        'message': str(e)
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
                    'message': f'Action "{action}" not supported. Supported: search, search_by_structure, get_document_visualization, generate_embeddings'
                })
            }
        
    except Exception as e:
        logger.error(f"Error in enhanced RAG search: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': 'Enhanced RAG search failed',
                'message': str(e)
            })
        }
