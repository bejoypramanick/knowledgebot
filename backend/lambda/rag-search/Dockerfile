# RAG Search Service - Using lightweight embeddings base
FROM 090163643302.dkr.ecr.ap-south-1.amazonaws.com/chatbot-base-embeddings-light:latest

# Install minimal Docling for search (no OCR, no table structure)
RUN pip install --upgrade pip && \
    pip install --upgrade "setuptools>=68.0.0" wheel && \
    pip install --no-cache-dir \
    "docling>=2.55.1" \
    "numpy>=1.26.0,<2.0.0" \
    "httpx>=0.27.0,<0.29.0"

# Pre-initialize minimal Docling for search
RUN python -c "\
import os; \
os.environ['DOCLING_ARTIFACTS_PATH'] = '/tmp/docling_artifacts'; \
os.environ['TRANSFORMERS_CACHE'] = '/tmp/transformers_cache'; \
os.environ['HF_HOME'] = '/tmp/huggingface_cache'; \
os.environ['HF_DATASETS_CACHE'] = '/tmp/huggingface_datasets_cache'; \
os.environ['TORCH_HOME'] = '/tmp/torch_cache'; \
from docling.document_converter import DocumentConverter; \
from docling.datamodel.base_models import InputFormat; \
from docling.datamodel.pipeline_options import PdfPipelineOptions; \
converter = DocumentConverter(format_options={InputFormat.PDF: PdfPipelineOptions(do_ocr=False, do_table_structure=False)}); \
print('Minimal Docling for search initialized successfully')"

# Copy shared utilities
COPY shared/ /opt/python/

# Copy requirements and install additional dependencies
COPY rag-search/requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --upgrade pip && \
    pip install --upgrade setuptools>=68.0.0 wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy function code
COPY rag-search/rag_search_enhanced.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "rag_search_enhanced.lambda_handler" ]
