from agents import function_tool, Agent, ModelSettings, TResponseInputItem, Runner, RunConfig
from pydantic import BaseModel
from typing import List, Dict, Any
import time
import uuid
from datetime import datetime

# Import our existing Python functions
from custom_functions import (
    read_s3_data,
    download_document_from_s3,
    process_document_with_docling,
    store_chunks_in_dynamodb,
    generate_embeddings_for_chunks,
    store_embeddings_in_pinecone,
    build_knowledge_graph_in_neo4j,
    log_processing_status
)

# Tool definitions with proper implementations
@function_tool
def read_s3_data_tool(bucket_name: str, object_key: str, aws_region: str, file_format: str) -> Dict[str, Any]:
    """Read data from an S3 bucket with support for different file formats"""
    return read_s3_data(bucket_name, object_key, aws_region, file_format)

@function_tool
def download_document_from_s3_tool(s3_bucket: str, s3_key: str) -> Dict[str, Any]:
    """Download a document from S3 bucket for processing"""
    return download_document_from_s3(s3_bucket, s3_key)

@function_tool
def process_document_with_docling_tool(document_data: Dict[str, Any]) -> Dict[str, Any]:
    """Process document using Docling to extract structured content and chunks"""
    return process_document_with_docling(document_data)

@function_tool
def store_chunks_in_dynamodb_tool(chunks: List[Dict[str, Any]], document_id: str) -> Dict[str, Any]:
    """Store processed document chunks in DynamoDB"""
    return store_chunks_in_dynamodb(chunks, document_id)

@function_tool
def generate_embeddings_for_chunks_tool(chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate embeddings for document chunks using SentenceTransformers"""
    return generate_embeddings_for_chunks(chunks)

@function_tool
def store_embeddings_in_pinecone_tool(embeddings_data: List[Dict[str, Any]], document_id: str) -> Dict[str, Any]:
    """Store generated embeddings in Pinecone vector database"""
    return store_embeddings_in_pinecone(embeddings_data, document_id)

@function_tool
def build_knowledge_graph_in_neo4j_tool(chunks: List[Dict[str, Any]], document_id: str) -> Dict[str, Any]:
    """Build knowledge graph in Neo4j from document chunks"""
    return build_knowledge_graph_in_neo4j(chunks, document_id)

@function_tool
def log_processing_status_tool(document_id: str, status: str, message: str) -> Dict[str, Any]:
    """Log processing status and updates to DynamoDB"""
    return log_processing_status(document_id, status, message)

# Agent definition
document_ingestion_agent = Agent(
    name="Document Ingestion Agent",
    instructions="""You are a Document Ingestion Agent responsible for processing uploaded documents and storing them in the knowledge base.

Your workflow:
1. Download document from S3 when triggered by S3 event
2. Process document using Docling to extract structured chunks
3. Store chunks in DynamoDB with metadata
4. Generate embeddings for all chunks using SentenceTransformers
5. Store embeddings in Pinecone vector database
6. Build knowledge graph in Neo4j with document and chunk relationships
7. Log processing status throughout the workflow

Important guidelines:
- Always handle errors gracefully and log status updates
- Process documents in the correct sequence
- Ensure all data is properly stored before marking as complete
- Use the document_id consistently across all storage systems
- Handle different document types (PDF, DOCX, TXT) appropriately

When you receive an S3 event, extract the bucket and key information and begin processing immediately""",
    model="gpt-4",
    tools=[
        read_s3_data_tool,
        download_document_from_s3_tool,
        process_document_with_docling_tool,
        store_chunks_in_dynamodb_tool,
        generate_embeddings_for_chunks_tool,
        store_embeddings_in_pinecone_tool,
        build_knowledge_graph_in_neo4j_tool,
        log_processing_status_tool
    ],
    model_settings=ModelSettings(
        temperature=0.1,
        top_p=1,
        parallel_tool_calls=True,
        max_tokens=2048,
        store=True
    )
)

class WorkflowInput(BaseModel):
    input_as_text: str

# Main code entrypoint
async def run_document_ingestion_workflow(workflow_input: WorkflowInput) -> Dict[str, Any]:
    """Run the document ingestion workflow"""
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
        document_ingestion_agent_result_temp = await Runner.run(
            document_ingestion_agent,
            input=conversation_history,
            run_config=RunConfig(trace_metadata={
                "__trace_source__": "agent-builder",
                "workflow_id": "wf_68e52a7e17908190be00d14cda08106e05999cf0fd76ec19"
            })
        )

        conversation_history.extend([item.to_input_item() for item in document_ingestion_agent_result_temp.new_items])

        processing_time = time.time() - start_time
        
        # Extract metadata from tool calls
        tool_calls = []
        for item in document_ingestion_agent_result_temp.new_items:
            if hasattr(item, 'tool_calls') and item.tool_calls:
                tool_calls.extend(item.tool_calls)
        
        # Initialize result with defaults
        end_result = {
            "document_id": str(uuid.uuid4()),
            "status": "completed",
            "original_filename": "",
            "s3_bucket": "",
            "s3_key": "",
            "chunks_processed": 0,
            "embeddings_generated": 0,
            "pinecone_vectors_stored": 0,
            "neo4j_nodes_created": 0,
            "dynamodb_items_stored": 0,
            "file_size": 0,
            "content_type": "",
            "processing_time": processing_time,
            "error_message": "",
            "processed_at": datetime.utcnow().isoformat()
        }
        
        # Try to extract metadata from the agent's response
        try:
            final_output = document_ingestion_agent_result_temp.final_output_as(str)
            if final_output:
                # Parse any metadata from the output if available
                pass
        except Exception as e:
            end_result["error_message"] = f"Error parsing agent output: {str(e)}"
            end_result["status"] = "error"
        
        return end_result
        
    except Exception as e:
        processing_time = time.time() - start_time
        return {
            "document_id": "",
            "status": "error",
            "original_filename": "",
            "s3_bucket": "",
            "s3_key": "",
            "chunks_processed": 0,
            "embeddings_generated": 0,
            "pinecone_vectors_stored": 0,
            "neo4j_nodes_created": 0,
            "dynamodb_items_stored": 0,
            "file_size": 0,
            "content_type": "",
            "processing_time": processing_time,
            "error_message": str(e),
            "processed_at": datetime.utcnow().isoformat()
        }
