"""
OpenAI AgentToolkit Configuration for Document Ingestion and Retrieval System
This file contains the complete agent configurations for both workflows
"""

# ============================================================================
# DOCUMENT INGESTION AGENT CONFIGURATION
# ============================================================================

DOCUMENT_INGESTION_AGENT_CONFIG = {
    "name": "Document Ingestion Agent",
    "description": "Handles document upload, processing, and storage in the knowledge base",
    "model": "gpt-4",
    "temperature": 0.1,
    "max_tokens": 2000,
    "tools": [
        {
            "name": "read_s3_data",
            "description": "Read data from an S3 bucket",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "bucket_name": {
                        "type": "string",
                        "description": "Name of the S3 bucket"
                    },
                    "object_key": {
                        "type": "string",
                        "description": "Key (path) of the object to read in the bucket"
                    },
                    "aws_region": {
                        "type": "string",
                        "description": "AWS region where the bucket is located"
                    },
                    "file_format": {
                        "type": "string",
                        "description": "Format of the file to read, such as csv, json, or parquet",
                        "enum": [
                            "csv",
                            "json",
                            "parquet",
                            "txt",
                            "other"
                        ]
                    }
                },
                "required": [
                    "bucket_name",
                    "object_key",
                    "aws_region",
                    "file_format"
                ],
                "additionalProperties": False
            }
        },
        {
            "name": "download_document_from_s3",
            "description": "Download a document from S3 bucket for processing",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "s3_bucket": {
                        "type": "string",
                        "description": "S3 bucket name containing the document"
                    },
                    "s3_key": {
                        "type": "string",
                        "description": "S3 object key for the document"
                    }
                },
                "required": [
                    "s3_bucket",
                    "s3_key"
                ],
                "additionalProperties": False
            }
        },
        {
            "name": "process_document_with_docling",
            "description": "Process document using Docling to extract structured content and chunks",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "document_data": {
                        "type": "object",
                        "description": "Document data from S3 including content and metadata"
                    }
                },
                "required": [
                    "document_data"
                ],
                "additionalProperties": False
            }
        },
        {
            "name": "store_chunks_in_dynamodb",
            "description": "Store processed document chunks in DynamoDB",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "chunks": {
                        "type": "array",
                        "description": "List of processed document chunks"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Unique document identifier"
                    }
                },
                "required": [
                    "chunks",
                    "document_id"
                ],
                "additionalProperties": False
            }
        },
        {
            "name": "generate_embeddings_for_chunks",
            "description": "Generate embeddings for document chunks using SentenceTransformers",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "chunks": {
                        "type": "array",
                        "description": "List of document chunks to generate embeddings for"
                    }
                },
                "required": [
                    "chunks"
                ],
                "additionalProperties": False
            }
        },
        {
            "name": "store_embeddings_in_pinecone",
            "description": "Store generated embeddings in Pinecone vector database",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "embeddings_data": {
                        "type": "array",
                        "description": "List of embedding data to store"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Document identifier for metadata"
                    }
                },
                "required": [
                    "embeddings_data",
                    "document_id"
                ],
                "additionalProperties": False
            }
        },
        {
            "name": "build_knowledge_graph_in_neo4j",
            "description": "Build knowledge graph in Neo4j from document chunks",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "chunks": {
                        "type": "array",
                        "description": "List of document chunks to build graph from"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Document identifier for graph nodes"
                    }
                },
                "required": [
                    "chunks",
                    "document_id"
                ],
                "additionalProperties": False
            }
        },
        {
            "name": "log_processing_status",
            "description": "Log processing status and updates to DynamoDB",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "document_id": {
                        "type": "string",
                        "description": "Document identifier"
                    },
                    "status": {
                        "type": "string",
                        "description": "Processing status (processing, completed, error)"
                    },
                    "message": {
                        "type": "string",
                        "description": "Status message or error details"
                    }
                },
                "required": [
                    "document_id",
                    "status",
                    "message"
                ],
                "additionalProperties": False
            }
        }
    ],
    "system_prompt": """You are a Document Ingestion Agent responsible for processing uploaded documents and storing them in the knowledge base.

Your workflow:
1. Download document from S3 when triggered by S3 event
2. Process document using Docling to extract structured chunks
3. Store chunks in DynamoDB with metadata
4. Generate embeddings for all chunks using SentenceTransformers
5. Store embeddings in Pinecone vector database
6. Build knowledge graph in Neo4j with document and chunk relationships
7. Log processing status throughout the workflow

Important guidelines:
- Always handle errors gracefully and log status updates
- Process documents in the correct sequence
- Ensure all data is properly stored before marking as complete
- Use the document_id consistently across all storage systems
- Handle different document types (PDF, DOCX, TXT) appropriately

When you receive an S3 event, extract the bucket and key information and begin processing immediately."""
}

# ============================================================================
# RETRIEVAL AGENT CONFIGURATION
# ============================================================================

RETRIEVAL_AGENT_CONFIG = {
    "name": "Retrieval Agent",
    "description": "Handles query processing, context retrieval, and response generation",
    "model": "gpt-4",
    "temperature": 0.2,
    "max_tokens": 3000,
    "tools": [
        {
            "name": "read_s3_data",
            "description": "Read data from an S3 bucket",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "bucket_name": {
                        "type": "string",
                        "description": "Name of the S3 bucket"
                    },
                    "object_key": {
                        "type": "string",
                        "description": "Key (path) of the object to read in the bucket"
                    },
                    "aws_region": {
                        "type": "string",
                        "description": "AWS region where the bucket is located"
                    },
                    "file_format": {
                        "type": "string",
                        "description": "Format of the file to read, such as csv, json, or parquet",
                        "enum": [
                            "csv",
                            "json",
                            "parquet",
                            "txt",
                            "other"
                        ]
                    }
                },
                "required": [
                    "bucket_name",
                    "object_key",
                    "aws_region",
                    "file_format"
                ],
                "additionalProperties": False
            }
        },
        {
            "name": "search_pinecone_embeddings",
            "description": "Search for similar document chunks using Pinecone vector search",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query to find relevant chunks"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results to return (default: 5)"
                    }
                },
                "required": [
                    "query",
                    "limit"
                ],
                "additionalProperties": False
            }
        },
        {
            "name": "search_neo4j_knowledge_graph",
            "description": "Search knowledge graph in Neo4j for related entities and relationships",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query to find related entities"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results to return (default: 5)"
                    }
                },
                "required": [
                    "query",
                    "limit"
                ],
                "additionalProperties": False
            }
        },
        {
            "name": "get_chunk_details_from_dynamodb",
            "description": "Get detailed chunk information from DynamoDB",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "chunk_ids": {
                        "type": "array",
                        "description": "List of chunk IDs to retrieve details for"
                    }
                },
                "required": [
                    "chunk_ids"
                ],
                "additionalProperties": False
            }
        },
        {
            "name": "aggregate_retrieval_context",
            "description": "Aggregate context from all retrieval sources (Pinecone, Neo4j, DynamoDB)",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "pinecone_results": {
                        "type": "object",
                        "description": "Results from Pinecone vector search"
                    },
                    "neo4j_results": {
                        "type": "object",
                        "description": "Results from Neo4j knowledge graph search"
                    },
                    "dynamodb_chunks": {
                        "type": "object",
                        "description": "Chunk details from DynamoDB"
                    }
                },
                "required": [
                    "pinecone_results",
                    "neo4j_results",
                    "dynamodb_chunks"
                ],
                "additionalProperties": False
            }
        }
    ],
    "system_prompt": """You are a Retrieval Agent responsible for processing user queries and retrieving relevant context from the knowledge base.

Your workflow:
1. Receive user query from chat interface
2. Search Pinecone for semantically similar document chunks
3. Search Neo4j knowledge graph for related entities and relationships
4. Retrieve detailed chunk information from DynamoDB
5. Aggregate all retrieved context
6. Generate comprehensive response using the retrieved context

Important guidelines:
- Always search multiple sources to get comprehensive context
- Prioritize high-quality, relevant chunks for the response
- Handle cases where no relevant context is found
- Provide accurate citations and sources
- Ensure responses are helpful and contextually appropriate
- Use the aggregated context to generate informative responses

When you receive a query, immediately begin searching all available sources in parallel for maximum efficiency."""
}

# ============================================================================
# WORKFLOW CONFIGURATIONS
# ============================================================================

DOCUMENT_INGESTION_WORKFLOW = {
    "name": "Document Ingestion Workflow",
    "description": "Complete workflow for processing uploaded documents",
    "steps": [
        {
            "step_id": "download_document",
            "name": "Download Document from S3",
            "agent": "Document Ingestion Agent",
            "function": "download_document_from_s3",
            "description": "Download the document from S3 bucket when triggered by S3 event",
            "required": True,
            "retry_count": 3,
            "timeout": 30
        },
        {
            "step_id": "process_with_docling",
            "name": "Process Document with Docling",
            "agent": "Document Ingestion Agent",
            "function": "process_document_with_docling",
            "description": "Extract structured content and chunks using Docling",
            "required": True,
            "retry_count": 2,
            "timeout": 60,
            "depends_on": ["download_document"]
        },
        {
            "step_id": "store_chunks",
            "name": "Store Chunks in DynamoDB",
            "agent": "Document Ingestion Agent",
            "function": "store_chunks_in_dynamodb",
            "description": "Store processed chunks in DynamoDB with metadata",
            "required": True,
            "retry_count": 3,
            "timeout": 30,
            "depends_on": ["process_with_docling"]
        },
        {
            "step_id": "generate_embeddings",
            "name": "Generate Embeddings",
            "agent": "Document Ingestion Agent",
            "function": "generate_embeddings_for_chunks",
            "description": "Generate embeddings for all chunks using SentenceTransformers",
            "required": True,
            "retry_count": 2,
            "timeout": 45,
            "depends_on": ["store_chunks"]
        },
        {
            "step_id": "store_pinecone",
            "name": "Store in Pinecone",
            "agent": "Document Ingestion Agent",
            "function": "store_embeddings_in_pinecone",
            "description": "Store embeddings in Pinecone vector database",
            "required": True,
            "retry_count": 3,
            "timeout": 30,
            "depends_on": ["generate_embeddings"]
        },
        {
            "step_id": "build_knowledge_graph",
            "name": "Build Knowledge Graph",
            "agent": "Document Ingestion Agent",
            "function": "build_knowledge_graph_in_neo4j",
            "description": "Build knowledge graph in Neo4j with relationships",
            "required": True,
            "retry_count": 2,
            "timeout": 45,
            "depends_on": ["store_chunks"]
        },
        {
            "step_id": "log_completion",
            "name": "Log Processing Complete",
            "agent": "Document Ingestion Agent",
            "function": "log_processing_status",
            "description": "Log successful completion of document processing",
            "required": True,
            "retry_count": 1,
            "timeout": 10,
            "depends_on": ["store_pinecone", "build_knowledge_graph"]
        }
    ]
}

RETRIEVAL_WORKFLOW = {
    "name": "Retrieval Workflow",
    "description": "Complete workflow for processing user queries and retrieving context",
    "steps": [
        {
            "step_id": "search_pinecone",
            "name": "Search Pinecone Embeddings",
            "agent": "Retrieval Agent",
            "function": "search_pinecone_embeddings",
            "description": "Search for semantically similar chunks using vector search",
            "required": True,
            "retry_count": 2,
            "timeout": 15,
            "parallel": True
        },
        {
            "step_id": "search_neo4j",
            "name": "Search Neo4j Knowledge Graph",
            "agent": "Retrieval Agent",
            "function": "search_neo4j_knowledge_graph",
            "description": "Search knowledge graph for related entities",
            "required": True,
            "retry_count": 2,
            "timeout": 15,
            "parallel": True
        },
        {
            "step_id": "get_chunk_details",
            "name": "Get Chunk Details",
            "agent": "Retrieval Agent",
            "function": "get_chunk_details_from_dynamodb",
            "description": "Retrieve detailed chunk information from DynamoDB",
            "required": True,
            "retry_count": 2,
            "timeout": 10,
            "depends_on": ["search_pinecone", "search_neo4j"]
        },
        {
            "step_id": "aggregate_context",
            "name": "Aggregate Retrieval Context",
            "agent": "Retrieval Agent",
            "function": "aggregate_retrieval_context",
            "description": "Combine results from all retrieval sources",
            "required": True,
            "retry_count": 1,
            "timeout": 10,
            "depends_on": ["get_chunk_details"]
        }
    ]
}

# ============================================================================
# LAMBDA INTEGRATION CONFIGURATIONS
# ============================================================================

LAMBDA_INTEGRATION_CONFIG = {
    "document_ingestion_lambda": {
        "name": "chatbot-document-ingestion-agent",
        "description": "Lambda function that triggers document ingestion workflow",
        "trigger": "S3 Event",
        "s3_bucket": "chatbot-documents-ap-south-1",
        "s3_prefix": "documents/",
        "s3_suffix": [".pdf", ".docx", ".txt"],
        "agent_workflow": "Document Ingestion Workflow",
        "timeout": 900,  # 15 minutes
        "memory": 3008,  # 3GB
        "environment_variables": {
            "OPENAI_API_KEY": "${OPENAI_API_KEY}",
            "PINECONE_API_KEY": "${PINECONE_API_KEY}",
            "PINECONE_ENVIRONMENT": "${PINECONE_ENVIRONMENT}",
            "PINECONE_INDEX_NAME": "${PINECONE_INDEX_NAME}",
            "NEO4J_URI": "${NEO4J_URI}",
            "NEO4J_USER": "${NEO4J_USER}",
            "NEO4J_PASSWORD": "${NEO4J_PASSWORD}",
            "AWS_REGION": "ap-south-1",
            "DOCUMENTS_BUCKET": "chatbot-documents-ap-south-1",
            "EMBEDDINGS_BUCKET": "chatbot-embeddings-ap-south-1",
            "KNOWLEDGE_BASE_TABLE": "chatbot-knowledge-base",
            "METADATA_TABLE": "chatbot-knowledge-base-metadata"
        }
    },
    "retrieval_lambda": {
        "name": "chatbot-retrieval-agent",
        "description": "Lambda function that handles query processing and retrieval",
        "trigger": "API Gateway",
        "agent_workflow": "Retrieval Workflow",
        "timeout": 60,  # 1 minute
        "memory": 1024,  # 1GB
        "environment_variables": {
            "OPENAI_API_KEY": "${OPENAI_API_KEY}",
            "PINECONE_API_KEY": "${PINECONE_API_KEY}",
            "PINECONE_ENVIRONMENT": "${PINECONE_ENVIRONMENT}",
            "PINECONE_INDEX_NAME": "${PINECONE_INDEX_NAME}",
            "NEO4J_URI": "${NEO4J_URI}",
            "NEO4J_USER": "${NEO4J_USER}",
            "NEO4J_PASSWORD": "${NEO4J_PASSWORD}",
            "AWS_REGION": "ap-south-1",
            "EMBEDDINGS_BUCKET": "chatbot-embeddings-ap-south-1",
            "KNOWLEDGE_BASE_TABLE": "chatbot-knowledge-base"
        }
    }
}

# ============================================================================
# DYNAMODB SCHEMA DEFINITIONS
# ============================================================================

DYNAMODB_SCHEMAS = {
    "knowledge_base_table": {
        "table_name": "chatbot-knowledge-base",
        "partition_key": "chunk_id",
        "sort_key": None,
        "attributes": [
            {
                "attribute_name": "chunk_id",
                "attribute_type": "S"
            },
            {
                "attribute_name": "document_id",
                "attribute_type": "S"
            }
        ],
        "global_secondary_indexes": [
            {
                "index_name": "document-id-index",
                "partition_key": "document_id",
                "sort_key": "created_at",
                "projection_type": "ALL"
            }
        ],
        "item_schema": {
            "chunk_id": "string (primary key)",
            "document_id": "string (GSI key)",
            "content": "string",
            "hierarchy_level": "number",
            "element_type": "string",
            "page_number": "number",
            "metadata": "map",
            "bbox": "map (optional)",
            "created_at": "string (ISO format)"
        }
    },
    "metadata_table": {
        "table_name": "chatbot-knowledge-base-metadata",
        "partition_key": "document_id",
        "sort_key": None,
        "attributes": [
            {
                "attribute_name": "document_id",
                "attribute_type": "S"
            }
        ],
        "global_secondary_indexes": [],
        "item_schema": {
            "document_id": "string (primary key)",
            "original_filename": "string",
            "s3_bucket": "string",
            "s3_key": "string",
            "chunks_count": "number",
            "processed_at": "string (ISO format)",
            "status": "string",
            "content_type": "string",
            "file_size": "number",
            "message": "string (optional)",
            "updated_at": "string (ISO format, optional)"
        }
    }
}

# ============================================================================
# PINECONE CONFIGURATION
# ============================================================================

PINECONE_CONFIG = {
    "index_name": "chatbot-embeddings",
    "dimension": 384,  # all-MiniLM-L6-v2 dimension
    "metric": "cosine",
    "pods": 1,
    "replicas": 1,
    "pod_type": "p1.x1",
    "metadata_config": {
        "indexed": ["document_id", "chunk_id", "dimension"]
    }
}

# ============================================================================
# NEO4J CONFIGURATION
# ============================================================================

NEO4J_CONFIG = {
    "database": "neo4j",
    "constraints": [
        "CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE",
        "CREATE CONSTRAINT chunk_id IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE"
    ],
    "indexes": [
        "CREATE INDEX document_name IF NOT EXISTS FOR (d:Document) ON (d.name)",
        "CREATE INDEX chunk_content IF NOT EXISTS FOR (c:Chunk) ON (c.content)",
        "CREATE INDEX chunk_element_type IF NOT EXISTS FOR (c:Chunk) ON (c.element_type)"
    ]
}
