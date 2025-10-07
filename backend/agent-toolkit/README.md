# OpenAI AgentToolkit Integration for Document Ingestion and Retrieval

This directory contains the complete implementation of a serverless document ingestion and retrieval system using OpenAI AgentToolkit, integrated with your existing chatbot infrastructure.

## 🏗️ Architecture Overview

The system consists of two main workflows:

### 1. Document Ingestion Flow
```
S3 Upload → Lambda Trigger → Agent Processing → Multi-Store
    ↓
[Docling Processing] → [DynamoDB Storage] → [Embedding Generation] → [Pinecone Storage] → [Neo4j Graph]
```

### 2. Retrieval Flow
```
User Query → API Gateway → Agent Processing → Multi-Source Search
    ↓
[Pinecone Search] + [Neo4j Search] + [DynamoDB Lookup] → [Context Aggregation] → [Response Generation]
```

## 📁 Directory Structure

```
backend/agent-toolkit/
├── custom_functions.py          # Custom agent functions for all external services
├── agent_configurations.py     # Complete agent and workflow configurations
├── lambda_handlers.py          # Lambda function handlers and routing
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Multi-stage Docker build for Lambda
├── deploy.sh                   # Deployment script for AWS infrastructure
├── setup-external-services.sh  # External services initialization
├── AGENTBUILDER_CONFIGURATION.md # Step-by-step AgentBuilder setup guide
└── README.md                   # This file
```

## 🚀 Quick Start

### Prerequisites

1. **AWS Account** with appropriate permissions
2. **OpenAI API Key** with GPT-4 access
3. **Pinecone Account** (credentials provided)
4. **Neo4j AuraDB Account** (credentials provided)
5. **GitHub Repository** with Actions enabled

### Step 1: Set Up External Services

```bash
cd backend/agent-toolkit
./setup-external-services.sh
```

This script will:
- ✅ Set up Pinecone vector database
- ✅ Configure Neo4j knowledge graph
- ✅ Create DynamoDB tables
- ✅ Create S3 buckets

### Step 2: Configure GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```
OPENAI_API_KEY=your_openai_api_key_here
PINECONE_API_KEY=pcsk_5bWrRg_EzH7xsyLtbCUHs5m2cmjitteDKvj6hzA3nytCPMvCshqqNHYPHvZMLxUAEvjzKo
PINECONE_ENVIRONMENT=gcp-starter
PINECONE_INDEX_NAME=chatbot-embeddings
NEO4J_URI=neo4j+s://APUPVZS7TOBGnEhwFhZcBBrPDlinyTH2ltHwesQhqTA.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=APUPVZS7TOBGnEhwFhZcBBrPDlinyTH2ltHwesQhqTA
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
```

### Step 3: Deploy Infrastructure

```bash
./deploy.sh
```

This will:
- ✅ Build and push Docker images to ECR
- ✅ Create/update Lambda functions
- ✅ Set up S3 triggers
- ✅ Configure API Gateway

### Step 4: Configure AgentBuilder

Follow the detailed guide in [AGENTBUILDER_CONFIGURATION.md](./AGENTBUILDER_CONFIGURATION.md) to set up your OpenAI agents.

## 🔧 Custom Functions

The system includes comprehensive custom functions for all external services:

### Document Processing
- `download_document_from_s3()` - Download documents from S3
- `process_document_with_docling()` - Extract structured content using Docling
- `store_chunks_in_dynamodb()` - Store chunks in DynamoDB

### Vector Operations
- `generate_embeddings_for_chunks()` - Generate embeddings using SentenceTransformers
- `store_embeddings_in_pinecone()` - Store vectors in Pinecone
- `search_pinecone_embeddings()` - Search for similar vectors

### Knowledge Graph
- `build_knowledge_graph_in_neo4j()` - Build graph relationships
- `search_neo4j_knowledge_graph()` - Search graph for entities

### Context Aggregation
- `get_chunk_details_from_dynamodb()` - Retrieve detailed chunk information
- `aggregate_retrieval_context()` - Combine results from all sources

## 🏢 External Services Integration

### Pinecone Vector Database
- **Index**: `chatbot-embeddings`
- **Dimension**: 384 (all-MiniLM-L6-v2)
- **Metric**: Cosine similarity
- **Credentials**: Provided in configuration

### Neo4j Knowledge Graph
- **Database**: Neo4j AuraDB
- **Constraints**: Document and chunk uniqueness
- **Indexes**: Content, element type, document name
- **Credentials**: Provided in configuration

### DynamoDB Tables
- `chatbot-knowledge-base` - Document chunks
- `chatbot-knowledge-base-metadata` - Document metadata
- `chatbot-conversations` - Chat sessions

### S3 Buckets
- `chatbot-documents-ap-south-1` - Original documents
- `chatbot-embeddings-ap-south-1` - Embedding storage

## 🔄 Workflow Configuration

### Document Ingestion Workflow
1. **Download** → S3 event triggers document download
2. **Process** → Docling extracts structured chunks
3. **Store** → Chunks stored in DynamoDB
4. **Embed** → Generate embeddings for all chunks
5. **Vectorize** → Store embeddings in Pinecone
6. **Graph** → Build knowledge graph in Neo4j
7. **Log** → Record processing completion

### Retrieval Workflow
1. **Search** → Parallel search in Pinecone and Neo4j
2. **Retrieve** → Get detailed chunk information from DynamoDB
3. **Aggregate** → Combine all retrieval results
4. **Respond** → Generate comprehensive response

## 🧪 Testing

### Test Document Upload
```bash
# Get presigned URL
curl -X POST "https://your-api-gateway-url/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"action": "get-upload-url", "filename": "test.pdf", "content_type": "application/pdf"}'

# Upload document to returned URL
# Check Lambda logs for processing
```

### Test Document Retrieval
```bash
curl -X POST "https://your-api-gateway-url/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query": "your search query", "limit": 5}'
```

## 📊 Monitoring

### CloudWatch Logs
- Lambda function execution logs
- Error tracking and debugging
- Performance metrics

### Service Monitoring
- Pinecone index usage and performance
- Neo4j database query performance
- DynamoDB read/write capacity
- S3 storage usage

## 🔧 Configuration

### Environment Variables
All configuration is handled through environment variables set in the Lambda functions:

```python
# OpenAI
OPENAI_API_KEY

# Pinecone
PINECONE_API_KEY
PINECONE_ENVIRONMENT
PINECONE_INDEX_NAME

# Neo4j
NEO4J_URI
NEO4J_USER
NEO4J_PASSWORD

# AWS
AWS_REGION
DOCUMENTS_BUCKET
EMBEDDINGS_BUCKET
KNOWLEDGE_BASE_TABLE
METADATA_TABLE
CONVERSATIONS_TABLE
```

### Lambda Configuration
- **Memory**: 3008 MB (for document processing)
- **Timeout**: 900 seconds (15 minutes)
- **Runtime**: Python 3.11 (Docker container)

## 🚨 Troubleshooting

### Common Issues

1. **Pinecone Connection Failed**
   - Verify API key and environment
   - Check index name and dimension

2. **Neo4j Connection Failed**
   - Verify URI, username, and password
   - Check network connectivity

3. **DynamoDB Access Denied**
   - Verify IAM permissions
   - Check table names and region

4. **S3 Upload Failed**
   - Verify bucket permissions
   - Check presigned URL expiration

### Debug Steps

1. Check Lambda function logs in CloudWatch
2. Verify environment variables are set correctly
3. Test individual functions in isolation
4. Check external service connectivity

## 📈 Performance Optimization

### Lambda Optimization
- Use provisioned concurrency for consistent performance
- Optimize memory allocation based on usage
- Implement connection pooling for external services

### Database Optimization
- Use DynamoDB on-demand billing for variable workloads
- Implement caching for frequently accessed data
- Optimize Neo4j queries with proper indexing

### Vector Search Optimization
- Use appropriate Pinecone pod types for your workload
- Implement query result caching
- Optimize embedding dimensions for your use case

## 🔒 Security

### IAM Permissions
- Least privilege access for Lambda functions
- Separate policies for different operations
- Regular permission audits

### Data Encryption
- S3 server-side encryption
- DynamoDB encryption at rest
- Secure transmission for all API calls

### API Security
- API Gateway throttling and rate limiting
- Input validation and sanitization
- CORS configuration for web access

## 📚 Additional Resources

- [OpenAI AgentBuilder Documentation](https://platform.openai.com/docs/assistants/overview)
- [Pinecone Documentation](https://docs.pinecone.io/)
- [Neo4j Documentation](https://neo4j.com/docs/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Docling Documentation](https://github.com/DS4SD/docling)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is part of the chatbot knowledge base system. Please refer to the main project license.

## 🆘 Support

For support and questions:
- Check the GitHub repository issues
- Review CloudWatch logs
- Consult the troubleshooting guide
- Contact the development team
