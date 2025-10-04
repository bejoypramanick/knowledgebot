# Chat Handler Service - Build triggered
FROM public.ecr.aws/lambda/python:3.12

# Install system dependencies
RUN dnf install -y \
    gcc \
    gcc-c++ \
    && dnf clean all

# Copy shared utilities
COPY shared/ /opt/python/

# Copy requirements and install dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# Copy function code
COPY chat_handler.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "chat_handler.lambda_handler" ]
