# Use a pre-built Python image with common ML libraries
FROM public.ecr.aws/lambda/python:3.9

# Install system dependencies for document processing
RUN yum update -y && \
    yum install -y \
    poppler-utils \
    tesseract \
    tesseract-langpack-eng \
    libreoffice \
    ImageMagick \
    && yum clean all

# Install uv for faster pip operations
RUN pip install uv

# Copy requirements first for better caching
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install dependencies using uv for faster builds
RUN uv pip install --system --no-cache \
    boto3==1.34.0 \
    pydantic>=2.0.0,<3.0.0 \
    anthropic==0.34.2 \
    requests>=2.32.2,<3.0.0 \
    numpy>=1.21.0,<2.0.0 \
    docling>=1.0.0

# Clean up to reduce image size
RUN pip cache purge && \
    find /var/lang/lib/python3.9/site-packages -name "*.pyc" -delete && \
    find /var/lang/lib/python3.9/site-packages -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

# Copy function code
COPY . ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD ["rag_processor.lambda_handler"]
