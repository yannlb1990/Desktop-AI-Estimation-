"""Pydantic models for PDF extraction API"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class LayoutElementType(str, Enum):
    """Types of layout elements detected in PDF drawings"""
    TEXT = "text"
    TITLE = "title"
    TABLE = "table"
    FIGURE = "figure"
    CAPTION = "caption"
    HEADER = "header"
    FOOTER = "footer"
    DIMENSION = "dimension"
    ANNOTATION = "annotation"
    DRAWING_ELEMENT = "drawing_element"


class BoundingBox(BaseModel):
    """Bounding box coordinates"""
    x: float = Field(..., description="X coordinate of top-left corner")
    y: float = Field(..., description="Y coordinate of top-left corner")
    width: float = Field(..., description="Width of the bounding box")
    height: float = Field(..., description="Height of the bounding box")
    confidence: float = Field(default=0.0, description="Detection confidence score")


class LayoutElement(BaseModel):
    """Detected layout element"""
    id: str = Field(..., description="Unique identifier")
    type: LayoutElementType = Field(..., description="Type of element")
    bbox: BoundingBox = Field(..., description="Bounding box")
    text: Optional[str] = Field(None, description="Extracted text content")
    page: int = Field(..., description="Page number (0-indexed)")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class OCRResult(BaseModel):
    """OCR extraction result"""
    text: str = Field(..., description="Extracted text")
    bbox: BoundingBox = Field(..., description="Bounding box")
    confidence: float = Field(..., description="OCR confidence")
    page: int = Field(..., description="Page number")


class TableCell(BaseModel):
    """Single table cell"""
    row: int
    col: int
    text: str
    bbox: Optional[BoundingBox] = None
    rowspan: int = 1
    colspan: int = 1


class ExtractedTable(BaseModel):
    """Extracted table structure"""
    id: str
    page: int
    bbox: BoundingBox
    rows: int
    cols: int
    cells: List[TableCell]
    html: Optional[str] = None


class DimensionExtraction(BaseModel):
    """Extracted dimension from drawing"""
    id: str
    value: float = Field(..., description="Numeric value")
    unit: str = Field(default="mm", description="Unit of measurement")
    text: str = Field(..., description="Original text")
    bbox: BoundingBox
    page: int
    dimension_type: str = Field(default="linear", description="Type: linear, angular, radius, diameter")


class PageAnalysis(BaseModel):
    """Analysis results for a single page"""
    page_number: int
    width: float
    height: float
    layout_elements: List[LayoutElement] = []
    ocr_results: List[OCRResult] = []
    tables: List[ExtractedTable] = []
    dimensions: List[DimensionExtraction] = []


class ExtractionResponse(BaseModel):
    """Complete extraction response"""
    filename: str
    total_pages: int
    pages: List[PageAnalysis]
    processing_time_ms: float
    errors: List[str] = []


class ExtractionOptions(BaseModel):
    """Options for PDF extraction"""
    extract_layout: bool = True
    extract_text: bool = True
    extract_tables: bool = True
    extract_dimensions: bool = True
    pages: Optional[List[int]] = None  # None means all pages
    dpi: int = 200
    language: str = "en"


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    models_loaded: Dict[str, bool]


# ─── Construction-domain models ─────────────────────────────────────────────

class OpeningCode(BaseModel):
    """Decoded window or door from Australian plan notation (e.g. 1218 SW)"""
    ref: str                          # e.g. "1218 SW" or "W-01"
    element_type: str                 # "window" | "door"
    width_mm: Optional[float] = None
    height_mm: Optional[float] = None
    opening_type: Optional[str] = None  # "Sliding Window", "Hinged Door", etc.
    page: int
    bbox: Optional[BoundingBox] = None


class RoomArea(BaseModel):
    """Room name + stated floor area parsed from plan (e.g. 'GF LIVING 136.37 m²')"""
    name: str
    area_m2: float
    page: int
    bbox: Optional[BoundingBox] = None


class DrawingInfo(BaseModel):
    """Title block data extracted from a plan sheet"""
    drawing_number: Optional[str] = None   # e.g. "A-02"
    title: Optional[str] = None
    scale: Optional[str] = None            # e.g. "1:100"
    scale_ratio: Optional[float] = None    # 100.0
    revision: Optional[str] = None
    page: int


class ConstructionData(BaseModel):
    """All construction-specific data extracted across all pages"""
    openings: List[OpeningCode] = []
    room_areas: List[RoomArea] = []
    drawing_info: List[DrawingInfo] = []
    total_floor_area_m2: Optional[float] = None


class ConstructionExtractionResponse(BaseModel):
    """Response for /extract/construction endpoint"""
    filename: str
    total_pages: int
    construction_data: ConstructionData
    processing_time_ms: float
    errors: List[str] = []
