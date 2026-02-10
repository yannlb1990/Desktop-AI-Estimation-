"""
PDF Extraction API for Desktop-AI-Estimation
FastAPI backend integrating PDF-Extract-Kit for construction drawing analysis
"""
import os
import uuid
import shutil
import logging
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic_settings import BaseSettings

from models import (
    ExtractionResponse, ExtractionOptions, HealthResponse,
    PageAnalysis
)
from pdf_extractor import PDFExtractor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings"""
    app_name: str = "PDF Extraction API"
    version: str = "1.0.0"
    debug: bool = False
    upload_dir: str = "./uploads"
    models_dir: str = "./models"
    max_file_size_mb: int = 100
    allowed_origins: list = ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"]

    class Config:
        env_file = ".env"


settings = Settings()

# Global extractor instance
extractor: Optional[PDFExtractor] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global extractor

    # Startup
    logger.info("Starting PDF Extraction API...")

    # Create required directories
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.models_dir).mkdir(parents=True, exist_ok=True)

    # Initialize extractor
    extractor = PDFExtractor(models_dir=settings.models_dir)
    extractor.load_models()

    logger.info("PDF Extraction API ready")
    yield

    # Shutdown
    logger.info("Shutting down PDF Extraction API...")
    # Cleanup uploads directory
    if Path(settings.upload_dir).exists():
        shutil.rmtree(settings.upload_dir, ignore_errors=True)


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="PDF content extraction API for construction drawings and documents",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def cleanup_file(file_path: str):
    """Background task to cleanup uploaded files"""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.debug(f"Cleaned up file: {file_path}")
    except Exception as e:
        logger.error(f"Failed to cleanup file {file_path}: {e}")


@app.get("/", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        version=settings.version,
        models_loaded=extractor.get_models_status() if extractor else {}
    )


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint (alias)"""
    return await health_check()


@app.post("/extract", response_model=ExtractionResponse)
async def extract_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    extract_layout: bool = True,
    extract_text: bool = True,
    extract_tables: bool = True,
    extract_dimensions: bool = True,
    pages: Optional[str] = None,  # Comma-separated page numbers
    dpi: int = 200
):
    """
    Extract content from a PDF file.

    - **file**: PDF file to process
    - **extract_layout**: Enable layout detection
    - **extract_text**: Enable OCR/text extraction
    - **extract_tables**: Enable table extraction
    - **extract_dimensions**: Enable dimension/measurement extraction
    - **pages**: Comma-separated page numbers (0-indexed), or empty for all
    - **dpi**: Resolution for image conversion (default 200)
    """
    if not extractor:
        raise HTTPException(status_code=503, detail="Extractor not initialized")

    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ['.pdf', '.PDF']:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file_ext}. Only PDF files are supported."
        )

    # Check file size
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > settings.max_file_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.max_file_size_mb}MB"
        )

    # Save uploaded file
    file_id = str(uuid.uuid4())
    file_path = Path(settings.upload_dir) / f"{file_id}{file_ext}"

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Schedule cleanup
    background_tasks.add_task(cleanup_file, str(file_path))

    # Parse page numbers
    page_list = None
    if pages:
        try:
            page_list = [int(p.strip()) for p in pages.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid page numbers format")

    # Create extraction options
    options = ExtractionOptions(
        extract_layout=extract_layout,
        extract_text=extract_text,
        extract_tables=extract_tables,
        extract_dimensions=extract_dimensions,
        pages=page_list,
        dpi=dpi
    )

    # Perform extraction
    try:
        result = await extractor.extract_pdf(str(file_path), options)
        return result
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@app.post("/extract/image", response_model=PageAnalysis)
async def extract_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    extract_layout: bool = True,
    extract_text: bool = True,
    extract_dimensions: bool = True
):
    """
    Extract content from an image file (for scanned drawings).

    - **file**: Image file to process (PNG, JPG, TIFF)
    - **extract_layout**: Enable layout detection
    - **extract_text**: Enable OCR
    - **extract_dimensions**: Enable dimension extraction
    """
    if not extractor:
        raise HTTPException(status_code=503, detail="Extractor not initialized")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp']:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file_ext}. Supported: PNG, JPG, TIFF, BMP"
        )

    # Save uploaded file
    file_id = str(uuid.uuid4())
    file_path = Path(settings.upload_dir) / f"{file_id}{file_ext}"

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Schedule cleanup
    background_tasks.add_task(cleanup_file, str(file_path))

    # Create extraction options
    options = ExtractionOptions(
        extract_layout=extract_layout,
        extract_text=extract_text,
        extract_tables=False,
        extract_dimensions=extract_dimensions
    )

    # Perform extraction
    try:
        result = await extractor.extract_from_image(str(file_path), options)
        return result
    except Exception as e:
        logger.error(f"Image extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@app.post("/extract/batch")
async def extract_batch(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...)
):
    """
    Extract content from multiple PDF files.
    Returns a list of extraction results.
    """
    if not extractor:
        raise HTTPException(status_code=503, detail="Extractor not initialized")

    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 files per batch")

    results = []
    options = ExtractionOptions()

    for file in files:
        if not file.filename:
            continue

        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in ['.pdf', '.PDF']:
            results.append({
                "filename": file.filename,
                "error": "Invalid file type"
            })
            continue

        file_id = str(uuid.uuid4())
        file_path = Path(settings.upload_dir) / f"{file_id}{file_ext}"

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            background_tasks.add_task(cleanup_file, str(file_path))

            result = await extractor.extract_pdf(str(file_path), options)
            results.append(result.model_dump())

        except Exception as e:
            results.append({
                "filename": file.filename,
                "error": str(e)
            })

    return JSONResponse(content={"results": results})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug
    )
