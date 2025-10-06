# RAG Processor Service - Build triggered
FROM public.ecr.aws/lambda/python:3.12

# Install system dependencies for Docling
RUN dnf install -y \
    gcc \
    gcc-c++ \
    && dnf clean all

# Copy shared utilities
COPY shared/ /opt/python/

# Copy requirements and install dependencies
COPY rag-processor/requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --upgrade pip && \
    pip install --upgrade setuptools>=68.0.0 wheel && \
    pip install --no-cache-dir -r requirements.txt

# Create artifacts directory for Docling
RUN mkdir -p /tmp/docling_artifacts

# Pre-download and cache sentence-transformers model
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Pre-initialize Docling converter to download any required models
RUN python -c "from docling.document_converter import DocumentConverter; from docling.datamodel.base_models import InputFormat; from docling.datamodel.pipeline_options import PdfPipelineOptions; converter = DocumentConverter(format_options={InputFormat.PDF: PdfPipelineOptions(do_ocr=True, do_table_structure=True, table_structure_options={'do_cell_matching': True})})"

# Copy function code
COPY rag-processor/rag_processor.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "rag_processor.lambda_handler" ]
