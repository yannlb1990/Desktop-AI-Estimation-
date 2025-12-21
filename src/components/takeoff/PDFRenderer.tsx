import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2 } from 'lucide-react';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PDFRendererProps {
  pdfUrl: string;
  pageIndex: number;
  zoomLevel: number;
  rotation: 0 | 90 | 180 | 270;
  onRenderComplete: (canvas: HTMLCanvasElement, viewport: any) => void;
}

export const PDFRenderer = ({
  pdfUrl,
  pageIndex,
  zoomLevel,
  rotation,
  onRenderComplete
}: PDFRendererProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderPDF = async () => {
      if (!canvasRef.current) return;

      setRendering(true);
      setError(null);

      try {
        // Check if it's a PDF or image
        const isPDF = pdfUrl.toLowerCase().endsWith('.pdf') || pdfUrl.includes('application/pdf');

        if (isPDF) {
          // Render PDF using PDF.js
          const loadingTask = pdfjsLib.getDocument(pdfUrl);
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(pageIndex + 1);

          const viewport = page.getViewport({ scale: zoomLevel, rotation });
          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');

          if (!context) throw new Error('Could not get canvas context');

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context,
            viewport: viewport,
            canvas: canvas
          } as any).promise;

          onRenderComplete(canvas, viewport);
        } else {
          // Render image directly
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = pdfUrl;
          });

          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');

          if (!context) throw new Error('Could not get canvas context');

          // Scale image
          canvas.width = img.width * zoomLevel;
          canvas.height = img.height * zoomLevel;

          // Apply rotation
          context.save();
          if (rotation === 90 || rotation === 270) {
            canvas.width = img.height * zoomLevel;
            canvas.height = img.width * zoomLevel;
          }
          
          context.translate(canvas.width / 2, canvas.height / 2);
          context.rotate((rotation * Math.PI) / 180);
          context.scale(zoomLevel, zoomLevel);
          context.drawImage(img, -img.width / 2, -img.height / 2);
          context.restore();

          const viewport = {
            width: canvas.width,
            height: canvas.height,
            scale: zoomLevel
          };

          onRenderComplete(canvas, viewport);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to render PDF';
        setError(errorMsg);
        console.error('PDF rendering error:', err);
      } finally {
        setRendering(false);
      }
    };

    renderPDF();
  }, [pdfUrl, pageIndex, zoomLevel, rotation, onRenderComplete]);

  return (
    <div className="relative">
      {rendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <p className="text-destructive">{error}</p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="max-w-full h-auto border border-border"
      />
    </div>
  );
};
