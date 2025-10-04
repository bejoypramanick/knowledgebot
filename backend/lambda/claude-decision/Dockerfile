# Claude Decision Service - Build triggered
FROM public.ecr.aws/lambda/python:3.12

# Copy shared utilities
COPY shared/ /opt/python/

# Copy requirements and install dependencies
COPY claude-decision/requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# Copy function code
COPY claude-decision/claude_decision.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "claude_decision.lambda_handler" ]