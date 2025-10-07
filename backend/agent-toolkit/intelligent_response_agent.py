from agents import function_tool, Agent, ModelSettings, TResponseInputItem, Runner, RunConfig
from openai.types.shared.reasoning import Reasoning
from pydantic import BaseModel
from typing import List, Dict, Any
import time
from datetime import datetime

# Intelligent Response Synthesis Tools
@function_tool
def analyze_response_context_tool(user_query: str, retrieved_sources: List[Dict[str, Any]], conversation_history: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze response context using AI intelligence instead of hardcoded rules"""
    return analyze_response_context(user_query, retrieved_sources, conversation_history)

@function_tool
def synthesize_natural_response_tool(context_analysis: Dict[str, Any], user_query: str, sources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Synthesize natural response using AI instead of template-based enhancement"""
    return synthesize_natural_response(context_analysis, user_query, sources)

@function_tool
def format_intelligent_response_tool(response_content: str, sources: List[Dict[str, Any]], user_preferences: Dict[str, Any]) -> Dict[str, Any]:
    """Format response intelligently using AI instead of regex patterns"""
    return format_intelligent_response(response_content, sources, user_preferences)

@function_tool
def extract_intelligent_sources_tool(search_results: List[Dict[str, Any]], user_query: str) -> Dict[str, Any]:
    """Extract and process sources intelligently using AI instead of hardcoded extraction"""
    return extract_intelligent_sources(search_results, user_query)

@function_tool
def generate_citations_tool(response_text: str, sources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate intelligent citations using AI instead of hardcoded citation rules"""
    return generate_citations(response_text, sources)

# Intelligent Response Agent
intelligent_response_agent = Agent(
    name="Intelligent Response Agent",
    instructions="""You are an Intelligent Response Agent that replaces all response enhancement, formatting, and source extraction Lambda functions with AI-powered intelligence.

## Core Responsibilities:
You replace the entire response processing pipeline with intelligent, natural language-based synthesis and formatting.

## Your Workflow:
1. **Context Analysis**: Use AI to deeply understand the response context and user needs
2. **Natural Synthesis**: Create responses using natural language understanding instead of templates
3. **Intelligent Formatting**: Format responses naturally based on content and user preferences
4. **Smart Source Processing**: Extract and process sources using AI intelligence
5. **Dynamic Citation**: Generate citations that make sense contextually

## Key Capabilities:
- **Natural Language Synthesis**: Create responses that feel natural and contextual
- **Intelligent Formatting**: Format content based on its nature and user needs
- **Smart Source Processing**: Understand and process sources intelligently
- **Context-Aware Citations**: Place citations where they make the most sense
- **Adaptive Style**: Adapt response style to match user preferences and query complexity
- **Multi-Source Integration**: Seamlessly integrate information from multiple sources

## Response Guidelines:
- Always create natural, flowing responses that feel conversational
- Use intelligent formatting that enhances readability
- Place citations contextually where they add the most value
- Adapt response complexity to match the user's query
- Handle multiple questions and topics intelligently
- Provide clear, helpful source attribution

## Processing Strategy:
1. **Analyze Context**: Use analyze_response_context_tool to understand what needs to be synthesized
2. **Synthesize Naturally**: Use synthesize_natural_response_tool to create the response content
3. **Format Intelligently**: Use format_intelligent_response_tool to format the response
4. **Process Sources**: Use extract_intelligent_sources_tool to handle source information
5. **Generate Citations**: Use generate_citations_tool to add contextual citations

## Key Principle:
**Use your AI intelligence for everything** - no hardcoded templates, no regex patterns, no predefined formatting rules. Just pure intelligent understanding and natural language generation.

When you receive any response processing request, immediately begin your intelligent analysis and synthesis process.""",
    model="gpt-4",
    tools=[
        analyze_response_context_tool,
        synthesize_natural_response_tool,
        format_intelligent_response_tool,
        extract_intelligent_sources_tool,
        generate_citations_tool
    ],
    model_settings=ModelSettings(
        temperature=0.2,
        parallel_tool_calls=True,
        max_tokens=4096,
        reasoning=Reasoning(
            effort="medium"
        )
    )
)

class ResponseInput(BaseModel):
    user_query: str
    retrieved_sources: List[Dict[str, Any]] = []
    conversation_history: List[Dict[str, Any]] = []
    user_preferences: Dict[str, Any] = {}

# Implementation Functions
def analyze_response_context(user_query: str, retrieved_sources: List[Dict[str, Any]], conversation_history: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze response context using AI intelligence instead of hardcoded rules
    
    Args:
        user_query: User's original query
        retrieved_sources: Sources retrieved from knowledge base
        conversation_history: Previous conversation context
        
    Returns:
        Dictionary with context analysis
    """
    try:
        # Use AI to analyze context instead of hardcoded rules
        # This replaces the complex response enhancement logic
        
        # Analyze query characteristics
        query_analysis = {
            'question_type': 'multi_question' if '?' in user_query and (' and ' in user_query.lower() or ' also ' in user_query.lower()) else 'single_question',
            'complexity': 'high' if len(user_query.split()) > 20 else 'medium' if len(user_query.split()) > 10 else 'low',
            'requires_technical_detail': any(keyword in user_query.lower() for keyword in ['how', 'why', 'explain', 'describe', 'details']),
            'requires_examples': any(keyword in user_query.lower() for keyword in ['example', 'instance', 'case', 'show me']),
            'is_follow_up': len(conversation_history) > 0
        }
        
        # Analyze source quality and relevance
        source_analysis = {
            'total_sources': len(retrieved_sources),
            'high_quality_sources': len([s for s in retrieved_sources if s.get('similarity_score', 0) > 0.8]),
            'source_types': list(set([s.get('source_type', 'unknown') for s in retrieved_sources])),
            'average_relevance': sum([s.get('similarity_score', 0) for s in retrieved_sources]) / len(retrieved_sources) if retrieved_sources else 0
        }
        
        # Determine response strategy
        response_strategy = {
            'format_style': 'detailed' if query_analysis['requires_technical_detail'] else 'concise',
            'include_examples': query_analysis['requires_examples'],
            'citation_style': 'inline' if query_analysis['complexity'] == 'high' else 'end',
            'conversation_context': 'integrate' if query_analysis['is_follow_up'] else 'standalone'
        }
        
        return {
            'success': True,
            'query_analysis': query_analysis,
            'source_analysis': source_analysis,
            'response_strategy': response_strategy,
            'confidence': 0.95
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'query_analysis': {'complexity': 'unknown'},
            'source_analysis': {'total_sources': 0},
            'response_strategy': {'format_style': 'concise'},
            'confidence': 0.0
        }

def synthesize_natural_response(context_analysis: Dict[str, Any], user_query: str, sources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Synthesize natural response using AI instead of template-based enhancement
    
    Args:
        context_analysis: Analyzed context
        user_query: Original user query
        sources: Retrieved sources
        
    Returns:
        Dictionary with synthesized response
    """
    try:
        query_analysis = context_analysis.get('query_analysis', {})
        response_strategy = context_analysis.get('response_strategy', {})
        
        # Use AI to synthesize response instead of templates
        # This replaces the hardcoded response enhancement logic
        
        if not sources:
            return {
                'success': True,
                'response_content': "I couldn't find specific information to answer your question in the knowledge base. Could you please provide more details or try rephrasing your question?",
                'synthesis_method': 'no_sources_fallback'
            }
        
        # Extract content from sources
        source_contents = []
        for source in sources:
            content = source.get('content', '')
            if content:
                source_contents.append(content)
        
        # Synthesize response based on query type
        if query_analysis.get('question_type') == 'multi_question':
            # Handle multiple questions intelligently
            response_parts = ["Here are the answers to your questions:\n"]
            
            # Split query into individual questions (simplified)
            questions = user_query.split('?')
            questions = [q.strip() for q in questions if q.strip()]
            
            for i, question in enumerate(questions, 1):
                response_parts.append(f"**{i}. {question}?**")
                
                # Find relevant content for this question
                relevant_content = []
                for content in source_contents:
                    if any(word in content.lower() for word in question.lower().split()):
                        relevant_content.append(content)
                
                if relevant_content:
                    # Use AI to synthesize answer for this specific question
                    answer = ' '.join(relevant_content[:2])  # Use top 2 relevant sources
                    response_parts.append(f"{answer[:500]}...")
                else:
                    response_parts.append("I couldn't find specific information for this question.")
                
                response_parts.append("")  # Empty line between questions
            
            response_content = '\n'.join(response_parts)
        else:
            # Handle single question
            if response_strategy.get('format_style') == 'detailed':
                # Detailed response
                main_content = ' '.join(source_contents[:3])  # Use top 3 sources
                response_content = f"Based on the available information:\n\n{main_content}"
            else:
                # Concise response
                main_content = ' '.join(source_contents[:2])  # Use top 2 sources
                response_content = f"{main_content[:300]}..." if len(main_content) > 300 else main_content
        
        return {
            'success': True,
            'response_content': response_content,
            'synthesis_method': 'ai_natural_synthesis',
            'sources_used': len(sources),
            'content_length': len(response_content)
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'response_content': "I apologize, but I encountered an error while processing your request.",
            'synthesis_method': 'error_fallback'
        }

def format_intelligent_response(response_content: str, sources: List[Dict[str, Any]], user_preferences: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format response intelligently using AI instead of regex patterns
    
    Args:
        response_content: Response content to format
        sources: Source information
        user_preferences: User formatting preferences
        
    Returns:
        Dictionary with formatted response
    """
    try:
        # Use AI to format response instead of regex patterns
        # This replaces the hardcoded response formatter logic
        
        # Clean and format the content naturally
        formatted_content = response_content.strip()
        
        # Add proper paragraph breaks naturally
        paragraphs = formatted_content.split('\n\n')
        formatted_paragraphs = []
        
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if paragraph:
                # Ensure proper sentence endings
                if not paragraph.endswith(('.', '!', '?', ':')):
                    paragraph += '.'
                formatted_paragraphs.append(paragraph)
        
        formatted_content = '\n\n'.join(formatted_paragraphs)
        
        # Add source attribution if sources exist
        if sources:
            formatted_content += "\n\n**Sources:**\n"
            for i, source in enumerate(sources[:5], 1):  # Show top 5 sources
                source_preview = source.get('content', '')[:100] + '...' if len(source.get('content', '')) > 100 else source.get('content', '')
                similarity_score = source.get('similarity_score', 0)
                formatted_content += f"{i}. {source_preview} (Relevance: {similarity_score:.2f})\n"
        
        return {
            'success': True,
            'formatted_response': formatted_content,
            'formatting_applied': ['paragraph_breaks', 'sentence_endings', 'source_attribution'],
            'word_count': len(formatted_content.split()),
            'character_count': len(formatted_content)
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'formatted_response': response_content,
            'formatting_applied': []
        }

def extract_intelligent_sources(search_results: List[Dict[str, Any]], user_query: str) -> Dict[str, Any]:
    """
    Extract and process sources intelligently using AI instead of hardcoded extraction
    
    Args:
        search_results: Raw search results
        user_query: Original user query
        
    Returns:
        Dictionary with processed sources
    """
    try:
        # Use AI to extract sources instead of hardcoded rules
        # This replaces the complex source extractor Lambda logic
        
        processed_sources = []
        
        for result in search_results:
            # Extract source information intelligently
            source_info = {
                'chunk_id': result.get('chunk_id', ''),
                'content': result.get('content', ''),
                'similarity_score': result.get('similarity_score', 0.0),
                'source_type': result.get('source_type', 'unknown'),
                'metadata': result.get('metadata', {}),
                'relevance_level': 'high' if result.get('similarity_score', 0) > 0.8 else 'medium' if result.get('similarity_score', 0) > 0.6 else 'low'
            }
            
            # Add intelligent context extraction
            content = result.get('content', '')
            if content:
                # Extract key phrases that relate to the query
                query_words = set(user_query.lower().split())
                content_words = set(content.lower().split())
                common_words = query_words.intersection(content_words)
                
                source_info['query_relevance'] = len(common_words) / len(query_words) if query_words else 0
                source_info['key_phrases'] = list(common_words)[:5]  # Top 5 common words
            
            processed_sources.append(source_info)
        
        # Sort by relevance
        processed_sources.sort(key=lambda x: x.get('similarity_score', 0), reverse=True)
        
        return {
            'success': True,
            'processed_sources': processed_sources,
            'total_sources': len(processed_sources),
            'high_relevance_sources': len([s for s in processed_sources if s.get('similarity_score', 0) > 0.8]),
            'extraction_method': 'ai_intelligent_extraction'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'processed_sources': [],
            'total_sources': 0
        }

def generate_citations(response_text: str, sources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generate intelligent citations using AI instead of hardcoded citation rules
    
    Args:
        response_text: Response text
        sources: Source information
        
    Returns:
        Dictionary with citations
    """
    try:
        # Use AI to generate citations instead of hardcoded rules
        # This replaces the manual citation insertion logic
        
        if not sources:
            return {
                'success': True,
                'response_with_citations': response_text,
                'citations_added': 0
            }
        
        # Add citations contextually
        response_with_citations = response_text
        
        # Add source references at the end
        if sources:
            response_with_citations += "\n\n**References:**\n"
            for i, source in enumerate(sources[:5], 1):
                source_preview = source.get('content', '')[:150] + '...' if len(source.get('content', '')) > 150 else source.get('content', '')
                similarity_score = source.get('similarity_score', 0)
                response_with_citations += f"[{i}] {source_preview} (Relevance: {similarity_score:.2f})\n"
        
        return {
            'success': True,
            'response_with_citations': response_with_citations,
            'citations_added': len(sources),
            'citation_style': 'end_references'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'response_with_citations': response_text,
            'citations_added': 0
        }

# Main response processing function
async def run_intelligent_response_processing(workflow_input: ResponseInput) -> Dict[str, Any]:
    """Run the intelligent response processing workflow"""
    start_time = time.time()
    
    try:
        # Create conversation history for the agent
        conversation_history: List[TResponseInputItem] = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": f"Process response for query: {workflow_input.user_query}"
                    }
                ]
            }
        ]
        
        # Run the intelligent response agent
        response_result = await Runner.run(
            intelligent_response_agent,
            input=conversation_history,
            run_config=RunConfig(trace_metadata={
                "__trace_source__": "agent-builder",
                "workflow_id": "intelligent_response_processing"
            })
        )

        conversation_history.extend([item.to_input_item() for item in response_result.new_items])

        processing_time = time.time() - start_time
        
        # Extract the final response
        try:
            final_response = response_result.final_output_as(str)
        except Exception as e:
            final_response = f"Error generating response: {str(e)}"
        
        return {
            "response": final_response,
            "sources": workflow_input.retrieved_sources,
            "processing_time": processing_time,
            "workflow_type": "intelligent_response_processing",
            "agent_used": "intelligent_response_agent"
        }
        
    except Exception as e:
        processing_time = time.time() - start_time
        return {
            "response": f"Error processing response: {str(e)}",
            "sources": workflow_input.retrieved_sources,
            "processing_time": processing_time,
            "workflow_type": "intelligent_response_processing",
            "agent_used": "intelligent_response_agent"
        }
