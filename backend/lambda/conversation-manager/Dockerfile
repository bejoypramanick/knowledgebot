# Conversation Manager Service - Build triggered
FROM public.ecr.aws/lambda/python:3.12

# Copy shared utilities
COPY shared/ /opt/python/

# Copy requirements and install dependencies
COPY conversation-manager/requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# Copy function code
COPY conversation-manager/conversation_manager.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "conversation_manager.lambda_handler" ]
