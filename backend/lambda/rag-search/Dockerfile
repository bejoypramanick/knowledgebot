# RAG Search Service - Using pre-built base images
FROM 090163643302.dkr.ecr.ap-south-1.amazonaws.com/chatbot-base-docling:latest

# Install sentence-transformers and dependencies
RUN pip install --upgrade pip && \
    pip install --upgrade setuptools>=68.0.0 wheel && \
    pip install --no-cache-dir \
    sentence-transformers>=2.7.0,<3.0.0 \
    torch>=2.0.0 \
    transformers>=4.30.0

# Pre-download sentence-transformers models to /tmp
RUN python -c "
from sentence_transformers import SentenceTransformer
import os

# Set all environment variables to use /tmp for model caching
os.environ['TRANSFORMERS_CACHE'] = '/tmp/transformers_cache'
os.environ['HF_HOME'] = '/tmp/huggingface_cache'
os.environ['HF_DATASETS_CACHE'] = '/tmp/huggingface_datasets_cache'
os.environ['TORCH_HOME'] = '/tmp/torch_cache'
os.environ['SENTENCE_TRANSFORMERS_HOME'] = '/tmp/sentence_transformers_cache'

# Pre-download the most commonly used model
model = SentenceTransformer('all-MiniLM-L6-v2')
print('Sentence transformers model pre-loaded successfully in /tmp')
"

# Copy shared utilities
COPY shared/ /opt/python/

# Copy requirements and install additional dependencies
COPY rag-search/requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --upgrade pip && \
    pip install --upgrade setuptools>=68.0.0 wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy function code
COPY rag-search/rag_search_enhanced.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "rag_search_enhanced.lambda_handler" ]
