import { MousePointer, Move, Search, Grid3X3, ZoomIn, ZoomOut, Maximize2, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ViewportControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  rotation: number;
  onRotate: () => void;
  onFitToScreen: () => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  activeTool: 'select' | 'pan' | null;
  onToolChange: (tool: 'select' | 'pan' | null) => void;
  showMagnifier: boolean;
  onMagnifierToggle: () => void;
  showGrid: boolean;
  onGridToggle: () => void;
}

const ZOOM_PRESETS = [25, 50, 75, 100, 150, 200, 300];

export const ViewportControls = ({
  zoom,
  onZoomChange,
  rotation,
  onRotate,
  onFitToScreen,
  currentPage,
  totalPages,
  onPageChange,
  activeTool,
  onToolChange,
  showMagnifier,
  onMagnifierToggle,
  showGrid,
  onGridToggle,
}: ViewportControlsProps) => {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 p-2 bg-card border border-border rounded-lg">
        {/* Navigation Tools */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activeTool === 'select' ? 'default' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              onClick={() => onToolChange(activeTool === 'select' ? null : 'select')}
            >
              <MousePointer className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Select (V)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activeTool === 'pan' ? 'default' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              onClick={() => onToolChange(activeTool === 'pan' ? null : 'pan')}
            >
              <Move className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Pan (H)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* View Toggles */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showMagnifier ? 'default' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              onClick={onMagnifierToggle}
            >
              <Search className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Magnifier (M)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showGrid ? 'default' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              onClick={onGridToggle}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Grid (G)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Zoom Controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => onZoomChange(Math.max(zoom - 0.25, 0.1))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out (-)</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 min-w-[60px] px-2 font-medium">
              {zoomPercent}%
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-popover">
            {ZOOM_PRESETS.map((preset) => (
              <DropdownMenuItem
                key={preset}
                onClick={() => onZoomChange(preset / 100)}
                className={cn(zoomPercent === preset && 'bg-accent')}
              >
                {preset}%
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => onZoomChange(Math.min(zoom + 0.25, 4))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In (+)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Transform Controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onFitToScreen}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fit to Screen (0)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onRotate}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Rotate 90° (R)</TooltipContent>
        </Tooltip>

        {/* Page Navigation */}
        {totalPages > 1 && (
          <>
            <Separator orientation="vertical" className="h-6 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous Page</TooltipContent>
            </Tooltip>

            <span className="text-sm font-medium px-2 min-w-[80px] text-center">
              Page {currentPage + 1} / {totalPages}
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next Page</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  );
};
