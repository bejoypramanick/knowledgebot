# RAG Processor Service - Build triggered
FROM public.ecr.aws/lambda/python:3.12

# Install system dependencies for Docling
RUN dnf install -y \
    gcc \
    gcc-c++ \
    && dnf clean all

# Copy shared utilities
COPY shared/ /opt/python/

# Copy requirements and install dependencies
COPY rag-processor/requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# Copy function code
COPY rag-processor/rag_processor.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "rag_processor.lambda_handler" ]
