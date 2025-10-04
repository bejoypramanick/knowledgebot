# Presigned URL Service
FROM public.ecr.aws/lambda/python:3.12

# Copy shared utilities
COPY shared/ /opt/python/

# Copy requirements and install dependencies
COPY presigned-url/requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --upgrade pip && \
    pip install --upgrade setuptools>=68.0.0 wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy function code
COPY presigned-url/presigned_url.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "presigned_url.lambda_handler" ]
