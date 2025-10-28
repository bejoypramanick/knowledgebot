# API Gateway CORS Configuration Fix

## Problem

Your production site at `https://digibot-demo.globistaan.com` is getting CORS errors when accessing the API Gateway:
- `https://h51u75mco5.execute-api.us-east-1.amazonaws.com/dev/knowledge-base`
- `https://h51u75mco5.execute-api.us-east-1.amazonaws.com/dev/process`

The error message:
```
Access to XMLHttpRequest at 'https://h51u75mco5.execute-api.us-east-1.amazonaws.com/dev/knowledge-base' 
from origin 'https://digibot-demo.globistaan.com' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Good News

✅ S3 uploads are working! The file upload to S3 succeeded.

❌ But the API Gateway endpoints need CORS configuration.

## Solution

The API Gateway needs to be configured to allow requests from your production domain.

### Option 1: Configure via AWS Console

1. Go to AWS API Gateway Console
2. Select the API: Your API (with endpoint `h51u75mco5.execute-api.us-east-1.amazonaws.com`)
3. Select the resource (e.g., `/dev`, `/knowledge-base`, `/process`)
4. Click "Actions" → "Enable CORS"
5. Configure:
   - **Access-Control-Allow-Origin**: `https://digibot-demo.globistaan.com`
     - Or add multiple origins: `http://localhost:5173,http://localhost:3000,https://digibot-demo.globistaan.com`
   - **Access-Control-Allow-Methods**: `GET, POST, PUT, DELETE, OPTIONS, HEAD`
   - **Access-Control-Allow-Headers**: `Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token`
   - **Access-Control-Max-Age**: `3000`
6. Click "Enable CORS and replace existing CORS headers"
7. Deploy the API

### Option 2: Configure via AWS CLI

```bash
# For each endpoint that needs CORS
aws apigateway put-integration-response \
  --rest-api-id YOUR_API_ID \
  --resource-id RESOURCE_ID \
  --http-method GET \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin": true}'

# Enable CORS on the API
aws apigatewayv2 update-api \
  --api-id YOUR_API_ID \
  --cors-configuration '{
    "AllowOrigins": [
      "https://digibot-demo.globistaan.com",
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    "AllowMethods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    "AllowHeaders": ["*"],
    "MaxAge": 3000
  }'
```

### Option 3: Add to Terraform/Infrastructure as Code

If managing infrastructure with Terraform:

```hcl
resource "aws_apigatewayv2_api" "api" {
  name          = "pharma-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = [
      "https://digibot-demo.globistaan.com",
      "http://localhost:5173",
      "http://localhost:3000"
    ]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["*"]
    max_age       = 3000
  }
}
```

### Option 4: Serverless Framework (if applicable)

In your `serverless.yml`:

```yaml
cors:
  origin: 'https://digibot-demo.globistaan.com'
  headers:
    - Content-Type
    - X-Amz-Date
    - Authorization
    - X-Api-Key
    - X-Amz-Security-Token
  allowCredentials: true
```

## Endpoints That Need CORS

The following API Gateway endpoints need CORS configuration:

1. `GET /dev/knowledge-base` - For loading documents list
2. `POST /dev/knowledge-base` - For creating documents
3. `POST /dev/process` - For triggering document processing
4. `GET /dev/presigned-url` - For getting presigned upload URLs
5. Any other endpoints used by the frontend

## Testing

After configuring CORS:

1. Wait a few seconds for changes to propagate
2. Try accessing your production site again
3. Check browser DevTools Network tab:
   - OPTIONS request should return 200 OK
   - The actual request should complete successfully

## Quick Test

You can test if CORS is configured by running this curl command:

```bash
curl -X OPTIONS \
  -H "Origin: https://digibot-demo.globistaan.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v \
  https://h51u75mco5.execute-api.us-east-1.amazonaws.com/dev/knowledge-base
```

You should see headers like:
```
Access-Control-Allow-Origin: https://digibot-demo.globistaan.com
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

## Important Notes

- After configuring CORS, you must **redeploy the API**
- The OPTIONS method (CORS preflight) must return 200 OK
- Use specific origins in production (avoid wildcard `*`)
- Include both HTTP and HTTPS origins in development

## Current Status

✅ S3 Upload: Working (no CORS issue)
❌ Document List: CORS error
❌ Document Processing Trigger: CORS error

