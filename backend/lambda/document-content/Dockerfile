FROM public.ecr.aws/lambda/python:3.11

# Copy shared utilities
COPY ../shared/ /opt/python/

# Copy requirements and install dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# Copy function code
COPY document_content.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "document_content.lambda_handler" ]
