#!/bin/bash

# Setup AWS Lambda Environment Variables
# This script sets up environment variables for both Lambda functions

set -e

echo "🔧 Setting up AWS Lambda Environment Variables..."

# Get environment variables from GitHub (if running in CI/CD) or set them manually
OPENAI_API_KEY="${OPENAI_API_KEY}"
PINECONE_API_KEY="${PINECONE_API_KEY}"
PINECONE_ENVIRONMENT="${PINECONE_ENVIRONMENT}"
PINECONE_INDEX_NAME="${PINECONE_INDEX_NAME}"
NEO4J_URI="${NEO4J_URI}"
NEO4J_USER="${NEO4J_USER}"
NEO4J_PASSWORD="${NEO4J_PASSWORD}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
DOCUMENTS_BUCKET="${DOCUMENTS_BUCKET:-chatbot-documents-ap-south-1}"
EMBEDDINGS_BUCKET="${EMBEDDINGS_BUCKET:-chatbot-embeddings-ap-south-1}"
KNOWLEDGE_BASE_TABLE="${KNOWLEDGE_BASE_TABLE:-chatbot-knowledge-base}"
METADATA_TABLE="${METADATA_TABLE:-chatbot-knowledge-base-metadata}"

# Verify required variables are set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ Error: OPENAI_API_KEY is not set"
    exit 1
fi

if [ -z "$PINECONE_API_KEY" ]; then
    echo "❌ Error: PINECONE_API_KEY is not set"
    exit 1
fi

if [ -z "$NEO4J_URI" ]; then
    echo "❌ Error: NEO4J_URI is not set"
    exit 1
fi

echo "✅ All required environment variables are set"

# Update Retrieval Lambda environment variables
echo "🔧 Updating Retrieval Lambda environment variables..."
aws lambda update-function-configuration \
  --function-name chatbot-retrieval-agent \
  --environment Variables="{
    OPENAI_API_KEY=${OPENAI_API_KEY},
    PINECONE_API_KEY=${PINECONE_API_KEY},
    PINECONE_ENVIRONMENT=${PINECONE_ENVIRONMENT},
    PINECONE_INDEX_NAME=${PINECONE_INDEX_NAME},
    NEO4J_URI=${NEO4J_URI},
    NEO4J_USER=${NEO4J_USER},
    NEO4J_PASSWORD=${NEO4J_PASSWORD},
    AWS_REGION=${AWS_REGION},
    EMBEDDINGS_BUCKET=${EMBEDDINGS_BUCKET},
    KNOWLEDGE_BASE_TABLE=${KNOWLEDGE_BASE_TABLE}
  }" \
  --region ${AWS_REGION}

# Update Document Ingestion Lambda environment variables
echo "🔧 Updating Document Ingestion Lambda environment variables..."
aws lambda update-function-configuration \
  --function-name chatbot-document-ingestion-agent \
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
  --region ${AWS_REGION}

echo "✅ Environment variables updated successfully!"
echo ""
echo "📋 Environment Variables Summary:"
echo "Retrieval Lambda:"
echo "  - OPENAI_API_KEY: ${OPENAI_API_KEY:0:10}..."
echo "  - PINECONE_API_KEY: ${PINECONE_API_KEY:0:10}..."
echo "  - NEO4J_URI: ${NEO4J_URI}"
echo "  - AWS_REGION: ${AWS_REGION}"
echo ""
echo "Document Ingestion Lambda:"
echo "  - OPENAI_API_KEY: ${OPENAI_API_KEY:0:10}..."
echo "  - PINECONE_API_KEY: ${PINECONE_API_KEY:0:10}..."
echo "  - NEO4J_URI: ${NEO4J_URI}"
echo "  - DOCUMENTS_BUCKET: ${DOCUMENTS_BUCKET}"
echo "  - AWS_REGION: ${AWS_REGION}"
