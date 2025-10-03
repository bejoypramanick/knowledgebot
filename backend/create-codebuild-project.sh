#!/bin/bash

# Create CodeBuild project for building Lambda container
aws codebuild create-project \
  --name chatbot-lambda-build \
  --description "Build Lambda container image for chatbot" \
  --source type=S3,location=your-source-bucket/source.zip \
  --artifacts type=NO_ARTIFACTS \
  --environment type=LINUX_CONTAINER,image=aws/codebuild/amazonlinux2-x86_64-standard:5.0,computeType=BUILD_GENERAL1_MEDIUM \
  --service-role arn:aws:iam::090163643302:role/CodeBuildServiceRole \
  --region ap-south-1

# Start the build
aws codebuild start-build \
  --project-name chatbot-lambda-build \
  --region ap-south-1
