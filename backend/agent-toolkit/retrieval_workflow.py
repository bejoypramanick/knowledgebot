from agents import function_tool, Agent, ModelSettings, TResponseInputItem, Runner, RunConfig
from openai.types.shared.reasoning import Reasoning
from pydantic import BaseModel
from typing import List, Dict, Any
import time
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

# Agent definition
retrieval_workflow_agent = Agent(
    name="Retrieval Workflow Agent",
    instructions="""You are a Retrieval Agent responsible for processing user queries and retrieving relevant context from the knowledge base.

Your workflow:
1. Receive user query from chat interface
2. Search Pinecone for semantically similar document chunks
3. Search Neo4j knowledge graph for related entities and relationships
4. Retrieve detailed chunk information from DynamoDB
5. Aggregate all retrieved context
6. Generate comprehensive response using the retrieved context

Important guidelines:
- Always search multiple sources to get comprehensive context
- Prioritize high-quality, relevant chunks for the response
- Handle cases where no relevant context is found
- Provide accurate citations and sources
- Ensure responses are helpful and contextually appropriate
- Use the aggregated context to generate informative responses

When you receive a query, immediately begin searching all available sources in parallel for maximum efficiency.""",
    model="gpt-4",
    tools=[
        read_s3_data_tool,
        search_pinecone_embeddings_tool,
        search_neo4j_knowledge_graph_tool,
        get_chunk_details_from_dynamodb_tool,
        aggregate_retrieval_context_tool
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
