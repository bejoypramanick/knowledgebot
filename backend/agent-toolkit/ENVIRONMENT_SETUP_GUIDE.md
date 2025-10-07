# Environment Variables Setup Guide

## 🔧 **Environment Variable Flow**

```
GitHub Secrets/Env Vars → CI/CD Pipeline → AWS Lambda Functions
```

## 📋 **Required Environment Variables**

### **Core API Keys**
```bash
OPENAI_API_KEY=sk-...                    # OpenAI API key
PINECONE_API_KEY=pcsk-...                # Pinecone API key
PINECONE_ENVIRONMENT=gcp-starter         # Pinecone environment
PINECONE_INDEX_NAME=chatbot-embeddings   # Pinecone index name
NEO4J_URI=neo4j+s://...                 # Neo4j connection URI
NEO4J_USER=neo4j                        # Neo4j username
NEO4J_PASSWORD=...                      # Neo4j password
```

### **AWS Configuration**
```bash
AWS_REGION=ap-south-1                   # AWS region
DOCUMENTS_BUCKET=chatbot-documents-ap-south-1    # S3 bucket for documents
EMBEDDINGS_BUCKET=chatbot-embeddings-ap-south-1  # S3 bucket for embeddings
KNOWLEDGE_BASE_TABLE=chatbot-knowledge-base      # DynamoDB table for chunks
METADATA_TABLE=chatbot-knowledge-base-metadata   # DynamoDB table for metadata
```

## 🚀 **Setup Methods**

### **Method 1: GitHub Actions (Recommended)**

#### **1.1 Set GitHub Secrets**
Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:
- `OPENAI_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_ENVIRONMENT`
- `PINECONE_INDEX_NAME`
- `NEO4J_URI`
- `NEO4J_USER`
- `NEO4J_PASSWORD`

#### **1.2 Set GitHub Environment Variables**
Go to Settings → Environments → Create environment "production"

Add these environment variables:
- `AWS_REGION=ap-south-1`
- `DOCUMENTS_BUCKET=chatbot-documents-ap-south-1`
- `EMBEDDINGS_BUCKET=chatbot-embeddings-ap-south-1`
- `KNOWLEDGE_BASE_TABLE=chatbot-knowledge-base`
- `METADATA_TABLE=chatbot-knowledge-base-metadata`

#### **1.3 GitHub Actions Workflow**
```yaml
# .github/workflows/deploy.yml
name: Deploy Agent Workflows

on:
  push:
    branches: [main]
    paths: ['backend/agent-toolkit/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ap-south-1
    
    - name: Deploy Python Workflows
      run: |
        cd backend/agent-toolkit
        ./deploy_python.sh
      env:
        OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        PINECONE_API_KEY: ${{ secrets.PINECONE_API_KEY }}
        PINECONE_ENVIRONMENT: ${{ secrets.PINECONE_ENVIRONMENT }}
        PINECONE_INDEX_NAME: ${{ secrets.PINECONE_INDEX_NAME }}
        NEO4J_URI: ${{ secrets.NEO4J_URI }}
        NEO4J_USER: ${{ secrets.NEO4J_USER }}
        NEO4J_PASSWORD: ${{ secrets.NEO4J_PASSWORD }}
        AWS_REGION: ${{ vars.AWS_REGION }}
        DOCUMENTS_BUCKET: ${{ vars.DOCUMENTS_BUCKET }}
        EMBEDDINGS_BUCKET: ${{ vars.EMBEDDINGS_BUCKET }}
        KNOWLEDGE_BASE_TABLE: ${{ vars.KNOWLEDGE_BASE_TABLE }}
        METADATA_TABLE: ${{ vars.METADATA_TABLE }}
```

### **Method 2: Manual Setup**

#### **2.1 Set Local Environment Variables**
```bash
export OPENAI_API_KEY="sk-..."
export PINECONE_API_KEY="pcsk-..."
export PINECONE_ENVIRONMENT="gcp-starter"
export PINECONE_INDEX_NAME="chatbot-embeddings"
export NEO4J_URI="neo4j+s://..."
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="..."
export AWS_REGION="ap-south-1"
export DOCUMENTS_BUCKET="chatbot-documents-ap-south-1"
export EMBEDDINGS_BUCKET="chatbot-embeddings-ap-south-1"
export KNOWLEDGE_BASE_TABLE="chatbot-knowledge-base"
export METADATA_TABLE="chatbot-knowledge-base-metadata"
```

#### **2.2 Run Deployment**
```bash
cd backend/agent-toolkit
./deploy_python.sh
```

### **Method 3: AWS Console Setup**

#### **3.1 Update Retrieval Lambda**
1. Go to AWS Lambda Console
2. Select `chatbot-retrieval-agent`
3. Go to Configuration → Environment variables
4. Add/Edit variables:
   - `OPENAI_API_KEY`
   - `PINECONE_API_KEY`
   - `PINECONE_ENVIRONMENT`
   - `PINECONE_INDEX_NAME`
   - `NEO4J_URI`
   - `NEO4J_USER`
   - `NEO4J_PASSWORD`
   - `AWS_REGION`
   - `EMBEDDINGS_BUCKET`
   - `KNOWLEDGE_BASE_TABLE`

#### **3.2 Update Document Ingestion Lambda**
1. Go to AWS Lambda Console
2. Select `chatbot-document-ingestion-agent`
3. Go to Configuration → Environment variables
4. Add/Edit variables:
   - All variables from Retrieval Lambda
   - `DOCUMENTS_BUCKET`
   - `METADATA_TABLE`

## 🔍 **Verification**

### **Check Environment Variables in AWS**
```bash
# Check Retrieval Lambda environment
aws lambda get-function-configuration \
  --function-name chatbot-retrieval-agent \
  --query 'Environment.Variables' \
  --region ap-south-1

# Check Document Ingestion Lambda environment
aws lambda get-function-configuration \
  --function-name chatbot-document-ingestion-agent \
  --query 'Environment.Variables' \
  --region ap-south-1
```

### **Test Lambda Functions**
```bash
# Test Retrieval Lambda
aws lambda invoke \
  --function-name chatbot-retrieval-agent \
  --payload '{"query": "test query"}' \
  --region ap-south-1 \
  response.json

# Test Document Ingestion Lambda
aws lambda invoke \
  --function-name chatbot-document-ingestion-agent \
  --payload '{"Records": [{"s3": {"bucket": {"name": "test-bucket"}, "object": {"key": "test.pdf"}}}]}' \
  --region ap-south-1 \
  response.json
```

## 🛡️ **Security Best Practices**

### **1. Use AWS Secrets Manager (Recommended)**
```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name "chatbot/openai-api-key" \
  --secret-string "sk-..." \
  --region ap-south-1

# Reference in Lambda environment
aws lambda update-function-configuration \
  --function-name chatbot-retrieval-agent \
  --environment Variables="{
    OPENAI_API_KEY_SECRET_ARN=arn:aws:secretsmanager:ap-south-1:123456789012:secret:chatbot/openai-api-key
  }"
```

### **2. Use IAM Roles**
- Create IAM roles for Lambda functions
- Attach policies for S3, DynamoDB, Pinecone, Neo4j access
- No need to store AWS credentials in environment variables

### **3. Rotate Keys Regularly**
- Set up key rotation for API keys
- Use temporary credentials where possible
- Monitor key usage in CloudWatch

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Environment Variables Not Set**
   ```bash
   # Check if variables are set
   aws lambda get-function-configuration --function-name chatbot-retrieval-agent --query 'Environment.Variables'
   ```

2. **Permission Denied**
   ```bash
   # Check IAM permissions
   aws iam get-role --role-name chatbot-lambda-role
   ```

3. **API Key Invalid**
   ```bash
   # Test API keys
   curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
   ```

4. **External Service Connection Failed**
   ```bash
   # Check network connectivity
   aws lambda invoke --function-name chatbot-retrieval-agent --payload '{"query": "test"}' response.json
   cat response.json
   ```

### **Debug Commands**
```bash
# View Lambda logs
aws logs tail /aws/lambda/chatbot-retrieval-agent --follow

# Test individual components
python -c "import os; print('OPENAI_API_KEY:', os.environ.get('OPENAI_API_KEY', 'NOT SET'))"
```

## 📊 **Environment Variable Summary**

| Variable | Retrieval Lambda | Ingestion Lambda | Purpose |
|----------|------------------|------------------|---------|
| `OPENAI_API_KEY` | ✅ | ✅ | OpenAI API access |
| `PINECONE_API_KEY` | ✅ | ✅ | Pinecone vector DB |
| `PINECONE_ENVIRONMENT` | ✅ | ✅ | Pinecone environment |
| `PINECONE_INDEX_NAME` | ✅ | ✅ | Pinecone index name |
| `NEO4J_URI` | ✅ | ✅ | Neo4j connection |
| `NEO4J_USER` | ✅ | ✅ | Neo4j username |
| `NEO4J_PASSWORD` | ✅ | ✅ | Neo4j password |
| `AWS_REGION` | ✅ | ✅ | AWS region |
| `DOCUMENTS_BUCKET` | ❌ | ✅ | S3 documents bucket |
| `EMBEDDINGS_BUCKET` | ✅ | ✅ | S3 embeddings bucket |
| `KNOWLEDGE_BASE_TABLE` | ✅ | ✅ | DynamoDB chunks table |
| `METADATA_TABLE` | ❌ | ✅ | DynamoDB metadata table |

---

**Status**: ✅ Ready for Production
**Last Updated**: January 2024
