# Quick CORS Fix for API Gateway

## The Issue

Your production site `https://digibot-demo.globistaan.com` is getting CORS errors when accessing the API Gateway.

## Quick Fix

Run these commands in your terminal (with AWS credentials configured):

### 1. Configure CORS for /process endpoint

```bash
# Add OPTIONS method
aws apigateway put-method \
  --rest-api-id h51u75mco5 \
  --resource-id gprk1p \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region us-east-1

# Add integration
aws apigateway put-integration \
  --rest-api-id h51u75mco5 \
  --resource-id gprk1p \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region us-east-1

# Add method response
aws apigateway put-method-response \
  --rest-api-id h51u75mco5 \
  --resource-id gprk1p \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Max-Age":false,"method.response.header.Access-Control-Allow-Credentials":false}' \
  --response-models '{"application/json":"Empty"}' \
  --region us-east-1

# Add integration response
aws apigateway put-integration-response \
  --rest-api-id h51u75mco5 \
  --resource-id gprk1p \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'"*"'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'"GET,POST,PUT,DELETE,OPTIONS"'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'"Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"'"'"'","method.response.header.Access-Control-Max-Age":"'"'"'"86400"'"'"'","method.response.header.Access-Control-Allow-Credentials":"'"'"'"true"'"'"'"}' \
  --region us-east-1
```

### 2. Configure CORS for /rag-query endpoint

```bash
# Add OPTIONS method
aws apigateway put-method \
  --rest-api-id h51u75mco5 \
  --resource-id al4nkd \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region us-east-1

# Add integration
aws apigateway put-integration \
  --rest-api-id h51u75mco5 \
  --resource-id al4nkd \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region us-east-1

# Add method response
aws apigateway put-method-response \
  --rest-api-id h51u75mco5 \
  --resource-id al4nkd \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Max-Age":false,"method.response.header.Access-Control-Allow-Credentials":false}' \
  --response-models '{"application/json":"Empty"}' \
  --region us-east-1

# Add integration response
aws apigateway put-integration-response \
  --rest-api-id h51u75mco5 \
  --resource-id al4nkd \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'"*"'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'"GET,POST,PUT,DELETE,OPTIONS"'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'"Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"'"'"'","method.response.header.Access-Control-Max-Age":"'"'"'"86400"'"'"'","method.response.header.Access-Control-Allow-Credentials":"'"'"'"true"'"'"'"}' \
  --region us-east-1
```

### 3. Deploy the API

**IMPORTANT:** You must deploy the API for changes to take effect:

```bash
aws apigateway create-deployment \
  --rest-api-id h51u75mco5 \
  --stage-name dev \
  --region us-east-1 \
  --description "Add CORS support"
```

## Alternative: Use AWS Console

1. Go to AWS API Gateway Console
2. Select API: `pharma-rag-api-dev` (ID: `h51u75mco5`)
3. For each resource (`/process`, `/rag-query`):
   - Click on the resource
   - Click "Actions" → "Enable CORS"
   - Set:
     - Access-Control-Allow-Origin: `*` (or specific domain)
     - Access-Control-Allow-Methods: `GET, POST, PUT, DELETE, OPTIONS`
     - Access-Control-Allow-Headers: `Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token`
   - Click "Enable CORS and replace existing CORS headers"
4. Click "Actions" → "Deploy API" → Select stage `dev` → Deploy

## Test

After deploying, test from your production site. The CORS errors should be resolved.

