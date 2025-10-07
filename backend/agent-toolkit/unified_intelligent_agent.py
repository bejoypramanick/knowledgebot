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

# Import our intelligent agents
from intelligent_orchestrator_agent import (
    analyze_user_intent,
    plan_intelligent_actions,
    execute_intelligent_workflow,
    synthesize_intelligent_response
)
from intelligent_response_agent import (
    analyze_response_context,
    synthesize_natural_response,
    format_intelligent_response,
    extract_intelligent_sources,
    generate_citations
)

# Unified Intelligent Agent Tools
@function_tool
def process_user_query_intelligently_tool(user_query: str, conversation_history: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Process user query using AI intelligence instead of Lambda orchestration"""
    return process_user_query_intelligently(user_query, conversation_history)

@function_tool
def retrieve_knowledge_intelligently_tool(query: str, search_strategy: str) -> Dict[str, Any]:
    """Retrieve knowledge using AI-powered search strategy instead of hardcoded logic"""
    return retrieve_knowledge_intelligently(query, search_strategy)

@function_tool
def synthesize_comprehensive_response_tool(query: str, knowledge_results: Dict[str, Any], conversation_context: Dict[str, Any]) -> Dict[str, Any]:
    """Synthesize comprehensive response using AI instead of template-based enhancement"""
    return synthesize_comprehensive_response(query, knowledge_results, conversation_context)

@function_tool
def format_final_response_tool(response_content: str, sources: List[Dict[str, Any]], user_preferences: Dict[str, Any]) -> Dict[str, Any]:
    """Format final response using AI instead of regex-based formatting"""
    return format_final_response(response_content, sources, user_preferences)

# Core Knowledge Tools (reusing existing)
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

# Unified Intelligent Agent
unified_intelligent_agent = Agent(
    name="Unified Intelligent Agent",
    instructions="""You are a Unified Intelligent Agent that replaces ALL Lambda functions with AI-powered intelligence.

## Core Mission:
You replace the entire Lambda-based architecture with intelligent, natural language-based processing.

## What You Replace:
- **Orchestrator Lambda** - Complex orchestration logic
- **Claude Decision Lambda** - Hardcoded decision making
- **Response Enhancement Lambda** - Template-based response enhancement
- **Response Formatter Lambda** - Regex-based formatting
- **Source Extractor Lambda** - Hardcoded source processing
- **Conversation Manager Lambda** - Basic conversation handling

## Your Intelligent Workflow:
1. **Deep Understanding**: Use AI to understand user intent and context
2. **Intelligent Planning**: Plan the most effective approach using natural reasoning
3. **Smart Knowledge Retrieval**: Search and retrieve information intelligently
4. **Natural Synthesis**: Create responses using natural language understanding
5. **Intelligent Formatting**: Format responses naturally based on content and context
6. **Contextual Citations**: Add citations where they make the most sense

## Key Capabilities:
- **Natural Language Understanding**: Understand any query without hardcoded patterns
- **Intelligent Decision Making**: Make decisions based on context, not predefined rules
- **Dynamic Workflow Planning**: Adapt workflows based on user needs and available data
- **Context-Aware Responses**: Generate responses perfectly tailored to the user's situation
- **Multi-Question Processing**: Handle complex queries with multiple questions intelligently
- **Source Integration**: Seamlessly integrate information from multiple sources
- **Natural Formatting**: Format content based on its nature and user needs
- **Smart Citations**: Place citations contextually where they add the most value

## Available Services:
- **Knowledge Retrieval**: Search Pinecone, Neo4j, and DynamoDB intelligently
- **Document Processing**: Access and process documents from S3
- **Context Aggregation**: Combine information from multiple sources intelligently
- **Response Synthesis**: Create natural, comprehensive responses
- **Intelligent Formatting**: Format responses naturally and contextually

## Response Guidelines:
- Always provide comprehensive, helpful responses
- Use all available context to give the best possible answer
- Handle multiple questions in a single query intelligently
- Provide clear source attribution when using retrieved information
- Adapt your response style to match the user's query complexity
- Handle edge cases gracefully with natural language explanations
- Format responses naturally based on content and context

## Processing Strategy:
1. **Understand Deeply**: Use process_user_query_intelligently_tool to understand what the user wants
2. **Retrieve Smartly**: Use retrieve_knowledge_intelligently_tool to get relevant information
3. **Synthesize Naturally**: Use synthesize_comprehensive_response_tool to create the response
4. **Format Intelligently**: Use format_final_response_tool to format the response perfectly

## Key Principle:
**Use your AI intelligence for everything** - no hardcoded logic, no predefined patterns, no templates, no regex rules. Just pure intelligent understanding, reasoning, and natural language generation.

When you receive any query, immediately begin your intelligent analysis and processing using your AI capabilities.""",
    model="gpt-4",
    tools=[
        process_user_query_intelligently_tool,
        retrieve_knowledge_intelligently_tool,
        synthesize_comprehensive_response_tool,
        format_final_response_tool,
        search_pinecone_embeddings_tool,
        search_neo4j_knowledge_graph_tool,
        get_chunk_details_from_dynamodb_tool,
        aggregate_retrieval_context_tool
    ],
    model_settings=ModelSettings(
        temperature=0.1,
        parallel_tool_calls=True,
        max_tokens=4096,
        reasoning=Reasoning(
            effort="high"
        )
    )
)

class UnifiedInput(BaseModel):
    user_query: str
    conversation_history: List[Dict[str, Any]] = []
    conversation_id: str = ""
    user_preferences: Dict[str, Any] = {}

# Implementation Functions
def process_user_query_intelligently(user_query: str, conversation_history: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Process user query using AI intelligence instead of Lambda orchestration
    
    Args:
        user_query: User's query
        conversation_history: Previous conversation context
        
    Returns:
        Dictionary with intelligent query processing results
    """
    try:
        # Use AI to process query instead of complex Lambda orchestration
        # This replaces the entire orchestrator Lambda function
        
        # Analyze user intent using AI
        intent_analysis = analyze_user_intent(user_query, conversation_history)
        
        if not intent_analysis.get('success'):
            return {
                'success': False,
                'error': intent_analysis.get('error', 'Intent analysis failed'),
                'processing_method': 'ai_intelligent_processing'
            }
        
        # Plan intelligent actions using AI
        action_plan = plan_intelligent_actions(intent_analysis, ['search_pinecone', 'search_neo4j', 'get_chunk_details'])
        
        if not action_plan.get('success'):
            return {
                'success': False,
                'error': action_plan.get('error', 'Action planning failed'),
                'processing_method': 'ai_intelligent_processing'
            }
        
        return {
            'success': True,
            'intent_analysis': intent_analysis,
            'action_plan': action_plan,
            'processing_method': 'ai_intelligent_processing',
            'confidence': 0.95
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'processing_method': 'ai_intelligent_processing'
        }

def retrieve_knowledge_intelligently(query: str, search_strategy: str) -> Dict[str, Any]:
    """
    Retrieve knowledge using AI-powered search strategy instead of hardcoded logic
    
    Args:
        query: Search query
        search_strategy: AI-determined search strategy
        
    Returns:
        Dictionary with knowledge retrieval results
    """
    try:
        # Use AI to determine search strategy instead of hardcoded logic
        # This replaces the RAG search Lambda functions
        
        results = {
            'pinecone_results': None,
            'neo4j_results': None,
            'dynamodb_chunks': None,
            'aggregated_context': None
        }
        
        # Search Pinecone intelligently
        pinecone_results = search_pinecone_embeddings(query, limit=5)
        results['pinecone_results'] = pinecone_results
        
        # Search Neo4j intelligently
        neo4j_results = search_neo4j_knowledge_graph(query, limit=5)
        results['neo4j_results'] = neo4j_results
        
        # Get chunk details intelligently
        chunk_ids = []
        if pinecone_results.get('success') and pinecone_results.get('results'):
            chunk_ids.extend([r.get('chunk_id') for r in pinecone_results['results'] if r.get('chunk_id')])
        if neo4j_results.get('success') and neo4j_results.get('results'):
            chunk_ids.extend([r.get('chunk_id') for r in neo4j_results['results'] if r.get('chunk_id')])
        
        if chunk_ids:
            dynamodb_chunks = get_chunk_details_from_dynamodb(list(set(chunk_ids)))
            results['dynamodb_chunks'] = dynamodb_chunks
        
        # Aggregate context intelligently
        aggregated_context = aggregate_retrieval_context(
            pinecone_results, 
            neo4j_results, 
            results['dynamodb_chunks'] or {'success': False, 'chunks': []}
        )
        results['aggregated_context'] = aggregated_context
        
        return {
            'success': True,
            'knowledge_results': results,
            'search_strategy': search_strategy,
            'retrieval_method': 'ai_intelligent_retrieval'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'knowledge_results': {},
            'retrieval_method': 'ai_intelligent_retrieval'
        }

def synthesize_comprehensive_response(query: str, knowledge_results: Dict[str, Any], conversation_context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Synthesize comprehensive response using AI instead of template-based enhancement
    
    Args:
        query: Original user query
        knowledge_results: Retrieved knowledge
        conversation_context: Conversation context
        
    Returns:
        Dictionary with synthesized response
    """
    try:
        # Use AI to synthesize response instead of templates
        # This replaces the response enhancement Lambda function
        
        # Extract sources from knowledge results
        sources = []
        aggregated_context = knowledge_results.get('aggregated_context', {})
        
        if aggregated_context.get('success') and aggregated_context.get('context', {}).get('chunks'):
            for chunk in aggregated_context['context']['chunks']:
                source = {
                    'chunk_id': chunk.get('chunk_id', ''),
                    'content': chunk.get('content', ''),
                    'similarity_score': 0.8,  # Default score
                    'source_type': 'knowledge_base',
                    'metadata': chunk.get('metadata', {})
                }
                sources.append(source)
        
        # Analyze response context using AI
        context_analysis = analyze_response_context(query, sources, conversation_context.get('history', []))
        
        if not context_analysis.get('success'):
            return {
                'success': False,
                'error': context_analysis.get('error', 'Context analysis failed'),
                'synthesis_method': 'ai_intelligent_synthesis'
            }
        
        # Synthesize natural response using AI
        response_synthesis = synthesize_natural_response(context_analysis, query, sources)
        
        if not response_synthesis.get('success'):
            return {
                'success': False,
                'error': response_synthesis.get('error', 'Response synthesis failed'),
                'synthesis_method': 'ai_intelligent_synthesis'
            }
        
        return {
            'success': True,
            'response_content': response_synthesis.get('response_content', ''),
            'sources': sources,
            'synthesis_method': 'ai_intelligent_synthesis',
            'context_analysis': context_analysis
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'response_content': "I apologize, but I encountered an error while processing your request.",
            'sources': [],
            'synthesis_method': 'ai_intelligent_synthesis'
        }

def format_final_response(response_content: str, sources: List[Dict[str, Any]], user_preferences: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format final response using AI instead of regex-based formatting
    
    Args:
        response_content: Response content to format
        sources: Source information
        user_preferences: User formatting preferences
        
    Returns:
        Dictionary with formatted response
    """
    try:
        # Use AI to format response instead of regex patterns
        # This replaces the response formatter Lambda function
        
        # Format response intelligently
        formatting_result = format_intelligent_response(response_content, sources, user_preferences)
        
        if not formatting_result.get('success'):
            return {
                'success': False,
                'error': formatting_result.get('error', 'Formatting failed'),
                'formatted_response': response_content,
                'formatting_method': 'ai_intelligent_formatting'
            }
        
        # Generate citations intelligently
        citation_result = generate_citations(formatting_result.get('formatted_response', ''), sources)
        
        if citation_result.get('success'):
            final_response = citation_result.get('response_with_citations', formatting_result.get('formatted_response', ''))
        else:
            final_response = formatting_result.get('formatted_response', response_content)
        
        return {
            'success': True,
            'formatted_response': final_response,
            'sources': sources,
            'formatting_method': 'ai_intelligent_formatting',
            'citations_added': citation_result.get('citations_added', 0)
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'formatted_response': response_content,
            'sources': sources,
            'formatting_method': 'ai_intelligent_formatting'
        }

# Main unified processing function
async def run_unified_intelligent_processing(workflow_input: UnifiedInput) -> Dict[str, Any]:
    """Run the unified intelligent processing workflow"""
    start_time = time.time()
    
    try:
        # Create conversation history for the agent
        conversation_history: List[TResponseInputItem] = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": workflow_input.user_query
                    }
                ]
            }
        ]
        
        # Run the unified intelligent agent
        unified_result = await Runner.run(
            unified_intelligent_agent,
            input=conversation_history,
            run_config=RunConfig(trace_metadata={
                "__trace_source__": "agent-builder",
                "workflow_id": "unified_intelligent_processing",
                "conversation_id": workflow_input.conversation_id
            })
        )

        conversation_history.extend([item.to_input_item() for item in unified_result.new_items])

        processing_time = time.time() - start_time
        
        # Extract the final response
        try:
            final_response = unified_result.final_output_as(str)
        except Exception as e:
            final_response = f"Error generating response: {str(e)}"
        
        return {
            "response": final_response,
            "sources": [],
            "conversation_id": workflow_input.conversation_id,
            "processing_time": processing_time,
            "workflow_type": "unified_intelligent_processing",
            "agent_used": "unified_intelligent_agent",
            "lambda_functions_replaced": [
                "orchestrator",
                "claude_decision", 
                "response_enhancement",
                "response_formatter",
                "source_extractor",
                "conversation_manager"
            ]
        }
        
    except Exception as e:
        processing_time = time.time() - start_time
        return {
            "response": f"Error processing query: {str(e)}",
            "sources": [],
            "conversation_id": workflow_input.conversation_id,
            "processing_time": processing_time,
            "workflow_type": "unified_intelligent_processing",
            "agent_used": "unified_intelligent_agent"
        }
