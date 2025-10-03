FROM public.ecr.aws/lambda/python:3.9

# Install system dependencies for OCR and document processing
RUN yum update -y && \
    yum install -y \
    poppler-utils \
    tesseract \
    tesseract-langpack-eng \
    libreoffice \
    ImageMagick \
    && yum clean all

# Copy requirements and install Python dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --no-cache-dir -r requirements.txt

# Copy function code
COPY . ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD ["rag_processor.lambda_handler"]
