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

# Copy requirements and install Python dependencies with optimizations
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install dependencies with space optimizations
RUN pip install --no-cache-dir --no-deps torch==2.0.1+cpu torchvision==0.15.2+cpu --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir --no-deps -r requirements.txt && \
    pip install --no-cache-dir docling && \
    pip cache purge && \
    find /var/lang/lib/python3.9/site-packages -name "*.pyc" -delete && \
    find /var/lang/lib/python3.9/site-packages -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

# Copy function code
COPY . ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD ["rag_processor.lambda_handler"]
