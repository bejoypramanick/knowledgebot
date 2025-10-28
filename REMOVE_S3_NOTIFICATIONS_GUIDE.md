# Guide: Remove S3NotificationsStack from Infrastructure

## Problem

The `S3NotificationsStack` was causing your CloudFormation deployment to hang because:
1. It configures automatic S3 triggers
2. Lambda timeout issue
3. UI already handles manual processing via `/process` endpoint

## Solution

Remove or make S3NotificationsStack optional in your infrastructure code.

## Where to Find Your Templates

Your CloudFormation templates are likely in:
- A separate infrastructure repository
- Or deployed via Terraform/CDK/SAM
- Location: Search for files with `S3Notification` or the stack name `pharma-rag-infrastructure-dev-S3NotificationsStack`

## Search in Your Infrastructure Repo

```bash
# Find references to S3Notifications
grep -r "S3Notification" .
grep -r "pharma-rag-infrastructure-dev-S3NotificationsStack" .
```

## Common Scenarios

### Scenario 1: CloudFormation Template

**In your template (likely `main-stack.yaml` or `root-stack.yaml`):**

Find this resource block:

```yaml
Resources:
  S3NotificationsStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: !Sub "https://${S3Bucket}.s3.${AWS::Region}.amazonaws.com/s3-notifications.yaml"
      Parameters:
        DocumentBucket: !Ref DocumentBucket
        DocumentProcessorFunctionArn: !GetAtt ...
        Environment: !Ref Environment
```

**Remove or comment it out:**

```yaml
# Resources:
#   S3NotificationsStack:
#     Type: AWS::CloudFormation::Stack
#     Properties:
#       TemplateURL: !Sub "https://${S3Bucket}.s3.${AWS::Region}.amazonaws.com/s3-notifications.yaml"
#       Parameters:
#         DocumentBucket: !Ref DocumentBucket
#         DocumentProcessorFunctionArn: !GetAtt ...
#         Environment: !Ref Environment
```

### Scenario 2: Terraform

**Find in `main.tf` or similar:**

```hcl
resource "aws_cloudformation_stack" "s3_notifications" {
  name = "pharma-rag-infrastructure-dev-S3NotificationsStack"

  parameters = {
    DocumentBucket        = aws_s3_bucket.documents.id
    DocumentProcessorFunctionArn = aws_lambda_function.processor.arn
    Environment           = var.environment
  }

  template_url = "https://${aws_s3_bucket.deployments.bucket_domain_name}/s3-notifications.yaml"
}
```

**Remove this resource block.**

### Scenario 3: AWS CDK

**Find in your stack definition:**

```typescript
const s3Notifications = new CloudFormationStack(this, 'S3NotificationsStack', {
  templateUrl: 'https://...',
  parameters: {
    DocumentBucket: this.documentsBucket.bucketName,
    ...
  }
});
```

**Remove this construct.**

## Current CloudFormation Status

The stack is being deleted. Once it's fully deleted:

1. **Update your infrastructure templates** (remove S3NotificationsStack)
2. **Package and deploy** your updated templates

## Deploy Updated Stack

```bash
# If using AWS CLI
aws cloudformation package \
  --template-file main-stack.yaml \
  --s3-bucket your-packaging-bucket \
  --output-template packaged-stack.yaml

aws cloudformation deploy \
  --template-file packaged-stack.yaml \
  --stack-name pharma-rag-infrastructure-dev \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

## Alternative: Make It Optional

If you want to keep the option for automatic triggers later, make it conditional:

**In CloudFormation:**

```yaml
Conditions:
  EnableAutoProcessing: !Equals [!Ref AutoProcessingEnabled, 'true']

Resources:
  S3NotificationsStack:
    Type: AWS::CloudFormation::Stack
    Condition: EnableAutoProcessing
    Properties:
      ...
```

**Set parameter:**
```bash
aws cloudformation deploy ... --parameter-overrides AutoProcessingEnabled=false
```

## Verify Current Stack Status

Check if the stack deletion completed:

```bash
aws cloudformation describe-stacks \
  --stack-name pharma-rag-infrastructure-dev-S3NotificationsStack-1KTZR8PE32M3T \
  --region us-east-1
```

When it's deleted, redeploy your main stack without the S3NotificationsStack.

## Notes

✅ **What Still Works:**
- S3 uploads via presigned URLs ✅
- Manual processing via `/process` endpoint ✅
- Document processor Lambda ✅

❌ **What's Removed:**
- Automatic S3 triggers (not needed with manual UI triggers)

## Need Help Finding Templates?

Your infrastructure templates are likely in a separate repository. Look for:
- Repository with "infrastructure", "infra", "terraform", or "cloudformation" in name
- Files with `.yaml`, `.yml`, `.template`, or `.tf` extensions
- Check your CI/CD pipelines or deployment scripts

