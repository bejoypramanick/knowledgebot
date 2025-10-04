# Source Extractor Service - Build triggered
FROM public.ecr.aws/lambda/python:3.12

# Copy shared utilities
COPY shared/ /opt/python/

# Copy requirements and install dependencies
COPY source-extractor/requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# Copy function code
COPY source-extractor/source_extractor.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "source_extractor.lambda_handler" ]
