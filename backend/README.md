# PDF Extraction Backend

FastAPI backend service for extracting content from construction drawings and PDF documents using PDF-Extract-Kit components.

## Features

- **Layout Detection**: Identifies document structure (titles, text blocks, figures, tables)
- **OCR**: Extracts text from scanned documents using PaddleOCR
- **Table Parsing**: Extracts tabular data with structure preservation
- **Dimension Extraction**: Identifies and parses measurements (mm, m, ft, etc.)

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Build and run
docker-compose up -d

# Check health
curl http://localhost:8000/health
```

### Option 2: Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Run the server
python main.py
```

## API Endpoints

### Health Check
```
GET /health
```

### Extract PDF
```
POST /extract
Content-Type: multipart/form-data

Parameters:
- file: PDF file (required)
- extract_layout: bool (default: true)
- extract_text: bool (default: true)
- extract_tables: bool (default: true)
- extract_dimensions: bool (default: true)
- pages: string (comma-separated page numbers, optional)
- dpi: int (default: 200)
```

### Extract Image
```
POST /extract/image
Content-Type: multipart/form-data

Parameters:
- file: Image file (PNG, JPG, TIFF)
- extract_layout: bool (default: true)
- extract_text: bool (default: true)
- extract_dimensions: bool (default: true)
```

### Batch Extract
```
POST /extract/batch
Content-Type: multipart/form-data

Parameters:
- files: Multiple PDF files (max 10)
```

## Response Format

```json
{
  "filename": "drawing.pdf",
  "total_pages": 5,
  "pages": [
    {
      "page_number": 0,
      "width": 842.0,
      "height": 595.0,
      "layout_elements": [...],
      "ocr_results": [...],
      "tables": [...],
      "dimensions": [...]
    }
  ],
  "processing_time_ms": 1234.5,
  "errors": []
}
```

## Model Downloads

For full functionality, download the DocLayout-YOLO model:

```bash
mkdir -p models
# Download from https://huggingface.co/opendatalab/DocLayout-YOLO
# Place doclayout_yolo_ft.pt in the models directory
```

## Integration with Frontend

The API is designed to integrate with the Desktop-AI-Estimation React frontend.
Configure CORS origins in the `.env` file or environment variables.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DEBUG | false | Enable debug mode |
| UPLOAD_DIR | ./uploads | Temporary upload directory |
| MODELS_DIR | ./models | Model files directory |
| MAX_FILE_SIZE_MB | 100 | Maximum file size in MB |
