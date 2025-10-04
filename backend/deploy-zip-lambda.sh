#!/bin/bash

# Deploy Updated Lambda Functions (ZIP-based)
# This script deploys the updated Lambda functions using ZIP packages

set -e

echo "🚀 Starting deployment of updated Lambda functions (ZIP-based)..."

# Configuration
REGION="ap-south-1"

# Function names (update these based on your actual function names)
CHAT_HANDLER_FUNCTION="chatbot-chat-handler"
RAG_PROCESSOR_FUNCTION="chatbot-rag-processor"

echo "📍 Region: $REGION"

# Step 1: Create deployment packages
echo ""
echo "📦 Creating deployment packages..."

# Create chat-handler package
echo "Packaging chat-handler..."
cd lambda/chat-handler
zip -r ../../chat-handler-updated.zip . -x "*.pyc" "__pycache__/*" "*.git*"
cd ../..

# Create rag-processor package
echo "Packaging rag-processor..."
cd lambda/rag-processor
zip -r ../../rag-processor-updated.zip . -x "*.pyc" "__pycache__/*" "*.git*"
cd ../..

# Add config file to packages
echo "Adding config file to packages..."
zip -j chat-handler-updated.zip config.py
zip -j rag-processor-updated.zip config.py

echo "✅ Packages created successfully"

# Step 2: Deploy to Lambda
echo ""
echo "🔄 Deploying to Lambda..."

# Update chat-handler function
echo "Updating $CHAT_HANDLER_FUNCTION..."
aws lambda update-function-code \
    --function-name "$CHAT_HANDLER_FUNCTION" \
    --zip-file fileb://chat-handler-updated.zip \
    --region "$REGION"

# Update rag-processor function
echo "Updating $RAG_PROCESSOR_FUNCTION..."
aws lambda update-function-code \
    --function-name "$RAG_PROCESSOR_FUNCTION" \
    --zip-file fileb://rag-processor-updated.zip \
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

# Cleanup
echo ""
echo "🧹 Cleaning up temporary files..."
rm -f chat-handler-updated.zip rag-processor-updated.zip
echo "✅ Cleanup completed"
