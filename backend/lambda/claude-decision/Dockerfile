FROM public.ecr.aws/lambda/python:3.11

# Copy requirements and install dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# Copy function code
COPY claude_decision.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "claude_decision.lambda_handler" ]
