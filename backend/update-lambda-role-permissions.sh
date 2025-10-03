#!/bin/bash

# Update Lambda role permissions to include ECR access
set -e

REGION="ap-south-1"
ACCOUNT_ID="090163643302"
ROLE_NAME="chatbot-lambda-role"
POLICY_NAME="chatbot-lambda-custom-policy"

echo "🔐 Updating Lambda role permissions for ECR access..."

# Create updated policy with ECR permissions
cat > lambda-updated-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket",
                "s3:HeadObject"
            ],
            "Resource": [
                "arn:aws:s3:::chatbot-documents-ap-south-1",
                "arn:aws:s3:::chatbot-documents-ap-south-1/*",
                "arn:aws:s3:::chatbot-embeddings-ap-south-1",
                "arn:aws:s3:::chatbot-embeddings-ap-south-1/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan"
            ],
            "Resource": [
                "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/chatbot-knowledge-base",
                "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/chatbot-conversations"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "lambda:InvokeFunction"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage"
            ],
            "Resource": "*"
        }
    ]
}
EOF

# Update the existing policy
aws iam create-policy-version \
    --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME} \
    --policy-document file://lambda-updated-policy.json \
    --set-as-default \
    --region $REGION

# Clean up temporary file
rm -f lambda-updated-policy.json

echo "✅ Lambda role permissions updated successfully!"
echo "The role now has ECR permissions to pull container images."
