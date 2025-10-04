FROM public.ecr.aws/lambda/python:3.11

# Install system dependencies for ML libraries
RUN yum update -y && \
    yum install -y \
    gcc \
    gcc-c++ \
    gfortran \
    && yum clean all

# Copy shared utilities (if available)
# COPY shared/ /opt/python/

# Copy requirements and install dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# Copy function code
COPY embedding_service.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "embedding_service.lambda_handler" ]
