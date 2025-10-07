from agents import function_tool, Agent, ModelSettings, TResponseInputItem, Runner, RunConfig
from openai.types.shared.reasoning import Reasoning
from pydantic import BaseModel
from typing import List, Dict, Any
import time
import asyncio
from datetime import datetime

# Import our existing Python functions
from custom_functions import (
    read_s3_data,
    search_pinecone_embeddings,
    search_neo4j_knowledge_graph,
    get_chunk_details_from_dynamodb,
    aggregate_retrieval_context
)

# Tool definitions with proper implementations
@function_tool
def read_s3_data_tool(bucket_name: str, object_key: str, aws_region: str, file_format: str) -> Dict[str, Any]:
    """Read data from an S3 bucket with support for different file formats"""
    return read_s3_data(bucket_name, object_key, aws_region, file_format)

@function_tool
def search_pinecone_embeddings_tool(query: str, limit: int) -> Dict[str, Any]:
    """Search for similar document chunks using Pinecone vector search"""
    return search_pinecone_embeddings(query, limit)

@function_tool
def search_neo4j_knowledge_graph_tool(query: str, limit: int) -> Dict[str, Any]:
    """Search knowledge graph in Neo4j for related entities and relationships"""
    return search_neo4j_knowledge_graph(query, limit)

@function_tool
def get_chunk_details_from_dynamodb_tool(chunk_ids: List[str]) -> Dict[str, Any]:
    """Get detailed chunk information from DynamoDB"""
    return get_chunk_details_from_dynamodb(chunk_ids)

@function_tool
def aggregate_retrieval_context_tool(pinecone_results: Dict[str, Any], neo4j_results: Dict[str, Any], dynamodb_chunks: Dict[str, Any]) -> Dict[str, Any]:
    """Aggregate context from all retrieval sources (Pinecone, Neo4j, DynamoDB)"""
    return aggregate_retrieval_context(pinecone_results, neo4j_results, dynamodb_chunks)

# Advanced Multi-Question Processing Tools
@function_tool
def decompose_user_query_tool(query: str) -> Dict[str, Any]:
    """Decompose a multi-question query into individual questions for focused processing"""
    return decompose_user_query(query)

@function_tool
def process_individual_question_tool(question: str, question_id: str) -> Dict[str, Any]:
    """Process each individual question with focused context retrieval"""
    return process_individual_question(question, question_id)

@function_tool
def synthesize_multi_question_response_tool(question_results: List[Dict[str, Any]], original_query: str) -> Dict[str, Any]:
    """Synthesize individual question results into a comprehensive multi-question response"""
    return synthesize_multi_question_response(question_results, original_query)

# Agent definition
retrieval_workflow_agent = Agent(
    name="Retrieval Workflow Agent",
    instructions="""You are an Advanced Retrieval Agent with sophisticated multi-question processing capabilities.

## Core Capabilities:
You can intelligently handle both single questions and complex multi-question queries with advanced processing.

## Multi-Question Processing Workflow:
When you receive a query, use your natural language understanding to:

1. **Intelligent Analysis**: Use your AI capabilities to analyze if the query contains multiple questions or topics
2. **Smart Decomposition**: If you detect multiple questions, intelligently decompose them into individual, focused questions
3. **Parallel Processing**: Process each question independently with targeted context retrieval
4. **Context Synthesis**: Combine results from all questions into a comprehensive, structured response
5. **Structured Response**: Provide clear, organized answers for each question with proper attribution

## Single Question Workflow:
For single questions, use the standard workflow:
1. Search Pinecone for semantically similar document chunks
2. Search Neo4j knowledge graph for related entities
3. Retrieve detailed chunk information from DynamoDB
4. Aggregate all retrieved context
5. Generate comprehensive response

## Response Format for Multiple Questions:
Structure your response as:
```
Here are the answers to your questions:

**1. [First Question]**
[Detailed answer with sources]

**2. [Second Question]**  
[Detailed answer with sources]

**Sources Used:**
- [List all sources with relevance scores]
```

## Advanced Guidelines:
- **AI-Powered Analysis**: Use your natural language understanding to detect multiple questions or topics
- **Intelligent Decomposition**: Break down complex queries into individual questions using your language comprehension
- **Focused Retrieval**: Use question-specific context for each individual question
- **Parallel Processing**: Process multiple questions simultaneously for efficiency
- **Context Preservation**: Maintain context relationships between related questions
- **Source Attribution**: Clearly attribute sources to specific questions
- **Comprehensive Coverage**: Ensure all questions are thoroughly addressed
- **Quality Prioritization**: Prioritize high-quality, relevant chunks for each question
- **Fallback Handling**: Handle cases where some questions have no relevant context

## Processing Strategy:
- **Start with AI Analysis**: Use your language understanding to analyze the query structure and content
- **Smart Detection**: Determine if the query contains multiple questions or topics using your intelligence
- **Intelligent Decomposition**: If multiple questions detected, decompose them using your natural language capabilities
- **Focused Processing**: Use process_individual_question_tool for each decomposed question
- **Synthesis**: Use synthesize_multi_question_response_tool for final response assembly
- **Parallel Efficiency**: Process multiple questions simultaneously when possible
- **Structured Output**: Provide clear, comprehensive responses with proper organization

## Key Principle:
**Let your AI intelligence do the heavy lifting** - use your natural language understanding to detect, decompose, and process multiple questions intelligently rather than relying on simple pattern matching.

When you receive any query, immediately use your AI capabilities to analyze its structure and choose the appropriate processing strategy.""",
    model="gpt-4",
    tools=[
        read_s3_data_tool,
        search_pinecone_embeddings_tool,
        search_neo4j_knowledge_graph_tool,
        get_chunk_details_from_dynamodb_tool,
        aggregate_retrieval_context_tool,
        decompose_user_query_tool,
        process_individual_question_tool,
        synthesize_multi_question_response_tool
    ],
    model_settings=ModelSettings(
        parallel_tool_calls=True,
        store=True,
        reasoning=Reasoning(
            effort="low"
        )
    )
)

class WorkflowInput(BaseModel):
    input_as_text: str

# Main code entrypoint
async def run_retrieval_workflow(workflow_input: WorkflowInput) -> Dict[str, Any]:
    """Run the retrieval workflow"""
    start_time = time.time()
    
    try:
        workflow = workflow_input.model_dump()
        conversation_history: List[TResponseInputItem] = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": workflow["input_as_text"]
                    }
                ]
            }
        ]
        
        # Run the agent
        retrieval_workflow_agent_result_temp = await Runner.run(
            retrieval_workflow_agent,
            input=conversation_history,
            run_config=RunConfig(trace_metadata={
                "__trace_source__": "agent-builder",
                "workflow_id": "wf_68e52e2c1fe0819092768dbd64b4dfd90098e1a137ec2c19"
            })
        )

        conversation_history.extend([item.to_input_item() for item in retrieval_workflow_agent_result_temp.new_items])

        processing_time = time.time() - start_time
        
        # Extract metadata from tool calls
        tool_calls = []
        for item in retrieval_workflow_agent_result_temp.new_items:
            if hasattr(item, 'tool_calls') and item.tool_calls:
                tool_calls.extend(item.tool_calls)
        
        # Count different types of tool calls
        pinecone_calls = [call for call in tool_calls if call.get('function', {}).get('name') == 'search_pinecone_embeddings_tool']
        neo4j_calls = [call for call in tool_calls if call.get('function', {}).get('name') == 'search_neo4j_knowledge_graph_tool']
        
        # Initialize result with defaults
        end_result = {
            "response": "",
            "sources": [],
            "total_chunks_retrieved": 0,
            "pinecone_matches": len(pinecone_calls),
            "neo4j_matches": len(neo4j_calls),
            "processing_time": processing_time,
            "query": workflow["input_as_text"]
        }
        
        # Try to extract the final response
        try:
            final_output = retrieval_workflow_agent_result_temp.final_output_as(str)
            if final_output:
                end_result["response"] = final_output
        except Exception as e:
            end_result["response"] = f"Error generating response: {str(e)}"
        
        return end_result
        
    except Exception as e:
        processing_time = time.time() - start_time
        return {
            "response": f"Error processing query: {str(e)}",
            "sources": [],
            "total_chunks_retrieved": 0,
            "pinecone_matches": 0,
            "neo4j_matches": 0,
            "processing_time": processing_time,
            "query": workflow_input.input_as_text
        }

# Multi-Question Processing Implementation Functions
def decompose_user_query(query: str) -> Dict[str, Any]:
    """
    Decompose a multi-question query into individual questions using AI model intelligence
    
    Args:
        query: User query that may contain multiple questions
        
    Returns:
        Dictionary with decomposed questions and metadata
    """
    try:
        # Let the AI model analyze the query and determine if it contains multiple questions
        # This is a simple implementation - the actual heavy lifting will be done by the agent
        # The agent will use its natural language understanding to detect and decompose questions
        
        # For now, return the query as-is and let the agent handle the intelligence
        return {
            'success': True,
            'is_multi_question': None,  # Let the agent determine this
            'questions': [query],
            'question_count': 1,
            'original_query': query,
            'decomposition_method': 'ai_model_analysis'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'is_multi_question': False,
            'questions': [query],
            'question_count': 1,
            'original_query': query
        }

def process_individual_question(question: str, question_id: str) -> Dict[str, Any]:
    """
    Process an individual question with focused context retrieval
    
    Args:
        question: Individual question to process
        question_id: Unique identifier for the question
        
    Returns:
        Dictionary with question processing results
    """
    try:
        # Search Pinecone for this specific question
        pinecone_results = search_pinecone_embeddings(question, limit=3)
        
        # Search Neo4j for this specific question
        neo4j_results = search_neo4j_knowledge_graph(question, limit=3)
        
        # Get chunk IDs from both searches
        chunk_ids = []
        if pinecone_results.get('success') and pinecone_results.get('results'):
            chunk_ids.extend([r['chunk_id'] for r in pinecone_results['results']])
        if neo4j_results.get('success') and neo4j_results.get('results'):
            chunk_ids.extend([r['chunk_id'] for r in neo4j_results['results']])
        
        # Remove duplicates
        chunk_ids = list(set(chunk_ids))
        
        # Get detailed chunk information
        dynamodb_chunks = get_chunk_details_from_dynamodb(chunk_ids) if chunk_ids else {'success': False, 'chunks': []}
        
        # Aggregate context for this question
        aggregated_context = aggregate_retrieval_context(pinecone_results, neo4j_results, dynamodb_chunks)
        
        return {
            'success': True,
            'question_id': question_id,
            'question': question,
            'pinecone_results': pinecone_results,
            'neo4j_results': neo4j_results,
            'dynamodb_chunks': dynamodb_chunks,
            'aggregated_context': aggregated_context,
            'chunk_count': len(chunk_ids),
            'processing_time': time.time()
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'question_id': question_id,
            'question': question,
            'chunk_count': 0,
            'processing_time': time.time()
        }

def synthesize_multi_question_response(question_results: List[Dict[str, Any]], original_query: str) -> Dict[str, Any]:
    """
    Synthesize individual question results into a comprehensive multi-question response
    
    Args:
        question_results: List of results from processing individual questions
        original_query: Original user query
        
    Returns:
        Dictionary with synthesized response
    """
    try:
        successful_results = [r for r in question_results if r.get('success', False)]
        failed_results = [r for r in question_results if not r.get('success', False)]
        
        # Build structured response
        response_parts = []
        all_sources = []
        total_chunks = 0
        total_pinecone_matches = 0
        total_neo4j_matches = 0
        
        response_parts.append("Here are the answers to your questions:\n")
        
        for i, result in enumerate(successful_results, 1):
            question = result.get('question', f'Question {i}')
            context = result.get('aggregated_context', {})
            chunks = context.get('context', {}).get('chunks', [])
            
            # Extract sources
            sources = []
            for chunk in chunks:
                source = {
                    'chunk_id': chunk.get('chunk_id'),
                    'content': chunk.get('content', '')[:200] + '...' if len(chunk.get('content', '')) > 200 else chunk.get('content', ''),
                    'document_id': chunk.get('document_id'),
                    'element_type': chunk.get('element_type'),
                    'page_number': chunk.get('page_number', 0)
                }
                sources.append(source)
                all_sources.append(source)
            
            # Add question and answer section
            response_parts.append(f"**{i}. {question}**")
            
            if chunks:
                # Generate answer from context
                context_text = ' '.join([chunk.get('content', '') for chunk in chunks[:3]])  # Use top 3 chunks
                response_parts.append(f"Based on the available information: {context_text[:500]}...")
            else:
                response_parts.append("I couldn't find specific information to answer this question in the knowledge base.")
            
            response_parts.append("")  # Empty line between questions
            
            # Update counters
            total_chunks += result.get('chunk_count', 0)
            pinecone_results = result.get('pinecone_results', {})
            neo4j_results = result.get('neo4j_results', {})
            total_pinecone_matches += len(pinecone_results.get('results', [])) if pinecone_results.get('success') else 0
            total_neo4j_matches += len(neo4j_results.get('results', [])) if neo4j_results.get('success') else 0
        
        # Add failed questions if any
        if failed_results:
            response_parts.append("**Questions I couldn't process:**")
            for result in failed_results:
                response_parts.append(f"- {result.get('question', 'Unknown question')}: {result.get('error', 'Processing failed')}")
            response_parts.append("")
        
        # Add sources section
        if all_sources:
            response_parts.append("**Sources Used:**")
            for i, source in enumerate(all_sources[:10], 1):  # Limit to top 10 sources
                response_parts.append(f"{i}. {source['content']} (Document: {source.get('document_id', 'Unknown')})")
        
        # Combine all parts
        final_response = '\n'.join(response_parts)
        
        return {
            'success': True,
            'response': final_response,
            'sources': all_sources,
            'total_questions_processed': len(question_results),
            'successful_questions': len(successful_results),
            'failed_questions': len(failed_results),
            'total_chunks_retrieved': total_chunks,
            'pinecone_matches': total_pinecone_matches,
            'neo4j_matches': total_neo4j_matches,
            'original_query': original_query,
            'response_type': 'multi_question'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'response': f"Error synthesizing multi-question response: {str(e)}",
            'sources': [],
            'total_questions_processed': len(question_results),
            'original_query': original_query,
            'response_type': 'multi_question'
        }
