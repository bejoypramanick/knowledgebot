# RAG Search Service - Build triggered
FROM public.ecr.aws/lambda/python:3.12

# Install system dependencies for Docling
RUN dnf install -y \
    gcc \
    gcc-c++ \
    && dnf clean all

# Copy shared utilities
COPY shared/ /opt/python/

# Copy requirements and install dependencies
COPY rag-search/requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --upgrade pip && \
    pip install --upgrade setuptools>=68.0.0 wheel && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download Docling models during build time
RUN mkdir -p /tmp/docling_artifacts && \
    export DOCLING_ARTIFACTS_PATH=/tmp/docling_artifacts && \
    python -c "from docling.document_converter import DocumentConverter; from docling.datamodel.base_models import InputFormat; from docling.datamodel.pipeline_options import PdfPipelineOptions; converter = DocumentConverter(format_options={InputFormat.PDF: PdfPipelineOptions(do_ocr=True, do_table_structure=True)}); print('Models pre-downloaded successfully')"

# Copy function code
COPY rag-search/rag_search_enhanced.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "rag_search_enhanced.lambda_handler" ]
