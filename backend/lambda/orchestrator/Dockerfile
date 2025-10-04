# Orchestrator Service - Build triggered
FROM public.ecr.aws/lambda/python:3.12

# Copy shared utilities
COPY shared/ /opt/python/

# Copy requirements and install dependencies
COPY orchestrator/requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# Copy function code
COPY orchestrator/orchestrator.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "orchestrator.lambda_handler" ]
