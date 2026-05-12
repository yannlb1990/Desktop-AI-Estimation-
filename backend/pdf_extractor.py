"""PDF Extraction service using PDF-Extract-Kit components"""
import os
import re
import uuid
import time
import logging
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any, Set
from PIL import Image
import fitz  # PyMuPDF

from models import (
    BoundingBox, LayoutElement, LayoutElementType, OCRResult,
    TableCell, ExtractedTable, DimensionExtraction, PageAnalysis,
    ExtractionResponse, ExtractionOptions,
    OpeningCode, RoomArea, DrawingInfo, ConstructionData, ConstructionExtractionResponse
)

logger = logging.getLogger(__name__)


class PDFExtractor:
    """
    PDF extraction service integrating PDF-Extract-Kit components.
    Provides layout detection, OCR, table parsing, and dimension extraction
    for construction drawings and documents.
    """

    def __init__(self, models_dir: str = "./models"):
        self.models_dir = Path(models_dir)
        self.layout_model = None
        self.ocr_engine = None
        self.table_model = None
        self._models_loaded = {
            "layout_detection": False,
            "ocr": False,
            "table_parsing": False
        }

    def load_models(self):
        """Load all extraction models"""
        self._load_layout_model()
        self._load_ocr_engine()
        self._load_table_model()

    def _load_layout_model(self):
        """Load DocLayout-YOLO model for layout detection"""
        try:
            # Try to load doclayout_yolo
            try:
                from doclayout_yolo import YOLOv10
                model_path = self.models_dir / "doclayout_yolo_ft.pt"
                if model_path.exists():
                    self.layout_model = YOLOv10(str(model_path))
                    self._models_loaded["layout_detection"] = True
                    logger.info("Layout detection model loaded successfully")
                else:
                    logger.warning(f"Layout model not found at {model_path}, using fallback")
                    self._setup_fallback_layout()
            except ImportError:
                logger.warning("doclayout_yolo not available, using fallback")
                self._setup_fallback_layout()
        except Exception as e:
            logger.error(f"Failed to load layout model: {e}")
            self._setup_fallback_layout()

    def _setup_fallback_layout(self):
        """Setup fallback layout detection using basic image analysis"""
        self.layout_model = None
        self._models_loaded["layout_detection"] = True  # Mark as loaded (using fallback)

    def _load_ocr_engine(self):
        """Load PaddleOCR engine"""
        try:
            from paddleocr import PaddleOCR
            self.ocr_engine = PaddleOCR(
                use_angle_cls=True,
                lang='en',
                show_log=False,
                use_gpu=False  # Use CPU for compatibility
            )
            self._models_loaded["ocr"] = True
            logger.info("OCR engine loaded successfully")
        except ImportError:
            logger.warning("PaddleOCR not available, OCR will be limited")
            self._setup_fallback_ocr()
        except Exception as e:
            logger.error(f"Failed to load OCR engine: {e}")
            self._setup_fallback_ocr()

    def _setup_fallback_ocr(self):
        """Setup fallback OCR using PyMuPDF text extraction"""
        self.ocr_engine = None
        self._models_loaded["ocr"] = True

    def _load_table_model(self):
        """Load table parsing model"""
        try:
            # Table parsing is handled via layout detection + OCR
            self._models_loaded["table_parsing"] = True
            logger.info("Table parsing ready")
        except Exception as e:
            logger.error(f"Failed to setup table parsing: {e}")

    def get_models_status(self) -> Dict[str, bool]:
        """Get status of loaded models"""
        return self._models_loaded.copy()

    async def extract_pdf(
        self,
        pdf_path: str,
        options: ExtractionOptions
    ) -> ExtractionResponse:
        """
        Extract content from PDF file.

        Args:
            pdf_path: Path to PDF file
            options: Extraction options

        Returns:
            ExtractionResponse with all extracted data
        """
        start_time = time.time()
        errors: List[str] = []
        pages: List[PageAnalysis] = []

        try:
            doc = fitz.open(pdf_path)
            total_pages = len(doc)

            # Determine which pages to process
            pages_to_process = options.pages if options.pages else list(range(total_pages))

            for page_num in pages_to_process:
                if page_num >= total_pages:
                    continue

                try:
                    page_analysis = await self._process_page(
                        doc, page_num, options
                    )
                    pages.append(page_analysis)
                except Exception as e:
                    logger.error(f"Error processing page {page_num}: {e}")
                    errors.append(f"Page {page_num}: {str(e)}")

            doc.close()

        except Exception as e:
            logger.error(f"Failed to open PDF: {e}")
            errors.append(f"Failed to open PDF: {str(e)}")
            total_pages = 0

        processing_time = (time.time() - start_time) * 1000

        return ExtractionResponse(
            filename=Path(pdf_path).name,
            total_pages=total_pages,
            pages=pages,
            processing_time_ms=processing_time,
            errors=errors
        )

    async def _process_page(
        self,
        doc: fitz.Document,
        page_num: int,
        options: ExtractionOptions
    ) -> PageAnalysis:
        """Process a single page"""
        page = doc[page_num]
        rect = page.rect

        # Convert page to image for ML models
        pix = page.get_pixmap(dpi=options.dpi)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        layout_elements: List[LayoutElement] = []
        ocr_results: List[OCRResult] = []
        tables: List[ExtractedTable] = []
        dimensions: List[DimensionExtraction] = []

        # Layout detection
        if options.extract_layout:
            layout_elements = await self._detect_layout(img, page_num, rect)

        # OCR
        if options.extract_text:
            ocr_results = await self._extract_text(doc, page, page_num, img, options)

        # Table extraction
        if options.extract_tables:
            tables = await self._extract_tables(page, page_num, layout_elements)

        # Dimension extraction
        if options.extract_dimensions:
            dimensions = self._extract_dimensions(ocr_results, page_num)

        return PageAnalysis(
            page_number=page_num,
            width=rect.width,
            height=rect.height,
            layout_elements=layout_elements,
            ocr_results=ocr_results,
            tables=tables,
            dimensions=dimensions
        )

    async def _detect_layout(
        self,
        img: Image.Image,
        page_num: int,
        rect: fitz.Rect
    ) -> List[LayoutElement]:
        """Detect layout elements in page image"""
        elements: List[LayoutElement] = []

        if self.layout_model is not None:
            try:
                results = self.layout_model.predict(img, imgsz=1024, conf=0.25)

                for result in results:
                    boxes = result.boxes
                    for i, box in enumerate(boxes):
                        xyxy = box.xyxy[0].tolist()
                        conf = float(box.conf[0])
                        cls = int(box.cls[0])

                        # Map class ID to element type
                        element_type = self._map_class_to_type(cls)

                        # Scale coordinates to page dimensions
                        scale_x = rect.width / img.width
                        scale_y = rect.height / img.height

                        elements.append(LayoutElement(
                            id=str(uuid.uuid4())[:8],
                            type=element_type,
                            bbox=BoundingBox(
                                x=xyxy[0] * scale_x,
                                y=xyxy[1] * scale_y,
                                width=(xyxy[2] - xyxy[0]) * scale_x,
                                height=(xyxy[3] - xyxy[1]) * scale_y,
                                confidence=conf
                            ),
                            page=page_num
                        ))
            except Exception as e:
                logger.error(f"Layout detection error: {e}")

        return elements

    def _map_class_to_type(self, class_id: int) -> LayoutElementType:
        """Map YOLO class ID to LayoutElementType"""
        # DocLayout-YOLO classes
        class_mapping = {
            0: LayoutElementType.TITLE,
            1: LayoutElementType.TEXT,
            2: LayoutElementType.FIGURE,
            3: LayoutElementType.TABLE,
            4: LayoutElementType.CAPTION,
            5: LayoutElementType.HEADER,
            6: LayoutElementType.FOOTER,
        }
        return class_mapping.get(class_id, LayoutElementType.DRAWING_ELEMENT)

    async def _extract_text(
        self,
        doc: fitz.Document,
        page: fitz.Page,
        page_num: int,
        img: Image.Image,
        options: ExtractionOptions
    ) -> List[OCRResult]:
        """Extract text from page using OCR and/or native PDF text"""
        results: List[OCRResult] = []

        # First, try native PDF text extraction (faster, more accurate for digital PDFs)
        text_dict = page.get_text("dict")
        rect = page.rect

        for block in text_dict.get("blocks", []):
            if block.get("type") == 0:  # Text block
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span.get("text", "").strip()
                        if text:
                            bbox = span.get("bbox", [0, 0, 0, 0])
                            results.append(OCRResult(
                                text=text,
                                bbox=BoundingBox(
                                    x=bbox[0],
                                    y=bbox[1],
                                    width=bbox[2] - bbox[0],
                                    height=bbox[3] - bbox[1],
                                    confidence=1.0
                                ),
                                confidence=1.0,
                                page=page_num
                            ))

        # If no text found or document appears to be scanned, use OCR
        if len(results) < 5 and self.ocr_engine is not None and img is not None:
            try:
                import numpy as np
                img_array = np.array(img)
                ocr_results = self.ocr_engine.ocr(img_array, cls=True)

                if ocr_results and ocr_results[0]:
                    scale_x = rect.width / img.width
                    scale_y = rect.height / img.height

                    for line in ocr_results[0]:
                        if line:
                            points = line[0]
                            text = line[1][0]
                            conf = line[1][1]

                            # Convert points to bbox
                            x_min = min(p[0] for p in points)
                            y_min = min(p[1] for p in points)
                            x_max = max(p[0] for p in points)
                            y_max = max(p[1] for p in points)

                            results.append(OCRResult(
                                text=text,
                                bbox=BoundingBox(
                                    x=x_min * scale_x,
                                    y=y_min * scale_y,
                                    width=(x_max - x_min) * scale_x,
                                    height=(y_max - y_min) * scale_y,
                                    confidence=conf
                                ),
                                confidence=conf,
                                page=page_num
                            ))
            except Exception as e:
                logger.error(f"OCR error: {e}")

        return results

    async def _extract_tables(
        self,
        page: fitz.Page,
        page_num: int,
        layout_elements: List[LayoutElement]
    ) -> List[ExtractedTable]:
        """Extract tables from page"""
        tables: List[ExtractedTable] = []

        # Find table regions from layout detection
        table_regions = [
            elem for elem in layout_elements
            if elem.type == LayoutElementType.TABLE
        ]

        # Also use PyMuPDF table detection
        try:
            page_tables = page.find_tables()

            for i, table in enumerate(page_tables):
                bbox = table.bbox
                cells: List[TableCell] = []

                # Extract table data
                table_data = table.extract()

                for row_idx, row in enumerate(table_data):
                    for col_idx, cell_text in enumerate(row):
                        if cell_text:
                            cells.append(TableCell(
                                row=row_idx,
                                col=col_idx,
                                text=str(cell_text).strip()
                            ))

                tables.append(ExtractedTable(
                    id=str(uuid.uuid4())[:8],
                    page=page_num,
                    bbox=BoundingBox(
                        x=bbox[0],
                        y=bbox[1],
                        width=bbox[2] - bbox[0],
                        height=bbox[3] - bbox[1],
                        confidence=0.9
                    ),
                    rows=len(table_data),
                    cols=len(table_data[0]) if table_data else 0,
                    cells=cells,
                    html=self._table_to_html(table_data)
                ))
        except Exception as e:
            logger.error(f"Table extraction error: {e}")

        return tables

    def _table_to_html(self, table_data: List[List[Any]]) -> str:
        """Convert table data to HTML"""
        if not table_data:
            return ""

        html = ["<table border='1'>"]
        for row in table_data:
            html.append("<tr>")
            for cell in row:
                html.append(f"<td>{cell or ''}</td>")
            html.append("</tr>")
        html.append("</table>")
        return "".join(html)

    def _extract_dimensions(
        self,
        ocr_results: List[OCRResult],
        page_num: int
    ) -> List[DimensionExtraction]:
        """Extract dimensions/measurements from OCR results"""
        dimensions: List[DimensionExtraction] = []

        # Patterns for construction dimensions
        dimension_patterns = [
            # Metric patterns
            (r'(\d+(?:\.\d+)?)\s*(mm|cm|m|metre|meter)', 'linear'),
            (r'(\d+(?:\.\d+)?)\s*(sqm|m2|m²|sq\.?\s*m)', 'area'),
            (r'(\d+(?:\.\d+)?)\s*(lm|lin\.?\s*m|linear\s*m)', 'linear'),
            # Imperial patterns
            (r'(\d+(?:\.\d+)?)\s*[\'\"]\s*-?\s*(\d+(?:\.\d+)?)\s*[\'\""]?', 'linear'),
            (r'(\d+(?:\.\d+)?)\s*(ft|foot|feet|inch|in)', 'linear'),
            # Generic number with dimension notation
            (r'(\d{2,5})\s*(?=\s|$)', 'linear'),  # 4-digit numbers likely dimensions
        ]

        for ocr in ocr_results:
            text = ocr.text

            for pattern, dim_type in dimension_patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)

                for match in matches:
                    try:
                        value = float(match.group(1))
                        unit = match.group(2) if len(match.groups()) > 1 else "mm"

                        dimensions.append(DimensionExtraction(
                            id=str(uuid.uuid4())[:8],
                            value=value,
                            unit=unit.lower().strip() if unit else "mm",
                            text=match.group(0),
                            bbox=ocr.bbox,
                            page=page_num,
                            dimension_type=dim_type
                        ))
                    except (ValueError, IndexError):
                        continue

        return dimensions

    async def extract_from_image(
        self,
        image_path: str,
        options: ExtractionOptions
    ) -> PageAnalysis:
        """Extract content from a single image (for scanned drawings)"""
        img = Image.open(image_path)

        # Create a pseudo-rect for coordinate scaling
        class PseudoRect:
            width = img.width
            height = img.height

        layout_elements = await self._detect_layout(img, 0, PseudoRect())

        ocr_results: List[OCRResult] = []
        if options.extract_text and self.ocr_engine:
            import numpy as np
            img_array = np.array(img)
            results = self.ocr_engine.ocr(img_array, cls=True)

            if results and results[0]:
                for line in results[0]:
                    if line:
                        points = line[0]
                        text = line[1][0]
                        conf = line[1][1]

                        x_min = min(p[0] for p in points)
                        y_min = min(p[1] for p in points)
                        x_max = max(p[0] for p in points)
                        y_max = max(p[1] for p in points)

                        ocr_results.append(OCRResult(
                            text=text,
                            bbox=BoundingBox(
                                x=x_min,
                                y=y_min,
                                width=x_max - x_min,
                                height=y_max - y_min,
                                confidence=conf
                            ),
                            confidence=conf,
                            page=0
                        ))

        dimensions = self._extract_dimensions(ocr_results, 0)

        return PageAnalysis(
            page_number=0,
            width=img.width,
            height=img.height,
            layout_elements=layout_elements,
            ocr_results=ocr_results,
            tables=[],
            dimensions=dimensions
        )

    # ─── Construction-domain extraction ──────────────────────────────────────

    # Australian window/door type codes → (element_type, label)
    _OPENING_TYPES: Dict[str, Tuple[str, str]] = {
        'SW': ('window', 'Sliding Window'),
        'HW': ('window', 'Hinged Window (Awning)'),
        'FW': ('window', 'Fixed Window'),
        'CW': ('window', 'Corner Window'),
        'DG': ('window', 'Double Glazed Window'),
        'GL': ('window', 'Glazed Fixed Panel'),
        'HD': ('door',   'Hinged Door'),
        'SD': ('door',   'Sliding Door'),
        'BD': ('door',   'Bifold Door'),
        'FD': ('door',   'Fire Door'),
        'AD': ('door',   'Automatic Door'),
    }

    # Regex patterns (compiled once)
    _FULL_CODE   = re.compile(r'\b(\d{2})(\d{2})\s*(SW|HW|FW|HD|SD|BD|GL|DG|CW|FD|AD)\b', re.I)
    _REF_CODE    = re.compile(r'\b([WD])[-–]?(\d{1,3})\b')
    _ROOM_AREA   = re.compile(r'([A-Z][A-Z /]{2,25})\s{0,5}(\d{1,4}\.?\d{0,2})\s*m[²2]', re.I)
    _SCALE       = re.compile(r'(?:SCALE\s+)?1\s*[:/]\s*(\d+)', re.I)
    _DRAWING_NO  = re.compile(r'(?:DWG\s*NO\.?\s*)?([A-Z]{1,2}-\d{2,3}(?:-\w+)?)', re.I)
    _REVISION    = re.compile(r'REV(?:ISION)?\s*[:\-]?\s*([A-Z0-9]{1,3})', re.I)

    async def extract_construction_data(
        self,
        pdf_path: str,
        options: ExtractionOptions
    ) -> ConstructionExtractionResponse:
        """Extract construction-specific data from a PDF (windows, rooms, scales, drawing refs)."""
        start = time.time()
        errors: List[str] = []
        all_openings: List[OpeningCode] = []
        all_room_areas: List[RoomArea] = []
        all_drawing_info: List[DrawingInfo] = []

        try:
            doc = fitz.open(pdf_path)
            total_pages = len(doc)
            pages_to_process = options.pages if options.pages else list(range(total_pages))

            for page_num in pages_to_process:
                if page_num >= total_pages:
                    continue
                try:
                    page = doc[page_num]
                    # Use native text first; fall back to OCR if page looks scanned
                    ocr_results = await self._extract_text(doc, page, page_num, None, options)  # type: ignore[arg-type]
                    full_text_blocks = [(r.text, r.bbox) for r in ocr_results]

                    openings, rooms, drawing = self._parse_construction(full_text_blocks, page_num)
                    all_openings.extend(openings)
                    all_room_areas.extend(rooms)
                    if drawing:
                        all_drawing_info.append(drawing)
                except Exception as e:
                    errors.append(f"Page {page_num}: {e}")

            doc.close()
        except Exception as e:
            errors.append(str(e))
            total_pages = 0

        # Deduplicate openings by ref (keep first occurrence)
        seen_refs: set = set()
        unique_openings: List[OpeningCode] = []
        for o in all_openings:
            if o.ref not in seen_refs:
                seen_refs.add(o.ref)
                unique_openings.append(o)

        total_area = sum(r.area_m2 for r in all_room_areas) or None

        construction_data = ConstructionData(
            openings=unique_openings,
            room_areas=all_room_areas,
            drawing_info=all_drawing_info,
            total_floor_area_m2=round(total_area, 2) if total_area else None,
        )

        return ConstructionExtractionResponse(
            filename=Path(pdf_path).name,
            total_pages=total_pages,
            construction_data=construction_data,
            processing_time_ms=(time.time() - start) * 1000,
            errors=errors,
        )

    def _parse_construction(
        self,
        text_blocks: List[Tuple[str, Any]],
        page_num: int
    ) -> Tuple[List[OpeningCode], List[RoomArea], Optional[DrawingInfo]]:
        """Parse construction-specific entities from a list of (text, bbox) tuples."""
        openings: List[OpeningCode] = []
        room_areas: List[RoomArea] = []
        drawing_number: Optional[str] = None
        scale_str: Optional[str] = None
        scale_ratio: Optional[float] = None
        revision: Optional[str] = None

        for text, bbox in text_blocks:
            t = text.strip()
            if not t:
                continue

            # ── Full opening codes: "1218 SW" ────────────────────────────────
            for m in self._FULL_CODE.finditer(t):
                w_units, h_units, code = m.group(1), m.group(2), m.group(3).upper()
                elem_type, label = self._OPENING_TYPES.get(code, ('window', code))
                openings.append(OpeningCode(
                    ref=m.group(0).strip(),
                    element_type=elem_type,
                    width_mm=float(w_units) * 100,
                    height_mm=float(h_units) * 100,
                    opening_type=label,
                    page=page_num,
                    bbox=bbox if hasattr(bbox, 'x') else None,
                ))

            # ── Reference codes: "W-01", "D3" ────────────────────────────────
            for m in self._REF_CODE.finditer(t):
                letter, num = m.group(1).upper(), m.group(2)
                elem_type = 'window' if letter == 'W' else 'door'
                ref = f"{letter}-{num.zfill(2)}"
                openings.append(OpeningCode(
                    ref=ref,
                    element_type=elem_type,
                    page=page_num,
                    bbox=bbox if hasattr(bbox, 'x') else None,
                ))

            # ── Room areas ────────────────────────────────────────────────────
            for m in self._ROOM_AREA.finditer(t):
                name = m.group(1).strip().title()
                area = float(m.group(2))
                if 1.0 < area < 2000.0:   # sanity range
                    room_areas.append(RoomArea(
                        name=name,
                        area_m2=area,
                        page=page_num,
                        bbox=bbox if hasattr(bbox, 'x') else None,
                    ))

            # ── Scale ─────────────────────────────────────────────────────────
            if scale_str is None:
                sm = self._SCALE.search(t)
                if sm:
                    ratio = float(sm.group(1))
                    if 10 <= ratio <= 5000:
                        scale_str = f"1:{int(ratio)}"
                        scale_ratio = ratio

            # ── Drawing number ────────────────────────────────────────────────
            if drawing_number is None:
                dm = self._DRAWING_NO.search(t)
                if dm:
                    drawing_number = dm.group(1).upper()

            # ── Revision ──────────────────────────────────────────────────────
            if revision is None:
                rm = self._REVISION.search(t)
                if rm:
                    revision = rm.group(1).upper()

        drawing: Optional[DrawingInfo] = None
        if drawing_number or scale_str or revision:
            drawing = DrawingInfo(
                drawing_number=drawing_number,
                scale=scale_str,
                scale_ratio=scale_ratio,
                revision=revision,
                page=page_num,
            )

        return openings, room_areas, drawing
