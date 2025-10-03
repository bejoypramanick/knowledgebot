#!/bin/bash

echo "🚀 Monitoring GitHub Actions Deployment..."
echo "=========================================="

# Check GitHub Actions workflow status
echo "📋 GitHub Actions Status:"
echo "   https://github.com/bejoypramanick/story-to-style/actions"
echo ""

# Check ECR repository for new images
echo "🐳 Checking ECR for new images..."
aws ecr describe-images --repository-name chatbot-lambda --region ap-south-1 --query 'imageDetails[0].{ImageTags:imageTags,PushedAt:imagePushedAt}' --output table 2>/dev/null || echo "No images found yet"

echo ""

# Check if Lambda function exists
echo "⚡ Checking Lambda function status..."
if aws lambda get-function --function-name chatbot-container --region ap-south-1 >/dev/null 2>&1; then
    echo "✅ Lambda function 'chatbot-container' exists"
    
    # Get function details
    PACKAGE_TYPE=$(aws lambda get-function --function-name chatbot-container --region ap-south-1 --query 'Configuration.PackageType' --output text 2>/dev/null)
    echo "   Package Type: $PACKAGE_TYPE"
    
    # Test the function
    echo ""
    echo "🧪 Testing the function..."
    aws lambda invoke \
      --function-name chatbot-container \
      --payload '{"message": "What documents do you have in your knowledge base?", "session_id": "test-123", "user_id": "test-user"}' \
      --region ap-south-1 \
      response.json >/dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Function invoked successfully"
        echo "📄 Response:"
        cat response.json | jq . 2>/dev/null || cat response.json
        rm -f response.json
    else
        echo "❌ Function invocation failed"
    fi
else
    echo "⏳ Lambda function 'chatbot-container' not found yet"
    echo "   This means the GitHub Actions workflow is still running"
fi

echo ""
echo "📊 Next Steps:"
echo "1. Check GitHub Actions: https://github.com/bejoypramanick/story-to-style/actions"
echo "2. Wait for the workflow to complete (usually 5-10 minutes)"
echo "3. Run this script again to check deployment status"
