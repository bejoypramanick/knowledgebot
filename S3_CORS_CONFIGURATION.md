# S3 CORS Configuration Fix for 403 Forbidden Error

## Problem

When uploading documents, you may encounter a 403 Forbidden error on the OPTIONS request (CORS preflight). This happens because the S3 bucket doesn't have CORS configured to allow browser uploads.

## Error Details

```
Request Method: OPTIONS
Status Code: 403 Forbidden
S3 Bucket: pharma-documents-dev-864899869769-us-east-1-v5
```

## Solution: Configure S3 CORS

The S3 bucket needs CORS configuration to allow uploads from your frontend. Here's how to fix it:

### Option 1: Configure via AWS Console

1. Go to AWS S3 Console
2. Select the bucket: `pharma-documents-dev-864899869769-us-east-1-v5`
3. Click on "Permissions" tab
4. Scroll to "Cross-origin resource sharing (CORS)"
5. Click "Edit" and add the following configuration:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD",
            "OPTIONS"
        ],
        "AllowedOrigins": [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:8080",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8080",
            "https://your-domain.com",
            "*"
        ],
        "ExposeHeaders": [
            "ETag",
            "x-amz-request-id",
            "x-amz-id-2"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

6. Save the configuration

### Option 2: Configure via AWS CLI

Run this command to configure CORS:

```bash
aws s3api put-bucket-cors \
  --bucket pharma-documents-dev-864899869769-us-east-1-v5 \
  --cors-configuration '{
    "CORSRules": [
      {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD", "OPTIONS"],
        "AllowedOrigins": [
          "http://localhost:5173",
          "http://localhost:3000",
          "http://localhost:8080",
          "https://your-production-domain.com",
          "*"
        ],
        "ExposeHeaders": [
          "ETag",
          "x-amz-request-id",
          "x-amz-id-2"
        ],
        "MaxAgeSeconds": 3000
      }
    ]
  }' \
  --region us-east-1
```

### Option 3: Add to Terraform/Infrastructure as Code

If you're using Infrastructure as Code, add this to your S3 bucket configuration:

```hcl
resource "aws_s3_bucket" "pharma_documents" {
  bucket = "pharma-documents-dev-864899869769-us-east-1-v5"
  # ... other config
}

resource "aws_s3_bucket_cors_configuration" "pharma_documents" {
  bucket = aws_s3_bucket.pharma_documents.bucket

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD", "OPTIONS"]
    allowed_origins = [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:8080",
      "https://your-production-domain.com",
      "*"
    ]
    expose_headers  = ["ETag", "x-amz-request-id", "x-amz-id-2"]
    max_age_seconds = 3000
  }
}
```

## Required CORS Settings Explained

1. **AllowedHeaders**: `["*"]` - Allow all headers in CORS requests
2. **AllowedMethods**: Must include `PUT` (for upload) and `OPTIONS` (for CORS preflight)
3. **AllowedOrigins**: Your frontend's origin URL(s)
   - For development: `http://localhost:5173` (Vite default)
   - For production: Your actual domain
4. **ExposeHeaders**: Headers the browser can access in response
5. **MaxAgeSeconds**: How long browser caches the preflight response (3000 seconds = ~50 minutes)

## Important Notes

- After configuring CORS, wait a few seconds for changes to propagate
- The preflight request (OPTIONS) must return 200 OK
- Only configure necessary origins for security (avoid wildcard `*` in production)
- If using CloudFront in front of S3, configure CORS there as well

## Testing

After configuring CORS:

1. Try uploading a document again
2. Check browser DevTools Network tab:
   - OPTIONS request should return 200 OK
   - PUT request should complete successfully
3. Check the upload progress in the UI

## Additional Resources

- [AWS S3 CORS Documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html)
- [CORS Preflight Request](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)

