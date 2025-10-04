# Response Enhancement Service - Build triggered
FROM public.ecr.aws/lambda/python:3.12

# Copy shared utilities
COPY shared/ /opt/python/

# Copy requirements and install dependencies
COPY response-enhancement/requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# Copy function code
COPY response-enhancement/response_enhancement.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "response_enhancement.lambda_handler" ]
