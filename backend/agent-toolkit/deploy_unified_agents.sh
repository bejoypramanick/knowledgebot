#!/bin/bash

# Deploy Unified Intelligent Agents
# This script deploys AI-powered agents that replace ALL Lambda functions

set -e

echo "🧠 Deploying Unified Intelligent Agents..."

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
echo "📦 Creating unified agent deployment packages..."

# Create unified chat agent package
echo "Creating unified chat agent package..."
zip -r unified-chat-agent.zip \
  lambda_handlers_unified.py \
  unified_intelligent_agent.py \
  intelligent_orchestrator_agent.py \
  intelligent_response_agent.py \
  retrieval_workflow.py \
  document_ingestion_workflow.py \
  custom_functions.py \
  agent_configurations.py \
  -x "*.pyc" "*/__pycache__/*" "*.git*"

# Create unified document processing agent package
echo "Creating unified document processing agent package..."
zip -r unified-document-agent.zip \
  lambda_handlers_unified.py \
  unified_intelligent_agent.py \
  intelligent_orchestrator_agent.py \
  intelligent_response_agent.py \
  retrieval_workflow.py \
  document_ingestion_workflow.py \
  custom_functions.py \
  agent_configurations.py \
  -x "*.pyc" "*/__pycache__/*" "*.git*"

# 4. Deploy Lambda functions
echo "🚀 Deploying Unified Intelligent Lambda functions..."

# Deploy Unified Chat Agent (replaces orchestrator, claude-decision, response-enhancement, etc.)
echo "Deploying Unified Chat Agent..."
aws lambda update-function-code \
  --function-name chatbot-unified-chat-agent \
  --zip-file fileb://unified-chat-agent.zip \
  --region ap-south-1 || \
aws lambda create-function \
  --function-name chatbot-unified-chat-agent \
  --runtime python3.9 \
  --role arn:aws:iam::090163643302:role/chatbot-agent-lambda-role \
  --handler lambda_handlers_unified.lambda_handler_unified_chat \
  --zip-file fileb://unified-chat-agent.zip \
  --timeout 900 \
  --memory-size 3008 \
  --region ap-south-1

# Deploy Unified Document Processing Agent (replaces document-management, rag-processor, etc.)
echo "Deploying Unified Document Processing Agent..."
aws lambda update-function-code \
  --function-name chatbot-unified-document-agent \
  --zip-file fileb://unified-document-agent.zip \
  --region ap-south-1 || \
aws lambda create-function \
  --function-name chatbot-unified-document-agent \
  --runtime python3.9 \
  --role arn:aws:iam::090163643302:role/chatbot-agent-lambda-role \
  --handler lambda_handlers_unified.lambda_handler_unified_document_ingestion \
  --zip-file fileb://unified-document-agent.zip \
  --timeout 900 \
  --memory-size 3008 \
  --region ap-south-1

# 5. Update Lambda environment variables
echo "🔧 Updating Lambda environment variables..."

# Update Unified Chat Agent environment
aws lambda update-function-configuration \
  --function-name chatbot-unified-chat-agent \
  --environment Variables="{
    OPENAI_API_KEY=${OPENAI_API_KEY},
    PINECONE_API_KEY=${PINECONE_API_KEY},
    PINECONE_ENVIRONMENT=${PINECONE_ENVIRONMENT},
    PINECONE_INDEX_NAME=${PINECONE_INDEX_NAME},
    NEO4J_URI=${NEO4J_URI},
    NEO4J_USER=${NEO4J_USER},
    NEO4J_PASSWORD=${NEO4J_PASSWORD},
    AWS_REGION=${AWS_REGION},
    DOCUMENTS_BUCKET=${DOCUMENTS_BUCKET},
    EMBEDDINGS_BUCKET=${EMBEDDINGS_BUCKET},
    KNOWLEDGE_BASE_TABLE=${KNOWLEDGE_BASE_TABLE},
    METADATA_TABLE=${METADATA_TABLE}
  }" \
  --region ap-south-1

# Update Unified Document Processing Agent environment
aws lambda update-function-configuration \
  --function-name chatbot-unified-document-agent \
  --environment Variables="{
    OPENAI_API_KEY=${OPENAI_API_KEY},
    PINECONE_API_KEY=${PINECONE_API_KEY},
    PINECONE_ENVIRONMENT=${PINECONE_ENVIRONMENT},
    PINECONE_INDEX_NAME=${PINECONE_INDEX_NAME},
    NEO4J_URI=${NEO4J_URI},
    NEO4J_USER=${NEO4J_USER},
    NEO4J_PASSWORD=${NEO4J_PASSWORD},
    AWS_REGION=${AWS_REGION},
    DOCUMENTS_BUCKET=${DOCUMENTS_BUCKET},
    EMBEDDINGS_BUCKET=${EMBEDDINGS_BUCKET},
    KNOWLEDGE_BASE_TABLE=${KNOWLEDGE_BASE_TABLE},
    METADATA_TABLE=${METADATA_TABLE}
  }" \
  --region ap-south-1

# 6. Update Lambda handler configuration
echo "🔧 Updating Lambda handler configuration..."

# Update Unified Chat Agent handler
aws lambda update-function-configuration \
  --function-name chatbot-unified-chat-agent \
  --handler lambda_handlers_unified.lambda_handler_unified_chat \
  --region ap-south-1

# Update Unified Document Processing Agent handler
aws lambda update-function-configuration \
  --function-name chatbot-unified-document-agent \
  --handler lambda_handlers_unified.lambda_handler_unified_document_ingestion \
  --region ap-south-1

echo "✅ Unified Intelligent Agents deployment completed successfully!"
echo ""
echo "🎉 Lambda Functions Replaced with AI Intelligence:"
echo "  ❌ chatbot-orchestrator → ✅ chatbot-unified-chat-agent"
echo "  ❌ chatbot-claude-decision → ✅ chatbot-unified-chat-agent"
echo "  ❌ chatbot-response-enhancement → ✅ chatbot-unified-chat-agent"
echo "  ❌ chatbot-response-formatter → ✅ chatbot-unified-chat-agent"
echo "  ❌ chatbot-source-extractor → ✅ chatbot-unified-chat-agent"
echo "  ❌ chatbot-conversation-manager → ✅ chatbot-unified-chat-agent"
echo "  ❌ chatbot-document-management → ✅ chatbot-unified-document-agent"
echo "  ❌ chatbot-rag-processor → ✅ chatbot-unified-document-agent"
echo "  ❌ chatbot-embedding-service → ✅ chatbot-unified-document-agent"
echo ""
echo "📋 Next steps:"
echo "1. Test the unified chat endpoint:"
echo "   curl -X POST 'https://your-api-gateway-url/chat' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"message\": \"test query\"}'"
echo ""
echo "2. Upload a test document to S3:"
echo "   aws s3 cp test-document.pdf s3://${DOCUMENTS_BUCKET}/documents/"
echo ""
echo "3. Check CloudWatch logs for processing status"
echo ""
echo "🧠 Your system now uses AI intelligence instead of complex Lambda logic!"
echo "🎯 Reduced from 16+ Lambda functions to 2 intelligent agents!"
