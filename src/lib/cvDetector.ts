// Computer Vision Detector for Architectural Plans
// Detects walls, doors, windows, and fixtures from PDF page images

export interface DetectedShape {
  id: string;
  type: 'wall' | 'door' | 'window' | 'fixture' | 'room_boundary' | 'dimension_line' | 'text_region';
  bounds: {
    x: number;      // Percentage 0-100
    y: number;      // Percentage 0-100
    width: number;  // Percentage 0-100
    height: number; // Percentage 0-100
  };
  // For lines (walls, dimension lines)
  line?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    thickness: number;
  };
  // For arcs (doors)
  arc?: {
    centerX: number;
    centerY: number;
    radius: number;
    startAngle: number;
    endAngle: number;
  };
  confidence: number;
  color?: string;
  label?: string;
}

export interface CVAnalysisResult {
  pageNumber: number;
  shapes: DetectedShape[];
  walls: DetectedShape[];
  doors: DetectedShape[];
  windows: DetectedShape[];
  fixtures: DetectedShape[];
  processingTimeMs: number;
  imageWidth: number;
  imageHeight: number;
}

// Grayscale conversion weights (ITU-R BT.601)
const GRAY_R = 0.299;
const GRAY_G = 0.587;
const GRAY_B = 0.114;

// Sobel kernels for edge detection
const SOBEL_X = [
  [-1, 0, 1],
  [-2, 0, 2],
  [-1, 0, 1]
];

const SOBEL_Y = [
  [-1, -2, -1],
  [0, 0, 0],
  [1, 2, 1]
];

/**
 * Convert canvas to grayscale image data
 */
function toGrayscale(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = Math.round(r * GRAY_R + g * GRAY_G + b * GRAY_B);
  }

  return gray;
}

/**
 * Apply Gaussian blur to reduce noise
 */
function gaussianBlur(gray: Uint8Array, width: number, height: number): Uint8Array {
  const kernel = [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1]
  ];
  const kernelSum = 16;
  const result = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += gray[(y + ky) * width + (x + kx)] * kernel[ky + 1][kx + 1];
        }
      }
      result[y * width + x] = Math.round(sum / kernelSum);
    }
  }

  return result;
}

/**
 * Sobel edge detection
 */
function sobelEdgeDetection(gray: Uint8Array, width: number, height: number): {
  magnitude: Uint8Array;
  direction: Float32Array;
} {
  const magnitude = new Uint8Array(width * height);
  const direction = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = gray[(y + ky) * width + (x + kx)];
          gx += pixel * SOBEL_X[ky + 1][kx + 1];
          gy += pixel * SOBEL_Y[ky + 1][kx + 1];
        }
      }

      const mag = Math.sqrt(gx * gx + gy * gy);
      magnitude[y * width + x] = Math.min(255, Math.round(mag));
      direction[y * width + x] = Math.atan2(gy, gx);
    }
  }

  return { magnitude, direction };
}

/**
 * Apply threshold to create binary image
 */
function threshold(data: Uint8Array, thresh: number): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] > thresh ? 255 : 0;
  }
  return result;
}

/**
 * Adaptive threshold based on local mean
 */
function adaptiveThreshold(gray: Uint8Array, width: number, height: number, blockSize: number = 15): Uint8Array {
  const result = new Uint8Array(width * height);
  const halfBlock = Math.floor(blockSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;

      for (let by = -halfBlock; by <= halfBlock; by++) {
        for (let bx = -halfBlock; bx <= halfBlock; bx++) {
          const ny = y + by;
          const nx = x + bx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            sum += gray[ny * width + nx];
            count++;
          }
        }
      }

      const mean = sum / count;
      const pixel = gray[y * width + x];
      // Invert: black lines on white background become white on black
      result[y * width + x] = pixel < mean - 10 ? 255 : 0;
    }
  }

  return result;
}

/**
 * Hough Line Transform - detects straight lines
 */
function houghLines(
  binary: Uint8Array,
  width: number,
  height: number,
  minVotes: number = 50,
  minLength: number = 30
): Array<{ x1: number; y1: number; x2: number; y2: number; votes: number }> {
  const diagonal = Math.sqrt(width * width + height * height);
  const rhoMax = Math.ceil(diagonal);
  const thetaSteps = 180;

  // Accumulator array
  const accumulator = new Uint32Array(rhoMax * 2 * thetaSteps);

  // Precompute sin/cos
  const sinTable = new Float32Array(thetaSteps);
  const cosTable = new Float32Array(thetaSteps);
  for (let t = 0; t < thetaSteps; t++) {
    const theta = (t * Math.PI) / thetaSteps;
    sinTable[t] = Math.sin(theta);
    cosTable[t] = Math.cos(theta);
  }

  // Vote
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (binary[y * width + x] > 0) {
        for (let t = 0; t < thetaSteps; t++) {
          const rho = Math.round(x * cosTable[t] + y * sinTable[t]) + rhoMax;
          accumulator[rho * thetaSteps + t]++;
        }
      }
    }
  }

  // Find peaks
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number; votes: number }> = [];

  for (let rho = 0; rho < rhoMax * 2; rho++) {
    for (let t = 0; t < thetaSteps; t++) {
      const votes = accumulator[rho * thetaSteps + t];
      if (votes >= minVotes) {
        const theta = (t * Math.PI) / thetaSteps;
        const r = rho - rhoMax;

        // Convert to line endpoints
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        let x1, y1, x2, y2;
        if (Math.abs(sin) > Math.abs(cos)) {
          // More horizontal
          x1 = 0;
          y1 = r / sin;
          x2 = width;
          y2 = (r - width * cos) / sin;
        } else {
          // More vertical
          y1 = 0;
          x1 = r / cos;
          y2 = height;
          x2 = (r - height * sin) / cos;
        }

        // Clip to image bounds
        x1 = Math.max(0, Math.min(width, x1));
        x2 = Math.max(0, Math.min(width, x2));
        y1 = Math.max(0, Math.min(height, y1));
        y2 = Math.max(0, Math.min(height, y2));

        const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        if (length >= minLength) {
          lines.push({ x1, y1, x2, y2, votes });
        }
      }
    }
  }

  // Sort by votes and remove duplicates
  lines.sort((a, b) => b.votes - a.votes);

  // Merge similar lines
  const merged: typeof lines = [];
  const used = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue;

    const line = lines[i];
    let sumX1 = line.x1, sumY1 = line.y1, sumX2 = line.x2, sumY2 = line.y2;
    let count = 1;

    for (let j = i + 1; j < lines.length; j++) {
      if (used.has(j)) continue;

      const other = lines[j];
      const dist = Math.abs(line.x1 - other.x1) + Math.abs(line.y1 - other.y1) +
                   Math.abs(line.x2 - other.x2) + Math.abs(line.y2 - other.y2);

      if (dist < 50) {
        sumX1 += other.x1;
        sumY1 += other.y1;
        sumX2 += other.x2;
        sumY2 += other.y2;
        count++;
        used.add(j);
      }
    }

    merged.push({
      x1: sumX1 / count,
      y1: sumY1 / count,
      x2: sumX2 / count,
      y2: sumY2 / count,
      votes: line.votes
    });
    used.add(i);
  }

  return merged.slice(0, 100); // Limit results
}

/**
 * Find contours in binary image (simplified)
 */
function findContours(
  binary: Uint8Array,
  width: number,
  height: number,
  minArea: number = 100
): Array<{ points: Array<{ x: number; y: number }>; area: number; bounds: { x: number; y: number; width: number; height: number } }> {
  const visited = new Uint8Array(width * height);
  const contours: Array<{ points: Array<{ x: number; y: number }>; area: number; bounds: { x: number; y: number; width: number; height: number } }> = [];

  // 8-connected neighbors
  const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
  const dy = [-1, -1, -1, 0, 0, 1, 1, 1];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binary[idx] > 0 && !visited[idx]) {
        // Flood fill to find connected component
        const points: Array<{ x: number; y: number }> = [];
        const stack = [{ x, y }];
        let minX = x, maxX = x, minY = y, maxY = y;

        while (stack.length > 0) {
          const p = stack.pop()!;
          const pidx = p.y * width + p.x;

          if (visited[pidx]) continue;
          visited[pidx] = 1;

          if (binary[pidx] > 0) {
            points.push(p);
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);

            for (let d = 0; d < 8; d++) {
              const nx = p.x + dx[d];
              const ny = p.y + dy[d];
              if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny * width + nx]) {
                stack.push({ x: nx, y: ny });
              }
            }
          }
        }

        if (points.length >= minArea) {
          contours.push({
            points,
            area: points.length,
            bounds: {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY
            }
          });
        }
      }
    }
  }

  return contours;
}

/**
 * Detect arcs (potential doors) using improved Hough Circle Transform
 * Optimized for Australian architectural drawings where doors are shown as quarter-circle swings
 */
function detectArcs(
  binary: Uint8Array,
  width: number,
  height: number
): Array<{ centerX: number; centerY: number; radius: number; startAngle: number; endAngle: number; confidence: number }> {
  const arcs: Array<{ centerX: number; centerY: number; radius: number; startAngle: number; endAngle: number; confidence: number }> = [];

  // Door swings are typically 700-900mm which scales to roughly 1.5-6% of page width
  // Be more generous with range to catch different drawing scales
  const minRadius = Math.min(width, height) * 0.015;
  const maxRadius = Math.min(width, height) * 0.07;

  // More radius steps for better accuracy
  const radiusSteps = 15;
  const radiusInc = (maxRadius - minRadius) / radiusSteps;

  // Subsample for speed - check every 2nd pixel on larger images
  const step = width > 1000 ? 2 : 1;

  for (let r = minRadius; r <= maxRadius; r += radiusInc) {
    const accumulator = new Map<string, { votes: number; angles: number[] }>();

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (binary[y * width + x] > 0) {
          // Vote for potential centers - use finer angle steps for accuracy
          for (let angle = 0; angle < 360; angle += 3) {
            const rad = (angle * Math.PI) / 180;
            const cx = Math.round(x - r * Math.cos(rad));
            const cy = Math.round(y - r * Math.sin(rad));

            if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
              // Quantize center position to reduce noise
              const qcx = Math.round(cx / 3) * 3;
              const qcy = Math.round(cy / 3) * 3;
              const key = `${qcx},${qcy}`;

              const entry = accumulator.get(key) || { votes: 0, angles: [] };
              entry.votes++;
              entry.angles.push(angle);
              accumulator.set(key, entry);
            }
          }
        }
      }
    }

    // Find peaks - looking for quarter circles (90 degrees = 25% of circumference)
    const circumference = 2 * Math.PI * r;
    const quarterArc = circumference * 0.2; // ~20% minimum for a door swing
    const maxArc = circumference * 0.35; // ~35% max (more than quarter but not half)

    for (const [key, data] of accumulator.entries()) {
      const { votes, angles } = data;

      if (votes >= quarterArc && votes <= maxArc) {
        const [cx, cy] = key.split(',').map(Number);

        // Determine the arc direction by analyzing which angles have hits
        const sortedAngles = [...angles].sort((a, b) => a - b);

        // Find the continuous arc span
        let minAngle = sortedAngles[0];
        let maxAngle = sortedAngles[sortedAngles.length - 1];

        // Check for wrap-around (arc crossing 0 degrees)
        let hasGap = false;
        for (let i = 1; i < sortedAngles.length; i++) {
          if (sortedAngles[i] - sortedAngles[i - 1] > 45) {
            hasGap = true;
            // Re-orient to find actual arc span
            minAngle = sortedAngles[i];
            maxAngle = sortedAngles[i - 1] + 360;
            break;
          }
        }

        const arcSpan = maxAngle - minAngle;

        // Door swings are typically 85-95 degrees
        if (arcSpan >= 70 && arcSpan <= 120) {
          const startAngle = (minAngle * Math.PI) / 180;
          const endAngle = ((minAngle + arcSpan) * Math.PI) / 180;
          const confidence = Math.min(votes / (quarterArc * 1.5), 1);

          arcs.push({
            centerX: cx,
            centerY: cy,
            radius: r,
            startAngle,
            endAngle,
            confidence
          });
        }
      }
    }
  }

  // Remove duplicates with improved distance threshold
  const filtered: typeof arcs = [];
  for (const arc of arcs) {
    const isDupe = filtered.some(
      a => Math.abs(a.centerX - arc.centerX) < 15 &&
           Math.abs(a.centerY - arc.centerY) < 15 &&
           Math.abs(a.radius - arc.radius) < arc.radius * 0.2
    );
    if (!isDupe) {
      filtered.push(arc);
    }
  }

  // Sort by confidence and return top results
  filtered.sort((a, b) => b.confidence - a.confidence);
  return filtered.slice(0, 60);
}

/**
 * Classify detected shapes into architectural elements
 * Improved for Australian residential architectural drawings
 */
function classifyShapes(
  lines: Array<{ x1: number; y1: number; x2: number; y2: number; votes: number }>,
  arcs: Array<{ centerX: number; centerY: number; radius: number; startAngle: number; endAngle: number; confidence?: number }>,
  contours: Array<{ points: Array<{ x: number; y: number }>; area: number; bounds: { x: number; y: number; width: number; height: number } }>,
  width: number,
  height: number
): DetectedShape[] {
  const shapes: DetectedShape[] = [];
  let id = 0;

  // Classify lines as walls
  for (const line of lines) {
    const length = Math.sqrt((line.x2 - line.x1) ** 2 + (line.y2 - line.y1) ** 2);
    const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);

    // Walls are typically long horizontal or vertical lines
    const isHorizontal = Math.abs(angle) < 0.15 || Math.abs(angle - Math.PI) < 0.15;
    const isVertical = Math.abs(angle - Math.PI / 2) < 0.15 || Math.abs(angle + Math.PI / 2) < 0.15;

    if (length > 40 && (isHorizontal || isVertical)) {
      const minX = Math.min(line.x1, line.x2);
      const minY = Math.min(line.y1, line.y2);
      const maxX = Math.max(line.x1, line.x2);
      const maxY = Math.max(line.y1, line.y2);

      shapes.push({
        id: `wall-${id++}`,
        type: 'wall',
        bounds: {
          x: (minX / width) * 100,
          y: (minY / height) * 100,
          width: Math.max(((maxX - minX) / width) * 100, 0.5),
          height: Math.max(((maxY - minY) / height) * 100, 0.5)
        },
        line: {
          x1: (line.x1 / width) * 100,
          y1: (line.y1 / height) * 100,
          x2: (line.x2 / width) * 100,
          y2: (line.y2 / height) * 100,
          thickness: 2
        },
        confidence: Math.min(line.votes / 80, 1),
        color: '#1e293b'
      });
    }
  }

  // Classify arcs as doors - use confidence from arc detection
  for (const arc of arcs) {
    shapes.push({
      id: `door-${id++}`,
      type: 'door',
      bounds: {
        x: ((arc.centerX - arc.radius) / width) * 100,
        y: ((arc.centerY - arc.radius) / height) * 100,
        width: ((arc.radius * 2) / width) * 100,
        height: ((arc.radius * 2) / height) * 100
      },
      arc: {
        centerX: (arc.centerX / width) * 100,
        centerY: (arc.centerY / height) * 100,
        radius: (arc.radius / Math.min(width, height)) * 100,
        startAngle: arc.startAngle,
        endAngle: arc.endAngle
      },
      confidence: arc.confidence || 0.65,
      color: '#ef4444',
      label: 'Door'
    });
  }

  // Classify rectangular contours as windows or fixtures
  // Windows in floor plans are shown as parallel lines in wall openings
  for (const contour of contours) {
    const { bounds, area } = contour;
    const aspectRatio = bounds.width / Math.max(bounds.height, 1);

    // Skip very large or very small contours
    const relativeArea = area / (width * height);
    if (relativeArea < 0.00005 || relativeArea > 0.08) continue;

    // Windows in floor plans: typically elongated rectangles
    // Can be horizontal (wide) or vertical (tall) depending on wall orientation
    const isWindowShape =
      (aspectRatio > 2 && aspectRatio < 8 && bounds.width > 15 && bounds.height > 3) || // Horizontal window
      (aspectRatio < 0.5 && aspectRatio > 0.125 && bounds.height > 15 && bounds.width > 3); // Vertical window

    if (isWindowShape) {
      shapes.push({
        id: `window-${id++}`,
        type: 'window',
        bounds: {
          x: (bounds.x / width) * 100,
          y: (bounds.y / height) * 100,
          width: (bounds.width / width) * 100,
          height: (bounds.height / height) * 100
        },
        confidence: 0.55,
        color: '#3b82f6',
        label: 'Window'
      });
    }
    // Fixtures: small to medium sized rectangles (toilets, basins, appliances)
    else if (aspectRatio > 0.4 && aspectRatio < 2.5 && bounds.width > 8 && bounds.width < 60 && bounds.height > 8 && bounds.height < 60) {
      // Check if it's a reasonable size for a fixture
      const pixelArea = bounds.width * bounds.height;
      if (pixelArea > 100 && pixelArea < 3000) {
        shapes.push({
          id: `fixture-${id++}`,
          type: 'fixture',
          bounds: {
            x: (bounds.x / width) * 100,
            y: (bounds.y / height) * 100,
            width: (bounds.width / width) * 100,
            height: (bounds.height / height) * 100
          },
          confidence: 0.45,
          color: '#f59e0b',
          label: 'Fixture'
        });
      }
    }
  }

  return shapes;
}

/**
 * Main function: Analyze a PDF page image for architectural elements
 * Enhanced for Australian architectural drawings
 * Added error handling and memory management to prevent crashes
 */
export async function analyzePageImage(
  canvas: HTMLCanvasElement,
  pageNumber: number
): Promise<CVAnalysisResult> {
  const startTime = performance.now();

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }

    let { width, height } = canvas;

    // Limit canvas size to prevent memory issues - max 2000x2000
    const maxDimension = 2000;
    let scale = 1;
    if (width > maxDimension || height > maxDimension) {
      scale = maxDimension / Math.max(width, height);
      // Create a smaller canvas for analysis
      const scaledCanvas = document.createElement('canvas');
      const scaledWidth = Math.floor(width * scale);
      const scaledHeight = Math.floor(height * scale);
      scaledCanvas.width = scaledWidth;
      scaledCanvas.height = scaledHeight;
      const scaledCtx = scaledCanvas.getContext('2d');
      if (!scaledCtx) {
        throw new Error('Failed to create scaled canvas context');
      }
      scaledCtx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight);
      width = scaledWidth;
      height = scaledHeight;
      // Use scaled canvas for analysis
      const imageData = scaledCtx.getImageData(0, 0, width, height);
      const result = await processImageData(imageData, width, height, pageNumber, startTime);
      scaledCanvas.remove();
      return result;
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    return await processImageData(imageData, width, height, pageNumber, startTime);
  } catch (error) {
    console.error('CV Analysis error:', error);
    // Return empty result on error instead of crashing
    return {
      pageNumber,
      shapes: [],
      walls: [],
      doors: [],
      windows: [],
      fixtures: [],
      processingTimeMs: performance.now() - startTime,
      imageWidth: canvas.width,
      imageHeight: canvas.height,
    };
  }
}

/**
 * Process image data for CV analysis - extracted for reuse
 */
async function processImageData(
  imageData: ImageData,
  width: number,
  height: number,
  pageNumber: number,
  startTime: number
): Promise<CVAnalysisResult> {

  // Step 1: Convert to grayscale
  const gray = toGrayscale(imageData);

  // Step 2: Apply Gaussian blur
  const blurred = gaussianBlur(gray, width, height);

  // Step 3: Adaptive threshold for binary image
  // Use larger block size for architectural drawings
  const blockSize = Math.max(15, Math.min(25, Math.floor(Math.min(width, height) / 50)));
  const binary = adaptiveThreshold(blurred, width, height, blockSize);

  // Step 4: Detect lines (walls) - lower threshold for architectural drawings
  const lines = houghLines(binary, width, height, 35, 40);

  // Step 5: Detect arcs (doors) - always run, the function handles subsampling
  const arcs = detectArcs(binary, width, height);

  // Step 6: Find contours (windows, fixtures) - lower min area threshold
  const contours = findContours(binary, width, height, 30);

  // Step 7: Classify shapes
  const shapes = classifyShapes(lines, arcs, contours, width, height);

  const processingTimeMs = performance.now() - startTime;

  console.log(`CV Analysis complete: ${shapes.length} shapes (${arcs.length} door arcs, ${lines.length} lines, ${contours.length} contours) in ${processingTimeMs.toFixed(0)}ms`);

  return {
    pageNumber,
    shapes,
    walls: shapes.filter(s => s.type === 'wall'),
    doors: shapes.filter(s => s.type === 'door'),
    windows: shapes.filter(s => s.type === 'window'),
    fixtures: shapes.filter(s => s.type === 'fixture'),
    processingTimeMs,
    imageWidth: width,
    imageHeight: height
  };
}

/**
 * Render a PDF page to canvas for CV analysis
 */
export async function renderPageToCanvas(
  pdfDoc: any, // PDFDocumentProxy
  pageNumber: number,
  scale: number = 1.8 // Higher scale for better detail detection
): Promise<HTMLCanvasElement> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d')!;
  // Use white background for better contrast
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  await page.render({
    canvasContext: ctx,
    viewport
  }).promise;

  return canvas;
}

/**
 * Analyze multiple pages
 */
export async function analyzeAllPages(
  pdfDoc: any,
  onProgress?: (page: number, total: number) => void
): Promise<CVAnalysisResult[]> {
  const results: CVAnalysisResult[] = [];
  const numPages = pdfDoc.numPages;

  for (let i = 1; i <= numPages; i++) {
    onProgress?.(i, numPages);

    const canvas = await renderPageToCanvas(pdfDoc, i, 1.0);
    const result = await analyzePageImage(canvas, i);
    results.push(result);

    // Clean up
    canvas.remove();
  }

  return results;
}
