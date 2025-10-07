# Python AgentBuilder Implementation

This directory contains the complete Python implementation of OpenAI AgentBuilder workflows for both Document Ingestion and Retrieval, using the `@function_tool` decorator directly.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Python        │    │   Python        │    │   AWS Services  │
│   AgentBuilder  │◄──►│   Custom        │◄──►│  (S3, DynamoDB, │
│   SDKs          │    │   Functions     │    │   Pinecone, etc)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Lambda Handlers│    │  External APIs  │    │  Knowledge Base │
│ (lambda_handlers│    │ (Pinecone, Neo4j│    │  (Vector DB,    │
│ _python.py)     │    │  Docling, etc)  │    │   Graph DB)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Files Structure

### Core Workflow Files
| File | Purpose | Role in Workflow |
|------|---------|------------------|
| [`document_ingestion_workflow.py`](mcp_sequential-thinking_sequentialthinking?thought=Let me read the document ingestion workflow file to show its contents&nextThoughtNeeded=False&thoughtNumber=1&totalThoughts=1) | Document ingestion workflow with 8 tools | **Main ingestion agent** - processes uploaded documents, extracts content, stores in knowledge base |
| [`retrieval_workflow.py`](mcp_sequential-thinking_sequentialthinking?thought=Let me read the retrieval workflow file to show its contents&nextThoughtNeeded=False&thoughtNumber=1&totalThoughts=1) | Retrieval workflow with 5 tools | **Main retrieval agent** - processes user queries, searches multiple sources, aggregates context |
| [`lambda_handlers_python.py`](mcp_sequential-thinking_sequentialthinking?thought=Let me read the Python lambda handlers file to show its contents&nextThoughtNeeded=False&thoughtNumber=1&totalThoughts=1) | Lambda handlers using Python SDKs | **Entry points** - receives events, orchestrates workflows, returns responses |

### Backend Functions
| File | Purpose | Role in Workflow |
|------|---------|------------------|
| [`custom_functions.py`](mcp_sequential-thinking_sequentialthinking?thought=Let me read the custom functions file to show its contents&nextThoughtNeeded=False&thoughtNumber=1&totalThoughts=1) | Core Python functions for all operations | **Backend engine** - implements all tool functions (S3, Pinecone, Neo4j, DynamoDB operations) |
| [`agent_configurations.py`](mcp_sequential-thinking_sequentialthinking?thought=Let me read the agent configurations file to show its contents&nextThoughtNeeded=False&thoughtNumber=1&totalThoughts=1) | Agent configurations and tool definitions | **Tool definitions** - defines all tools with strict parameters, system prompts, workflow steps |

### Deployment & Configuration
| File | Purpose | Role in Workflow |
|------|---------|------------------|
| [`deploy_python.sh`](mcp_sequential-thinking_sequentialthinking?thought=Let me read the Python deployment script to show its contents&nextThoughtNeeded=False&thoughtNumber=1&totalThoughts=1) | Python-only deployment script | **Deployment automation** - installs dependencies, builds, deploys Lambda functions |
| [`requirements.txt`](mcp_sequential-thinking_sequentialthinking?thought=Let me read the requirements file to show its contents&nextThoughtNeeded=False&thoughtNumber=1&totalThoughts=1) | Python dependencies | **Python packages** - all required Python libraries |

## Workflows

### 1. Document Ingestion Workflow
**Tools:**
- `read_s3_data_tool` - Read data from S3 bucket
- `download_document_from_s3_tool` - Download document from S3
- `process_document_with_docling_tool` - Extract structured content
- `store_chunks_in_dynamodb_tool` - Store chunks in DynamoDB
- `generate_embeddings_for_chunks_tool` - Generate vector embeddings
- `store_embeddings_in_pinecone_tool` - Store in Pinecone
- `build_knowledge_graph_in_neo4j_tool` - Build knowledge graph
- `log_processing_status_tool` - Log processing status

**Flow:**
```
S3 Event → Download → Process → Store Chunks → Generate Embeddings → Store Vectors → Build Graph → Log Status
```

### 2. Retrieval Workflow
**Tools:**
- `read_s3_data_tool` - Read data from S3 bucket
- `search_pinecone_embeddings_tool` - Vector search in Pinecone
- `search_neo4j_knowledge_graph_tool` - Graph search in Neo4j
- `get_chunk_details_from_dynamodb_tool` - Get chunk details from DynamoDB
- `aggregate_retrieval_context_tool` - Aggregate all retrieval results

**Flow:**
```
User Query → Parallel Search (Pinecone + Neo4j) → DynamoDB Lookup → Context Aggregation → Response
```

## Setup and Deployment

### Prerequisites
- Python 3.8+
- AWS CLI configured
- Required AWS services (S3, DynamoDB, Lambda, API Gateway)

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Deploy
```bash
./deploy_python.sh
```

## Environment Variables

### Required
```bash
OPENAI_API_KEY=your_openai_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX_NAME=your_pinecone_index_name
NEO4J_URI=your_neo4j_uri
NEO4J_USER=your_neo4j_user
NEO4J_PASSWORD=your_neo4j_password
```

### Optional (with defaults)
```bash
AWS_REGION=ap-south-1
DOCUMENTS_BUCKET=chatbot-documents-ap-south-1
EMBEDDINGS_BUCKET=chatbot-embeddings-ap-south-1
KNOWLEDGE_BASE_TABLE=chatbot-knowledge-base
METADATA_TABLE=chatbot-knowledge-base-metadata
```

## Testing

### Test Retrieval Workflow
```bash
curl -X POST "https://your-api-gateway-url/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the main features?", "limit": 5}'
```

### Test Document Ingestion
```bash
# Upload a document to S3
aws s3 cp test-document.pdf s3://chatbot-documents-ap-south-1/documents/

# Check processing status
aws dynamodb get-item \
  --table-name chatbot-knowledge-base-metadata \
  --key '{"document_id": {"S": "your_document_id"}}'
```

## Response Formats

### Retrieval Response
```json
{
  "response": "Generated response text",
  "sources": [],
  "total_chunks_retrieved": 0,
  "pinecone_matches": 3,
  "neo4j_matches": 2,
  "processing_time": 1.2,
  "query": "original query"
}
```

### Document Ingestion Response
```json
{
  "document_id": "doc_12345",
  "status": "completed",
  "original_filename": "document.pdf",
  "s3_bucket": "chatbot-documents-ap-south-1",
  "s3_key": "documents/12345.pdf",
  "chunks_processed": 25,
  "embeddings_generated": 25,
  "pinecone_vectors_stored": 25,
  "neo4j_nodes_created": 26,
  "dynamodb_items_stored": 25,
  "file_size": 1024000,
  "content_type": "application/pdf",
  "processing_time": 45.2,
  "error_message": "",
  "processed_at": "2024-01-15T10:30:00.000Z"
}
```

## Key Advantages of Python Implementation

### 1. **No Bridge Required**
- Direct integration between AgentBuilder SDKs and Python functions
- No TypeScript/Node.js dependencies
- Simpler deployment and maintenance

### 2. **Native Python Support**
- Full Python type hints and IDE support
- Direct access to Python libraries (pandas, numpy, etc.)
- Better error handling and debugging

### 3. **Simplified Architecture**
- Fewer moving parts
- Direct function calls
- Easier to test and debug

### 4. **Better Performance**
- No subprocess calls
- Direct memory access
- Faster execution

## Monitoring

### CloudWatch Logs
- Retrieval Lambda: `/aws/lambda/chatbot-retrieval-agent`
- Document Ingestion Lambda: `/aws/lambda/chatbot-document-ingestion-agent`

### Key Metrics
- Lambda execution duration
- Error rates
- DynamoDB read/write capacity
- Pinecone query latency
- Neo4j connection status

## Troubleshooting

### Common Issues

1. **Import Errors**
   - Check Python path configuration
   - Verify all dependencies installed
   - Ensure environment variables set

2. **Lambda Timeout Errors**
   - Increase Lambda timeout (max 15 minutes)
   - Check CloudWatch logs for specific errors
   - Verify external service connectivity

3. **Permission Errors**
   - Check IAM roles for Lambda functions
   - Verify S3 bucket permissions
   - Ensure DynamoDB table access

### Debug Commands
```bash
# Check Lambda logs
aws logs tail /aws/lambda/chatbot-retrieval-agent --follow

# Test individual functions
python -c "from custom_functions import search_pinecone_embeddings; print(search_pinecone_embeddings('test query', 5))"

# Test workflow directly
python -c "from retrieval_workflow import run_retrieval_workflow, WorkflowInput; import asyncio; print(asyncio.run(run_retrieval_workflow(WorkflowInput(input_as_text='test query'))))"
```

## Performance Optimization

### Lambda Configuration
- **Retrieval Lambda**: 1024MB memory, 60s timeout
- **Document Ingestion Lambda**: 3008MB memory, 900s timeout

### Parallel Processing
- Both workflows use `parallel_tool_calls=True`
- Retrieval workflow searches Pinecone and Neo4j in parallel
- Document ingestion processes chunks in batches

### Caching
- Pinecone vectors are cached for faster retrieval
- DynamoDB uses consistent reads for critical operations
- Neo4j connection pooling for better performance

## Security

### IAM Permissions
- S3 read/write access for document buckets
- DynamoDB read/write access for knowledge base tables
- Pinecone API access for vector operations
- Neo4j database access for graph operations

### Environment Variables
- All sensitive data stored in Lambda environment variables
- No hardcoded credentials in code
- AWS Secrets Manager integration available

## Scaling

### Horizontal Scaling
- Lambda functions auto-scale based on demand
- Pinecone supports multiple replicas
- Neo4j cluster mode for high availability

### Vertical Scaling
- Increase Lambda memory for better performance
- Use larger Pinecone pod types
- Optimize Neo4j heap size

## Migration from TypeScript Bridge

If you were using the TypeScript bridge implementation:

1. **Remove TypeScript files**: Delete `retrieval-workflow-sdk.ts`, `document-ingestion-workflow-sdk.ts`, `python_bridge.py`
2. **Update Lambda handlers**: Use `lambda_handlers_python.py` instead of `lambda_handlers_integrated.py`
3. **Update deployment**: Use `deploy_python.sh` instead of `deploy_integrated.sh`
4. **Test thoroughly**: Verify all functionality works as expected

## Support

For issues and questions:
1. Check CloudWatch logs first
2. Review this documentation
3. Test individual components
4. Check AWS service status
5. Contact support team

---

**Status**: ✅ Production Ready
**Last Updated**: January 2024
**Version**: 2.0.0 (Python-only)
