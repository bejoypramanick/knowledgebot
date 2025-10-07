#!/bin/bash

# Setup Missing AWS Resources for Agent Workflows
# This script creates the missing Lambda functions and S3 buckets

set -e

echo "🔧 Setting up missing AWS resources..."

# Set region
AWS_REGION="ap-south-1"

# 1. Create S3 buckets
echo "📦 Creating S3 buckets..."

# Create documents bucket
echo "Creating chatbot-documents-ap-south-1 bucket..."
aws s3 mb s3://chatbot-documents-ap-south-1 --region $AWS_REGION || echo "Bucket may already exist"

# Create embeddings bucket  
echo "Creating chatbot-embeddings-ap-south-1 bucket..."
aws s3 mb s3://chatbot-embeddings-ap-south-1 --region $AWS_REGION || echo "Bucket may already exist"

# 2. Create Lambda functions
echo "🚀 Creating Lambda functions..."

# Create IAM role for Lambda functions
echo "Creating IAM role for Lambda functions..."
aws iam create-role \
  --role-name chatbot-agent-lambda-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "lambda.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }' || echo "Role may already exist"

# Attach policies to the role
echo "Attaching policies to Lambda role..."
aws iam attach-role-policy \
  --role-name chatbot-agent-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole || echo "Policy may already attached"

aws iam attach-role-policy \
  --role-name chatbot-agent-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess || echo "Policy may already attached"

aws iam attach-role-policy \
  --role-name chatbot-agent-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess || echo "Policy may already attached"

# Wait for role to be ready
echo "Waiting for IAM role to be ready..."
sleep 10

# Get the role ARN
ROLE_ARN=$(aws iam get-role --role-name chatbot-agent-lambda-role --query 'Role.Arn' --output text)

# Create a temporary deployment package
echo "Creating temporary deployment package..."
mkdir -p temp_deploy
cd temp_deploy

# Create a simple Python handler for initial creation
cat > lambda_handler.py << 'EOF'
def lambda_handler(event, context):
    return {
        'statusCode': 200,
        'body': 'Agent workflow placeholder - will be updated by deployment script'
    }
EOF

# Create requirements.txt
cat > requirements.txt << 'EOF'
openai>=1.0.0
boto3>=1.26.0
pinecone-client>=2.2.0
neo4j>=5.0.0
docling>=1.0.0
sentence-transformers>=2.2.0
pandas>=2.0.0
agents>=0.1.0
EOF

# Create deployment package
zip -r lambda-deployment.zip lambda_handler.py requirements.txt

# Create Retrieval Lambda function
echo "Creating chatbot-retrieval-agent Lambda function..."
aws lambda create-function \
  --function-name chatbot-retrieval-agent \
  --runtime python3.9 \
  --role $ROLE_ARN \
  --handler lambda_handler.lambda_handler \
  --zip-file fileb://lambda-deployment.zip \
  --timeout 300 \
  --memory-size 1024 \
  --region $AWS_REGION || echo "Function may already exist"

# Create Document Ingestion Lambda function
echo "Creating chatbot-document-ingestion-agent Lambda function..."
aws lambda create-function \
  --function-name chatbot-document-ingestion-agent \
  --runtime python3.9 \
  --role $ROLE_ARN \
  --handler lambda_handler.lambda_handler \
  --zip-file fileb://lambda-deployment.zip \
  --timeout 900 \
  --memory-size 3008 \
  --region $AWS_REGION || echo "Function may already exist"

# Clean up
cd ..
rm -rf temp_deploy

echo "✅ AWS resources setup complete!"
echo ""
echo "📋 Created Resources:"
echo "  - S3 Bucket: chatbot-documents-ap-south-1"
echo "  - S3 Bucket: chatbot-embeddings-ap-south-1"
echo "  - Lambda Function: chatbot-retrieval-agent"
echo "  - Lambda Function: chatbot-document-ingestion-agent"
echo "  - IAM Role: chatbot-agent-lambda-role"
echo ""
echo "🚀 Ready for deployment! Run ./deploy_python.sh to deploy the actual code."
