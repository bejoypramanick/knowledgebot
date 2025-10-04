FROM public.ecr.aws/lambda/python:3.11

# Copy requirements and install dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# Copy function code
COPY rag_search.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "rag_search.lambda_handler" ]
