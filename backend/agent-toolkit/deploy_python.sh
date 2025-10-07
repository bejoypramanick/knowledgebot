#!/bin/bash

# Deploy Python AgentBuilder Workflows
# This script deploys Python-only implementation without TypeScript bridge

set -e

echo "🚀 Deploying Python AgentBuilder Workflows..."

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

# 2. Set up environment variables
echo "🔧 Setting up environment variables..."
export OPENAI_API_KEY="${OPENAI_API_KEY}"
export PINECONE_API_KEY="${PINECONE_API_KEY}"
export PINECONE_ENVIRONMENT="${PINECONE_ENVIRONMENT}"
export PINECONE_INDEX_NAME="${PINECONE_INDEX_NAME}"
export NEO4J_URI="${NEO4J_URI}"
export NEO4J_USER="${NEO4J_USER}"
export NEO4J_PASSWORD="${NEO4J_PASSWORD}"
export AWS_REGION="${AWS_REGION:-ap-south-1}"
export DOCUMENTS_BUCKET="${DOCUMENTS_BUCKET:-chatbot-documents-ap-south-1}"
export EMBEDDINGS_BUCKET="${EMBEDDINGS_BUCKET:-chatbot-embeddings-ap-south-1}"
export KNOWLEDGE_BASE_TABLE="${KNOWLEDGE_BASE_TABLE:-chatbot-knowledge-base}"
export METADATA_TABLE="${METADATA_TABLE:-chatbot-knowledge-base-metadata}"

# 3. Create deployment packages
echo "📦 Creating deployment packages..."

# Create retrieval lambda package
echo "Creating retrieval lambda package..."
zip -r retrieval-lambda-python.zip \
  lambda_handlers_python.py \
  retrieval_workflow.py \
  document_ingestion_workflow.py \
  custom_functions.py \
  agent_configurations.py \
  -x "*.pyc" "*/__pycache__/*" "*.git*"

# Create ingestion lambda package
echo "Creating ingestion lambda package..."
zip -r ingestion-lambda-python.zip \
  lambda_handlers_python.py \
  retrieval_workflow.py \
  document_ingestion_workflow.py \
  custom_functions.py \
  agent_configurations.py \
  -x "*.pyc" "*/__pycache__/*" "*.git*"

# 4. Deploy Lambda functions
echo "🚀 Deploying Lambda functions..."

# Deploy Retrieval Lambda
echo "Deploying Retrieval Lambda..."
aws lambda update-function-code \
  --function-name chatbot-retrieval-agent \
  --zip-file fileb://retrieval-lambda-python.zip \
  --region ap-south-1

# Deploy Document Ingestion Lambda
echo "Deploying Document Ingestion Lambda..."
aws lambda update-function-code \
  --function-name chatbot-document-ingestion-agent \
  --zip-file fileb://ingestion-lambda-python.zip \
  --region ap-south-1

# 5. Update Lambda environment variables
echo "🔧 Updating Lambda environment variables..."

# Run the environment setup script
./setup_aws_environment.sh

# 6. Update Lambda handler configuration
echo "🔧 Updating Lambda handler configuration..."

# Update Retrieval Lambda handler
aws lambda update-function-configuration \
  --function-name chatbot-retrieval-agent \
  --handler lambda_handlers_python.lambda_handler_retrieval \
  --region ap-south-1

# Update Document Ingestion Lambda handler
aws lambda update-function-configuration \
  --function-name chatbot-document-ingestion-agent \
  --handler lambda_handlers_python.lambda_handler_document_ingestion \
  --region ap-south-1

echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Test the retrieval endpoint:"
echo "   curl -X POST 'https://your-api-gateway-url/retrieve' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"query\": \"test query\"}'"
echo ""
echo "2. Upload a test document to S3:"
echo "   aws s3 cp test-document.pdf s3://${DOCUMENTS_BUCKET}/documents/"
echo ""
echo "3. Check CloudWatch logs for processing status"
echo ""
echo "🎉 Your Python AgentBuilder workflows are now live!"
