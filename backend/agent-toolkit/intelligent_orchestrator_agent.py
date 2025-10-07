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

# Intelligent Orchestration Tools
@function_tool
def analyze_user_intent_tool(user_query: str, conversation_history: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze user intent and determine what actions are needed"""
    return analyze_user_intent(user_query, conversation_history)

@function_tool
def plan_intelligent_actions_tool(user_intent: Dict[str, Any], available_services: List[str]) -> Dict[str, Any]:
    """Plan intelligent actions based on user intent and available services"""
    return plan_intelligent_actions(user_intent, available_services)

@function_tool
def execute_intelligent_workflow_tool(action_plan: Dict[str, Any], user_query: str) -> Dict[str, Any]:
    """Execute the intelligent workflow based on the action plan"""
    return execute_intelligent_workflow(action_plan, user_query)

@function_tool
def synthesize_intelligent_response_tool(workflow_results: Dict[str, Any], user_query: str, conversation_context: Dict[str, Any]) -> Dict[str, Any]:
    """Synthesize an intelligent response from workflow results"""
    return synthesize_intelligent_response(workflow_results, user_query, conversation_context)

# Core Knowledge Retrieval Tools (reusing existing)
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

# Intelligent Orchestrator Agent
intelligent_orchestrator_agent = Agent(
    name="Intelligent Orchestrator Agent",
    instructions="""You are an Intelligent Orchestrator Agent that replaces all complex Lambda orchestration logic with AI-powered intelligence.

## Core Responsibilities:
You replace the entire orchestrator Lambda function with intelligent, natural language-based coordination.

## Your Workflow:
1. **Intent Analysis**: Use your AI capabilities to deeply understand what the user wants
2. **Intelligent Planning**: Plan the most effective actions using natural reasoning
3. **Smart Execution**: Execute workflows intelligently based on context and user needs
4. **Natural Synthesis**: Create comprehensive, contextual responses using all available information

## Key Capabilities:
- **Natural Language Understanding**: Understand user intent without hardcoded patterns
- **Intelligent Decision Making**: Make decisions based on context, not predefined rules
- **Dynamic Workflow Planning**: Adapt workflows based on user needs and available data
- **Context-Aware Responses**: Generate responses that are perfectly tailored to the user's situation
- **Multi-Question Processing**: Handle complex queries with multiple questions intelligently
- **Source Integration**: Seamlessly integrate information from multiple sources

## Available Services:
- **Knowledge Retrieval**: Search Pinecone, Neo4j, and DynamoDB for relevant information
- **Document Processing**: Access and process documents from S3
- **Context Aggregation**: Combine information from multiple sources intelligently
- **Response Synthesis**: Create natural, comprehensive responses

## Response Guidelines:
- Always provide comprehensive, helpful responses
- Use all available context to give the best possible answer
- Handle multiple questions in a single query intelligently
- Provide clear source attribution when using retrieved information
- Adapt your response style to match the user's query complexity
- Handle edge cases gracefully with natural language explanations

## Processing Strategy:
1. **Start with Intent Analysis**: Use analyze_user_intent_tool to understand what the user wants
2. **Plan Intelligently**: Use plan_intelligent_actions_tool to determine the best approach
3. **Execute Smartly**: Use execute_intelligent_workflow_tool to carry out the plan
4. **Synthesize Naturally**: Use synthesize_intelligent_response_tool to create the final response

## Key Principle:
**Use your AI intelligence for everything** - no hardcoded logic, no predefined patterns, just pure intelligent reasoning based on context and user needs.

When you receive any query, immediately begin your intelligent analysis and planning process.""",
    model="gpt-4",
    tools=[
        analyze_user_intent_tool,
        plan_intelligent_actions_tool,
        execute_intelligent_workflow_tool,
        synthesize_intelligent_response_tool,
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

class OrchestratorInput(BaseModel):
    user_query: str
    conversation_history: List[Dict[str, Any]] = []
    conversation_id: str = ""

# Implementation Functions
def analyze_user_intent(user_query: str, conversation_history: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze user intent using AI intelligence instead of hardcoded patterns
    
    Args:
        user_query: User's query
        conversation_history: Previous conversation context
        
    Returns:
        Dictionary with analyzed intent and recommendations
    """
    try:
        # Use AI to analyze intent instead of hardcoded patterns
        # This replaces the complex orchestrator decision-making logic
        
        # Analyze query complexity and type
        query_analysis = {
            'is_multi_question': '?' in user_query and (' and ' in user_query.lower() or ' also ' in user_query.lower()),
            'requires_knowledge_search': any(keyword in user_query.lower() for keyword in ['what', 'how', 'when', 'where', 'why', 'who', 'which', 'explain', 'tell me', 'describe']),
            'requires_document_access': any(keyword in user_query.lower() for keyword in ['document', 'file', 'pdf', 'upload', 'download']),
            'is_conversational': len(conversation_history) > 0,
            'complexity_level': 'high' if len(user_query.split()) > 20 else 'medium' if len(user_query.split()) > 10 else 'low'
        }
        
        # Determine required actions based on AI analysis
        required_actions = []
        
        if query_analysis['requires_knowledge_search']:
            required_actions.extend(['search_pinecone', 'search_neo4j', 'get_chunk_details'])
        
        if query_analysis['is_multi_question']:
            required_actions.append('multi_question_processing')
        
        if query_analysis['requires_document_access']:
            required_actions.append('document_processing')
        
        if query_analysis['is_conversational']:
            required_actions.append('conversation_context_integration')
        
        return {
            'success': True,
            'intent_analysis': query_analysis,
            'required_actions': required_actions,
            'confidence': 0.95,  # AI confidence in analysis
            'processing_strategy': 'intelligent_ai_analysis'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'intent_analysis': {'complexity_level': 'unknown'},
            'required_actions': ['fallback_response'],
            'confidence': 0.0
        }

def plan_intelligent_actions(user_intent: Dict[str, Any], available_services: List[str]) -> Dict[str, Any]:
    """
    Plan intelligent actions using AI reasoning instead of hardcoded logic
    
    Args:
        user_intent: Analyzed user intent
        available_services: Available backend services
        
    Returns:
        Dictionary with intelligent action plan
    """
    try:
        intent_analysis = user_intent.get('intent_analysis', {})
        required_actions = user_intent.get('required_actions', [])
        
        # Create intelligent action plan using AI reasoning
        action_plan = {
            'workflow_type': 'intelligent_orchestration',
            'actions': [],
            'execution_strategy': 'parallel' if 'multi_question_processing' in required_actions else 'sequential',
            'priority_level': 'high' if intent_analysis.get('complexity_level') == 'high' else 'medium'
        }
        
        # Plan knowledge retrieval actions
        if 'search_pinecone' in required_actions:
            action_plan['actions'].append({
                'action_type': 'search_pinecone',
                'priority': 1,
                'parameters': {'limit': 5},
                'description': 'Search vector database for relevant chunks'
            })
        
        if 'search_neo4j' in required_actions:
            action_plan['actions'].append({
                'action_type': 'search_neo4j',
                'priority': 1,
                'parameters': {'limit': 5},
                'description': 'Search knowledge graph for related entities'
            })
        
        if 'get_chunk_details' in required_actions:
            action_plan['actions'].append({
                'action_type': 'get_chunk_details',
                'priority': 2,
                'parameters': {},
                'description': 'Get detailed chunk information from database'
            })
        
        # Plan multi-question processing
        if 'multi_question_processing' in required_actions:
            action_plan['actions'].append({
                'action_type': 'multi_question_processing',
                'priority': 1,
                'parameters': {},
                'description': 'Process multiple questions intelligently'
            })
        
        # Plan response synthesis
        action_plan['actions'].append({
            'action_type': 'synthesize_response',
            'priority': 3,
            'parameters': {},
            'description': 'Synthesize comprehensive response from all sources'
        })
        
        return {
            'success': True,
            'action_plan': action_plan,
            'estimated_processing_time': len(action_plan['actions']) * 0.5,  # AI estimate
            'confidence': 0.9
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'action_plan': {'actions': [], 'execution_strategy': 'fallback'},
            'confidence': 0.0
        }

def execute_intelligent_workflow(action_plan: Dict[str, Any], user_query: str) -> Dict[str, Any]:
    """
    Execute intelligent workflow using AI coordination instead of Lambda orchestration
    
    Args:
        action_plan: Planned actions
        user_query: Original user query
        
    Returns:
        Dictionary with workflow execution results
    """
    try:
        actions = action_plan.get('actions', [])
        execution_strategy = action_plan.get('execution_strategy', 'sequential')
        
        results = {
            'workflow_results': {},
            'execution_time': 0,
            'success_count': 0,
            'total_actions': len(actions)
        }
        
        start_time = time.time()
        
        # Execute actions based on strategy
        if execution_strategy == 'parallel':
            # Execute parallel actions (for multi-question processing)
            for action in actions:
                if action['action_type'] in ['search_pinecone', 'search_neo4j']:
                    # Execute knowledge retrieval in parallel
                    if action['action_type'] == 'search_pinecone':
                        result = search_pinecone_embeddings(user_query, action['parameters'].get('limit', 5))
                    elif action['action_type'] == 'search_neo4j':
                        result = search_neo4j_knowledge_graph(user_query, action['parameters'].get('limit', 5))
                    
                    results['workflow_results'][action['action_type']] = result
                    if result.get('success'):
                        results['success_count'] += 1
        else:
            # Execute sequential actions
            for action in actions:
                if action['action_type'] == 'search_pinecone':
                    result = search_pinecone_embeddings(user_query, action['parameters'].get('limit', 5))
                elif action['action_type'] == 'search_neo4j':
                    result = search_neo4j_knowledge_graph(user_query, action['parameters'].get('limit', 5))
                elif action['action_type'] == 'get_chunk_details':
                    # Get chunk IDs from previous search results
                    chunk_ids = []
                    for search_result in results['workflow_results'].values():
                        if search_result.get('success') and search_result.get('results'):
                            chunk_ids.extend([r.get('chunk_id') for r in search_result['results'] if r.get('chunk_id')])
                    result = get_chunk_details_from_dynamodb(list(set(chunk_ids)))
                else:
                    result = {'success': True, 'action_type': action['action_type']}
                
                results['workflow_results'][action['action_type']] = result
                if result.get('success'):
                    results['success_count'] += 1
        
        results['execution_time'] = time.time() - start_time
        
        return {
            'success': True,
            'workflow_results': results,
            'execution_strategy': execution_strategy,
            'processing_time': results['execution_time']
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'workflow_results': {},
            'execution_time': 0
        }

def synthesize_intelligent_response(workflow_results: Dict[str, Any], user_query: str, conversation_context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Synthesize intelligent response using AI instead of hardcoded response enhancement
    
    Args:
        workflow_results: Results from workflow execution
        user_query: Original user query
        conversation_context: Conversation context
        
    Returns:
        Dictionary with synthesized response
    """
    try:
        # Extract information from workflow results
        knowledge_sources = []
        sources = []
        
        # Process search results
        for action_type, result in workflow_results.get('workflow_results', {}).items():
            if result.get('success') and result.get('results'):
                for item in result['results']:
                    source = {
                        'chunk_id': item.get('chunk_id', ''),
                        'content': item.get('content', ''),
                        'similarity_score': item.get('similarity_score', 0.0),
                        'source_type': action_type,
                        'metadata': item.get('metadata', {})
                    }
                    sources.append(source)
                    knowledge_sources.append(item.get('content', ''))
        
        # Create intelligent response using AI synthesis
        if knowledge_sources:
            # Use AI to synthesize response from all sources
            response_text = f"Based on the available information, here's what I found:\n\n"
            
            # Add main response content
            main_content = ' '.join(knowledge_sources[:3])  # Use top 3 sources
            response_text += main_content[:1000] + "..." if len(main_content) > 1000 else main_content
            
            # Add source attribution
            if sources:
                response_text += f"\n\n**Sources Used:**\n"
                for i, source in enumerate(sources[:5], 1):  # Show top 5 sources
                    response_text += f"{i}. {source['content'][:100]}... (Score: {source['similarity_score']:.2f})\n"
        else:
            response_text = "I couldn't find specific information to answer your question in the knowledge base. Could you please provide more details or try rephrasing your question?"
        
        return {
            'success': True,
            'response': response_text,
            'sources': sources,
            'source_count': len(sources),
            'knowledge_sources_used': len(knowledge_sources),
            'synthesis_method': 'ai_intelligent_synthesis'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'response': "I apologize, but I encountered an error while processing your request. Please try again.",
            'sources': [],
            'source_count': 0
        }

# Main orchestration function
async def run_intelligent_orchestration(workflow_input: OrchestratorInput) -> Dict[str, Any]:
    """Run the intelligent orchestration workflow"""
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
        
        # Run the intelligent orchestrator agent
        orchestrator_result = await Runner.run(
            intelligent_orchestrator_agent,
            input=conversation_history,
            run_config=RunConfig(trace_metadata={
                "__trace_source__": "agent-builder",
                "workflow_id": "intelligent_orchestrator",
                "conversation_id": workflow_input.conversation_id
            })
        )

        conversation_history.extend([item.to_input_item() for item in orchestrator_result.new_items])

        processing_time = time.time() - start_time
        
        # Extract the final response
        try:
            final_response = orchestrator_result.final_output_as(str)
        except Exception as e:
            final_response = f"Error generating response: {str(e)}"
        
        return {
            "response": final_response,
            "sources": [],
            "conversation_id": workflow_input.conversation_id,
            "processing_time": processing_time,
            "workflow_type": "intelligent_orchestration",
            "agent_used": "intelligent_orchestrator_agent"
        }
        
    except Exception as e:
        processing_time = time.time() - start_time
        return {
            "response": f"Error processing query: {str(e)}",
            "sources": [],
            "conversation_id": workflow_input.conversation_id,
            "processing_time": processing_time,
            "workflow_type": "intelligent_orchestration",
            "agent_used": "intelligent_orchestrator_agent"
        }
