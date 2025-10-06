# RAG Processor Service - Using pre-built base image
FROM 090163643302.dkr.ecr.ap-south-1.amazonaws.com/chatbot-base-combined:latest

# Copy shared utilities
COPY shared/ /opt/python/

# Copy requirements and install additional dependencies
COPY rag-processor/requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --upgrade pip && \
    pip install --upgrade setuptools>=68.0.0 wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy function code
COPY rag-processor/rag_processor.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "rag_processor.lambda_handler" ]
