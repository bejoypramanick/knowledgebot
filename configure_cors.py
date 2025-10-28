#!/usr/bin/env python3
import json
import subprocess
import sys

# API Gateway ID
api_id = "h51u75mco5"
region = "us-east-1"

# Resources that need CORS
resources = {
    "gprk1p": "/process",
    "al4nkd": "/rag-query",
    "8kozm6": "/presigned-url"
}

def configure_cors_for_resource(resource_id, resource_path):
    print(f"\nConfiguring CORS for {resource_path} (resource: {resource_id})...")
    
    # Put OPTIONS method
    try:
        subprocess.run([
            "aws", "apigateway", "put-method",
            "--rest-api-id", api_id,
            "--resource-id", resource_id,
            "--http-method", "OPTIONS",
            "--authorization-type", "NONE",
            "--region", region
        ], check=True, capture_output=True)
        print(f"  ✓ OPTIONS method added")
    except subprocess.CalledProcessError as e:
        print(f"  ℹ OPTIONS method may already exist")
    
    # Put integration
    try:
        subprocess.run([
            "aws", "apigateway", "put-integration",
            "--rest-api-id", api_id,
            "--resource-id", resource_id,
            "--http-method", "OPTIONS",
            "--type", "MOCK",
            "--request-templates", '{"application/json":"{\"statusCode\": 200}"}',
            "--region", region
        ], check=True, capture_output=True)
        print(f"  ✓ Integration configured")
    except subprocess.CalledProcessError as e:
        print(f"  ℹ Integration may already exist")
    
    # Put method response
    method_response_params = {
        "method.response.header.Access-Control-Allow-Origin": False,
        "method.response.header.Access-Control-Allow-Methods": False,
        "method.response.header.Access-Control-Allow-Headers": False,
        "method.response.header.Access-Control-Max-Age": False,
        "method.response.header.Access-Control-Allow-Credentials": False
    }
    
    try:
        subprocess.run([
            "aws", "apigateway", "put-method-response",
            "--rest-api-id", api_id,
            "--resource-id", resource_id,
            "--http-method", "OPTIONS",
            "--status-code", "200",
            "--response-parameters", json.dumps(method_response_params),
            "--response-models", '{"application/json":"Empty"}',
            "--region", region
        ], check=True, capture_output=True)
        print(f"  ✓ Method response configured")
    except subprocess.CalledProcessError as e:
        print(f"  ℹ Method response may already exist")
    
    # Put integration response
    integration_response_params = {
        "method.response.header.Access-Control-Allow-Origin": "'*'",
        "method.response.header.Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
        "method.response.header.Access-Control-Allow-Headers": "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
        "method.response.header.Access-Control-Max-Age": "'86400'",
        "method.response.header.Access-Control-Allow-Credentials": "'true'"
    }
    
    try:
        subprocess.run([
            "aws", "apigateway", "put-integration-response",
            "--rest-api-id", api_id,
            "--resource-id", resource_id,
            "--http-method", "OPTIONS",
            "--status-code", "200",
            "--response-parameters", json.dumps(integration_response_params),
            "--region", region
        ], check=True, capture_output=True)
        print(f"  ✓ Integration response configured")
    except subprocess.CalledProcessError as e:
        print(f"  ✗ Failed to configure integration response")
        print(f"  Error: {e}")

# Configure CORS for each resource
for resource_id, path in resources.items():
    configure_cors_for_resource(resource_id, path)

print("\n✅ CORS configuration completed!")
print("\n⚠️  Important: You must deploy the API for changes to take effect:")
print(f"   aws apigateway create-deployment --rest-api-id {api_id} --stage-name dev --region {region}")

