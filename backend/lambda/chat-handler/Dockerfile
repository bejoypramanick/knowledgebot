FROM public.ecr.aws/lambda/python:3.12

# Install system dependencies
RUN dnf install -y \
    gcc \
    gcc-c++ \
    && dnf clean all

# Install uv for faster pip operations
RUN pip install uv

# Copy requirements and install Python dependencies using uv
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN uv pip install --system --no-cache -r requirements.txt

# Copy function code
COPY . ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD ["chat_handler.lambda_handler"]
