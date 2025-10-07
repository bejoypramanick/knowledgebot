#!/bin/bash

# Setup script for external services (Pinecone, Neo4j, DynamoDB)
# This script initializes the required external services for the AgentToolkit system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Setting up external services for OpenAI AgentToolkit${NC}"

# ============================================================================
# PINECONE SETUP
# ============================================================================

echo -e "${YELLOW}Setting up Pinecone vector database...${NC}"

# Check if Pinecone credentials are provided
if [ -z "$PINECONE_API_KEY" ] || [ -z "$PINECONE_ENVIRONMENT" ]; then
    echo -e "${RED}Pinecone credentials not provided. Please set PINECONE_API_KEY and PINECONE_ENVIRONMENT${NC}"
    echo -e "${YELLOW}Using provided credentials:${NC}"
    echo -e "PINECONE_API_KEY: pcsk_5bWrRg_EzH7xsyLtbCUHs5m2cmjitteDKvj6hzA3nytCPMvCshqqNHYPHvZMLxUAEvjzKo"
    echo -e "PINECONE_ENVIRONMENT: gcp-starter"
    
    export PINECONE_API_KEY="pcsk_5bWrRg_EzH7xsyLtbCUHs5m2cmjitteDKvj6hzA3nytCPMvCshqqNHYPHvZMLxUAEvjzKo"
    export PINECONE_ENVIRONMENT="gcp-starter"
fi

# Install Pinecone client
pip install pinecone-client

# Create Python script to setup Pinecone
cat > setup_pinecone.py << 'EOF'
import pinecone
import os
import time

# Initialize Pinecone
pinecone.init(
    api_key=os.environ.get('PINECONE_API_KEY'),
    environment=os.environ.get('PINECONE_ENVIRONMENT')
)

# Index configuration
INDEX_NAME = os.environ.get('PINECONE_INDEX_NAME', 'chatbot-embeddings')
DIMENSION = 384  # all-MiniLM-L6-v2 dimension
METRIC = 'cosine'

print(f"Setting up Pinecone index: {INDEX_NAME}")

# Check if index exists
existing_indexes = pinecone.list_indexes()
if INDEX_NAME in [idx.name for idx in existing_indexes]:
    print(f"Index {INDEX_NAME} already exists")
    
    # Get index stats
    index = pinecone.Index(INDEX_NAME)
    stats = index.describe_index_stats()
    print(f"Index stats: {stats}")
else:
    print(f"Creating index {INDEX_NAME}...")
    
    # Create index
    pinecone.create_index(
        name=INDEX_NAME,
        dimension=DIMENSION,
        metric=METRIC,
        pods=1,
        replicas=1,
        pod_type='p1.x1'
    )
    
    print(f"Index {INDEX_NAME} created successfully")
    
    # Wait for index to be ready
    print("Waiting for index to be ready...")
    while not pinecone.describe_index(INDEX_NAME).status['ready']:
        time.sleep(1)
    
    print("Index is ready!")

print("Pinecone setup completed successfully!")
EOF

python setup_pinecone.py
rm setup_pinecone.py

echo -e "${GREEN}Pinecone setup completed!${NC}"

# ============================================================================
# NEO4J SETUP
# ============================================================================

echo -e "${YELLOW}Setting up Neo4j knowledge graph...${NC}"

# Check if Neo4j credentials are provided
if [ -z "$NEO4J_URI" ] || [ -z "$NEO4J_USER" ] || [ -z "$NEO4J_PASSWORD" ]; then
    echo -e "${RED}Neo4j credentials not provided. Using provided credentials:${NC}"
    echo -e "NEO4J_URI: neo4j+s://APUPVZS7TOBGnEhwFhZcBBrPDlinyTH2ltHwesQhqTA.databases.neo4j.io"
    echo -e "NEO4J_USER: neo4j"
    echo -e "NEO4J_PASSWORD: APUPVZS7TOBGnEhwFhZcBBrPDlinyTH2ltHwesQhqTA"
    
    export NEO4J_URI="neo4j+s://APUPVZS7TOBGnEhwFhZcBBrPDlinyTH2ltHwesQhqTA.databases.neo4j.io"
    export NEO4J_USER="neo4j"
    export NEO4J_PASSWORD="APUPVZS7TOBGnEhwFhZcBBrPDlinyTH2ltHwesQhqTA"
fi

# Install Neo4j driver
pip install neo4j

# Create Python script to setup Neo4j
cat > setup_neo4j.py << 'EOF'
from neo4j import GraphDatabase
import os

# Neo4j connection details
URI = os.environ.get('NEO4J_URI')
USER = os.environ.get('NEO4J_USER')
PASSWORD = os.environ.get('NEO4J_PASSWORD')

print(f"Connecting to Neo4j at {URI}")

# Connect to Neo4j
driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))

def setup_constraints_and_indexes(tx):
    # Create constraints
    constraints = [
        "CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE",
        "CREATE CONSTRAINT chunk_id IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE"
    ]
    
    for constraint in constraints:
        try:
            tx.run(constraint)
            print(f"Created constraint: {constraint}")
        except Exception as e:
            print(f"Constraint may already exist: {e}")
    
    # Create indexes
    indexes = [
        "CREATE INDEX document_name IF NOT EXISTS FOR (d:Document) ON (d.name)",
        "CREATE INDEX chunk_content IF NOT EXISTS FOR (c:Chunk) ON (c.content)",
        "CREATE INDEX chunk_element_type IF NOT EXISTS FOR (c:Chunk) ON (c.element_type)"
    ]
    
    for index in indexes:
        try:
            tx.run(index)
            print(f"Created index: {index}")
        except Exception as e:
            print(f"Index may already exist: {e}")

def test_connection(tx):
    result = tx.run("RETURN 'Neo4j connection successful' as message")
    return result.single()["message"]

try:
    with driver.session() as session:
        # Test connection
        message = session.execute_read(test_connection)
        print(f"Connection test: {message}")
        
        # Setup constraints and indexes
        session.execute_write(setup_constraints_and_indexes)
        
        # Create sample data structure
        session.execute_write(lambda tx: tx.run("""
            MERGE (d:Document {id: 'sample-document'})
            SET d.name = 'Sample Document',
                d.processed_at = datetime(),
                d.chunk_count = 0
        """))
        
        print("Sample document node created")
        
    print("Neo4j setup completed successfully!")
    
except Exception as e:
    print(f"Error setting up Neo4j: {e}")
    raise
finally:
    driver.close()
EOF

python setup_neo4j.py
rm setup_neo4j.py

echo -e "${GREEN}Neo4j setup completed!${NC}"

# ============================================================================
# DYNAMODB SETUP
# ============================================================================

echo -e "${YELLOW}Setting up DynamoDB tables...${NC}"

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Create DynamoDB tables
cat > setup_dynamodb.py << 'EOF'
import boto3
import json
from botocore.exceptions import ClientError

# DynamoDB client
dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')

# Table configurations
tables_config = [
    {
        'table_name': 'chatbot-knowledge-base',
        'partition_key': 'chunk_id',
        'sort_key': None,
        'attributes': [
            {'attribute_name': 'chunk_id', 'attribute_type': 'S'},
            {'attribute_name': 'document_id', 'attribute_type': 'S'}
        ],
        'global_secondary_indexes': [
            {
                'index_name': 'document-id-index',
                'partition_key': 'document_id',
                'sort_key': 'created_at',
                'projection_type': 'ALL'
            }
        ]
    },
    {
        'table_name': 'chatbot-knowledge-base-metadata',
        'partition_key': 'document_id',
        'sort_key': None,
        'attributes': [
            {'attribute_name': 'document_id', 'attribute_type': 'S'}
        ],
        'global_secondary_indexes': []
    },
    {
        'table_name': 'chatbot-conversations',
        'partition_key': 'sessionId',
        'sort_key': 'timestamp',
        'attributes': [
            {'attribute_name': 'sessionId', 'attribute_type': 'S'},
            {'attribute_name': 'timestamp', 'attribute_type': 'S'}
        ],
        'global_secondary_indexes': []
    }
]

def create_table(config):
    table_name = config['table_name']
    
    try:
        # Check if table exists
        table = dynamodb.Table(table_name)
        table.load()
        print(f"Table {table_name} already exists")
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            print(f"Creating table {table_name}...")
            
            # Create table
            table_params = {
                'TableName': table_name,
                'KeySchema': [
                    {'AttributeName': config['partition_key'], 'KeyType': 'HASH'}
                ],
                'AttributeDefinitions': config['attributes'],
                'BillingMode': 'PAY_PER_REQUEST'
            }
            
            # Add sort key if exists
            if config['sort_key']:
                table_params['KeySchema'].append({
                    'AttributeName': config['sort_key'], 
                    'KeyType': 'RANGE'
                })
                table_params['AttributeDefinitions'].append({
                    'AttributeName': config['sort_key'],
                    'AttributeType': 'S'
                })
            
            # Add GSI if exists
            if config['global_secondary_indexes']:
                table_params['GlobalSecondaryIndexes'] = []
                for gsi in config['global_secondary_indexes']:
                    gsi_config = {
                        'IndexName': gsi['index_name'],
                        'KeySchema': [
                            {'AttributeName': gsi['partition_key'], 'KeyType': 'HASH'}
                        ],
                        'Projection': {'ProjectionType': gsi['projection_type']}
                    }
                    
                    if gsi.get('sort_key'):
                        gsi_config['KeySchema'].append({
                            'AttributeName': gsi['sort_key'],
                            'KeyType': 'RANGE'
                        })
                        # Add sort key to attribute definitions if not already present
                        if not any(attr['attribute_name'] == gsi['sort_key'] for attr in table_params['AttributeDefinitions']):
                            table_params['AttributeDefinitions'].append({
                                'AttributeName': gsi['sort_key'],
                                'AttributeType': 'S'
                            })
                    
                    table_params['GlobalSecondaryIndexes'].append(gsi_config)
            
            # Create table
            table = dynamodb.create_table(**table_params)
            
            # Wait for table to be created
            print(f"Waiting for table {table_name} to be created...")
            table.wait_until_exists()
            print(f"Table {table_name} created successfully")
            return True
        else:
            print(f"Error creating table {table_name}: {e}")
            return False

# Create all tables
for config in tables_config:
    create_table(config)

print("DynamoDB setup completed successfully!")
EOF

python setup_dynamodb.py
rm setup_dynamodb.py

echo -e "${GREEN}DynamoDB setup completed!${NC}"

# ============================================================================
# S3 BUCKETS SETUP
# ============================================================================

echo -e "${YELLOW}Setting up S3 buckets...${NC}"

# Create S3 buckets if they don't exist
BUCKETS=("chatbot-documents-ap-south-1" "chatbot-embeddings-ap-south-1")

for bucket in "${BUCKETS[@]}"; do
    if aws s3 ls "s3://$bucket" 2>&1 | grep -q 'NoSuchBucket'; then
        echo "Creating S3 bucket: $bucket"
        aws s3 mb "s3://$bucket" --region ap-south-1
        echo "Bucket $bucket created successfully"
    else
        echo "Bucket $bucket already exists"
    fi
done

echo -e "${GREEN}S3 buckets setup completed!${NC}"

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "${GREEN}External services setup completed successfully!${NC}"
echo -e "${BLUE}Summary:${NC}"
echo -e "✓ Pinecone vector database configured"
echo -e "✓ Neo4j knowledge graph configured"
echo -e "✓ DynamoDB tables created"
echo -e "✓ S3 buckets created"
echo -e ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Set up GitHub Actions secrets with the following environment variables:"
echo -e "   - OPENAI_API_KEY"
echo -e "   - PINECONE_API_KEY: pcsk_5bWrRg_EzH7xsyLtbCUHs5m2cmjitteDKvj6hzA3nytCPMvCshqqNHYPHvZMLxUAEvjzKo"
echo -e "   - PINECONE_ENVIRONMENT: gcp-starter"
echo -e "   - PINECONE_INDEX_NAME: chatbot-embeddings"
echo -e "   - NEO4J_URI: neo4j+s://APUPVZS7TOBGnEhwFhZcBBrPDlinyTH2ltHwesQhqTA.databases.neo4j.io"
echo -e "   - NEO4J_USER: neo4j"
echo -e "   - NEO4J_PASSWORD: APUPVZS7TOBGnEhwFhZcBBrPDlinyTH2ltHwesQhqTA"
echo -e "   - AWS_ACCESS_KEY_ID"
echo -e "   - AWS_SECRET_ACCESS_KEY"
echo -e ""
echo -e "2. Deploy the Lambda functions using the deploy script:"
echo -e "   ./deploy.sh"
echo -e ""
echo -e "3. Test the system by uploading a document to S3 and querying via API Gateway"
