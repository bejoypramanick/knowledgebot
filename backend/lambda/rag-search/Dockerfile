FROM public.ecr.aws/lambda/python:3.11

# Install system dependencies for Docling
RUN yum update -y && \
    yum install -y \
    gcc \
    gcc-c++ \
    && yum clean all

# Copy requirements and install dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# Copy function code
COPY rag_search_enhanced.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "rag_search_enhanced.lambda_handler" ]
