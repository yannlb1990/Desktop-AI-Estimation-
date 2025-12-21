import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

interface MagnifierProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isVisible: boolean;
  onClose: () => void;
}

export const Magnifier = ({ canvasRef, isVisible, onClose }: MagnifierProps) => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [magnification, setMagnification] = useState(2);
  const [lensSize, setLensSize] = useState(150);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track mouse position on main canvas
  useEffect(() => {
    if (!isVisible || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    return () => canvas.removeEventListener('mousemove', handleMouseMove);
  }, [isVisible, canvasRef]);

  // Render magnified view
  useEffect(() => {
    if (!isVisible || !canvasRef.current || !magnifierCanvasRef.current) return;

    const sourceCanvas = canvasRef.current;
    const magnifierCanvas = magnifierCanvasRef.current;
    const ctx = magnifierCanvas.getContext('2d');
    if (!ctx) return;

    magnifierCanvas.width = lensSize;
    magnifierCanvas.height = lensSize;

    const sourceSize = lensSize / magnification;
    const sourceX = mousePos.x - sourceSize / 2;
    const sourceY = mousePos.y - sourceSize / 2;

    ctx.clearRect(0, 0, lensSize, lensSize);
    ctx.drawImage(
      sourceCanvas,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      lensSize,
      lensSize
    );

    // Draw crosshair
    ctx.strokeStyle = 'hsl(var(--destructive))';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lensSize / 2, 0);
    ctx.lineTo(lensSize / 2, lensSize);
    ctx.moveTo(0, lensSize / 2);
    ctx.lineTo(lensSize, lensSize / 2);
    ctx.stroke();

    // Draw center dot
    ctx.fillStyle = 'hsl(var(--destructive))';
    ctx.beginPath();
    ctx.arc(lensSize / 2, lensSize / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }, [isVisible, mousePos, magnification, lensSize, canvasRef]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  const handleDrag = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      };
      const handleGlobalMouseUp = () => setIsDragging(false);
      
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  if (!isVisible) return null;

  return (
    <Card
      ref={containerRef}
      className="fixed z-50 shadow-xl"
      style={{ left: position.x, top: position.y }}
    >
      {/* Header - Draggable */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-muted border-b cursor-move"
        onMouseDown={handleDragStart}
        onMouseMove={handleDrag}
        onMouseUp={handleDragEnd}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Move className="h-4 w-4 text-muted-foreground" />
          <span>Magnifier</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Magnifier Canvas */}
      <div className="p-2 border-b">
        <canvas
          ref={magnifierCanvasRef}
          className="border border-border rounded"
          style={{ width: lensSize, height: lensSize }}
        />
      </div>

      {/* Controls */}
      <div className="p-3 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Magnification: {magnification.toFixed(1)}x</Label>
          <Slider
            value={[magnification]}
            onValueChange={([v]) => setMagnification(v)}
            min={1.5}
            max={5}
            step={0.5}
            className="w-full"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Size: {lensSize}px</Label>
          <Slider
            value={[lensSize]}
            onValueChange={([v]) => setLensSize(v)}
            min={100}
            max={300}
            step={25}
            className="w-full"
          />
        </div>

        <div className="text-xs text-muted-foreground text-center">
          X: {mousePos.x.toFixed(0)} Y: {mousePos.y.toFixed(0)}
        </div>
      </div>
    </Card>
  );
};
