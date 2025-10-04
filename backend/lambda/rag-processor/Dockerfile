# Use a pre-built Python image with common ML libraries
FROM public.ecr.aws/lambda/python:3.12

# Install minimal system dependencies (Docling handles document processing internally)
RUN yum update -y && \
    yum install -y \
    gcc \
    gcc-c++ \
    && yum clean all

# Install uv for faster pip operations
RUN pip install uv

# Copy requirements first for better caching
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install dependencies using uv for faster builds
RUN uv pip install --system --no-cache -r requirements.txt

# Clean up to reduce image size
RUN pip cache purge && \
    find /var/lang/lib/python3.12/site-packages -name "*.pyc" -delete && \
    find /var/lang/lib/python3.12/site-packages -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

# Copy function code
COPY . ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD ["rag_processor.lambda_handler"]
