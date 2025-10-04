# Document Content Service - Build triggered
FROM public.ecr.aws/lambda/python:3.12

# Copy shared utilities
COPY shared/ /opt/python/

# Copy requirements and install dependencies
COPY document-content/requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# Copy function code
COPY document-content/document_content.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "document_content.lambda_handler" ]
