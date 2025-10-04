#!/bin/bash

# Deploy Updated Lambda Functions
# This script deploys the updated chat-handler and rag-processor with the Anthropic client fixes

set -e

echo "🚀 Starting deployment of updated Lambda functions..."

# Configuration
REGION="ap-south-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# Function names (update these based on your actual function names)
CHAT_HANDLER_FUNCTION="chatbot-chat-handler"
RAG_PROCESSOR_FUNCTION="chatbot-rag-processor"

echo "📍 Region: $REGION"
echo "🏢 Account ID: $ACCOUNT_ID"
echo "📦 ECR Registry: $ECR_REGISTRY"

# Step 1: Check if ECR repositories exist
echo ""
echo "🔍 Checking ECR repositories..."

# Create ECR repositories if they don't exist
REPOSITORIES=("chatbot-chat-handler" "chatbot-rag-processor")

for repo in "${REPOSITORIES[@]}"; do
    echo "Checking repository: $repo"
    if ! aws ecr describe-repositories --repository-names "$repo" --region "$REGION" >/dev/null 2>&1; then
        echo "Creating ECR repository: $repo"
        aws ecr create-repository \
            --repository-name "$repo" \
            --region "$REGION" \
            --image-scanning-configuration scanOnPush=true \
            --image-tag-mutability MUTABLE
    else
        echo "Repository $repo already exists"
    fi
done

# Step 2: Build and push chat-handler
echo ""
echo "🔨 Building and pushing chat-handler..."

cd lambda/chat-handler

# Build Docker image
docker build -t "chatbot-chat-handler" .

# Tag for ECR
docker tag "chatbot-chat-handler:latest" "$ECR_REGISTRY/chatbot-chat-handler:latest"

# Login to ECR
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"

# Push to ECR
docker push "$ECR_REGISTRY/chatbot-chat-handler:latest"

echo "✅ chat-handler pushed to ECR"

# Step 3: Build and push rag-processor
echo ""
echo "🔨 Building and pushing rag-processor..."

cd ../rag-processor

# Build Docker image
docker build -t "rag-processor" .

# Tag for ECR
docker tag "rag-processor:latest" "$ECR_REGISTRY/chatbot-rag-processor:latest"

# Push to ECR
docker push "$ECR_REGISTRY/chatbot-rag-processor:latest"

echo "✅ rag-processor pushed to ECR"

# Step 4: Update Lambda functions
echo ""
echo "🔄 Updating Lambda functions..."

# Update chat-handler function
echo "Updating $CHAT_HANDLER_FUNCTION..."
aws lambda update-function-code \
    --function-name "$CHAT_HANDLER_FUNCTION" \
    --image-uri "$ECR_REGISTRY/chatbot-chat-handler:latest" \
    --region "$REGION"

# Update rag-processor function
echo "Updating $RAG_PROCESSOR_FUNCTION..."
aws lambda update-function-code \
    --function-name "$RAG_PROCESSOR_FUNCTION" \
    --image-uri "$ECR_REGISTRY/chatbot-rag-processor:latest" \
    --region "$REGION"

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Summary:"
echo "  - chat-handler: Updated with Anthropic client fixes"
echo "  - rag-processor: Updated with Anthropic client fixes"
echo "  - Both functions now have proper error handling"
echo ""
echo "🧪 Test your deployment by sending a message to your chatbot!"
