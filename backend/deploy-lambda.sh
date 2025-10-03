#!/bin/bash

# Deploy Lambda functions with config file
echo "Deploying Lambda functions with config..."

# Create deployment package for chat handler
echo "Packaging chat-handler..."
cd lambda
zip -r ../chat-handler.zip chat-handler.py
cd ..

# Create deployment package for knowledge base handler
echo "Packaging knowledge-base-handler..."
cd lambda
zip -r ../knowledge-base-handler.zip knowledge-base-handler.py
cd ..

# Create deployment package for order handler
echo "Packaging order-handler..."
cd lambda
zip -r ../order-handler.zip order-handler.py
cd ..

# Add config file to all packages
echo "Adding config file to packages..."
zip -j chat-handler.zip config.py
zip -j knowledge-base-handler.zip config.py
zip -j order-handler.zip config.py

# Deploy to Lambda
echo "Deploying to Lambda..."
aws lambda update-function-code \
    --function-name chatbot-chat-handler \
    --zip-file fileb://chat-handler.zip

aws lambda update-function-code \
    --function-name chatbot-knowledge-base-handler \
    --zip-file fileb://knowledge-base-handler.zip

aws lambda update-function-code \
    --function-name chatbot-order-handler \
    --zip-file fileb://order-handler.zip

echo "Deployment complete!"
echo ""
echo "IMPORTANT: Update your Claude API key in backend/config.py before deploying!"
