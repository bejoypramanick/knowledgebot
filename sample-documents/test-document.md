# Test Document for Knowledge Base

This is a test document to verify the knowledge base upload functionality.

## Features

- Document upload to S3
- Text chunking and processing
- Vector embeddings generation
- Storage in DynamoDB

## Usage

1. Upload this document through the knowledge base management UI
2. Verify it appears in the documents list
3. Test that the chatbot can use this information

## Technical Details

The system processes documents by:
1. Converting to base64 for upload
2. Storing original document in S3
3. Creating text chunks with metadata
4. Generating embeddings for semantic search
5. Storing chunks in DynamoDB for retrieval

This enables the chatbot to provide accurate, context-aware responses based on the uploaded documents.
