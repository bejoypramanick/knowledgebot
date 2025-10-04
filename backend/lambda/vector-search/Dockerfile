FROM public.ecr.aws/lambda/python:3.11

# Install system dependencies for numerical computing
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
COPY vector_search.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "vector_search.lambda_handler" ]
