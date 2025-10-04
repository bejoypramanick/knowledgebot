# Vector Search Service - Build triggered
FROM public.ecr.aws/lambda/python:3.12

# Install system dependencies for numerical computing
RUN dnf install -y \
    gcc \
    gcc-c++ \
    gfortran \
    && dnf clean all

# Copy shared utilities
COPY shared/ /opt/python/

# Copy requirements and install dependencies
COPY vector-search/requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# Copy function code
COPY vector-search/vector_search.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "vector_search.lambda_handler" ]
