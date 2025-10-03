#!/bin/bash

echo "Checking Lambda function deployment status..."

# Check if the container Lambda function exists
echo "1. Checking if chatbot-container function exists..."
aws lambda get-function --function-name chatbot-container --region ap-south-1 2>/dev/null && echo "✅ Function exists" || echo "❌ Function not found"

# Check if the function is using container image
echo "2. Checking function package type..."
aws lambda get-function --function-name chatbot-container --region ap-south-1 --query 'Configuration.PackageType' --output text 2>/dev/null || echo "Function not found"

# Test the function
echo "3. Testing the function..."
aws lambda invoke \
  --function-name chatbot-container \
  --payload '{"message": "What documents do you have in your knowledge base?", "session_id": "test-123", "user_id": "test-user"}' \
  --region ap-south-1 \
  response.json 2>/dev/null && echo "✅ Function invoked successfully" || echo "❌ Function invocation failed"

# Show response
if [ -f response.json ]; then
  echo "4. Function response:"
  cat response.json | jq . 2>/dev/null || cat response.json
  rm -f response.json
fi

echo "5. Check GitHub Actions status at:"
echo "   https://github.com/bejoypramanick/story-to-style/actions"
