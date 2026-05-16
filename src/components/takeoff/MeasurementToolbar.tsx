import { MousePointer, Move, Eraser, Minus, Square, Pentagon, Circle, Hash, Undo, Redo, Columns, DoorOpen, AppWindow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { ToolType } from '@/lib/takeoff/types';
import { cn } from '@/lib/utils';

interface MeasurementToolbarProps {
  activeTool: ToolType;
  onToolSelect: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  disabled: boolean;
  modMode?: 'wall' | 'door' | 'window' | null;
  onModSelect?: (mod: 'wall' | 'door' | 'window') => void;
}

export const MeasurementToolbar = ({
  activeTool,
  onToolSelect,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  disabled,
  modMode = null,
  onModSelect,
}: MeasurementToolbarProps) => {
  const navigationTools = [
    { id: 'select' as const, icon: MousePointer, label: 'Select (V)', shortcut: 'V' },
    { id: 'pan' as const, icon: Move, label: 'Pan (H)', shortcut: 'H' },
  ];

  const measurementTools = [
    { id: 'line' as const, icon: Minus, label: 'Line (L)', shortcut: 'L', color: 'bg-red-500' },
    { id: 'rectangle' as const, icon: Square, label: 'Rectangle (R)', shortcut: 'R', color: 'bg-green-500' },
    { id: 'polygon' as const, icon: Pentagon, label: 'Polygon (P)', shortcut: 'P', color: 'bg-blue-500' },
    { id: 'circle' as const, icon: Circle, label: 'Circle (C)', shortcut: 'C', color: 'bg-purple-500' },
    { id: 'count' as const, icon: Hash, label: 'Count (N)', shortcut: 'N', color: 'bg-orange-500' },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 p-2 bg-card border border-border rounded-lg">
        {/* Navigation Tools */}
        {navigationTools.map(({ id, icon: Icon, label, shortcut }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === id ? 'default' : 'ghost'}
                size="icon"
                className="h-9 w-9"
                onClick={() => onToolSelect(id)}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Eraser Tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activeTool === 'eraser' ? 'destructive' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              onClick={() => onToolSelect('eraser')}
            >
              <Eraser className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Eraser - Click on any measurement to delete it (E)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Measurement Tools */}
        {measurementTools.map(({ id, icon: Icon, label, color }) => {
          const isActive = modMode === null && activeTool === id;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? 'default' : 'ghost'}
                  size="icon"
                  className={cn('h-9 w-9 relative', isActive && 'ring-2 ring-offset-1')}
                  onClick={() => onToolSelect(id)}
                  disabled={disabled}
                >
                  <Icon className="h-4 w-4" />
                  <span className={cn('absolute bottom-1 right-1 h-2 w-2 rounded-full', color)} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          );
        })}

        {/* Set Scale Badge */}
        {disabled && (
          <Badge variant="secondary" className="ml-1 text-xs">
            Set scale first
          </Badge>
        )}

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Modifications */}
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide px-1 select-none">Modifications</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={modMode === 'wall' ? 'default' : 'ghost'}
              size="icon"
              className={cn('h-9 w-9 relative', modMode === 'wall' && 'ring-2 ring-offset-1')}
              onClick={() => onModSelect?.('wall')}
              disabled={disabled}
            >
              <Columns className="h-4 w-4" />
              <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-amber-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Wall (W)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={modMode === 'door' ? 'default' : 'ghost'}
              size="icon"
              className={cn('h-9 w-9 relative', modMode === 'door' && 'ring-2 ring-offset-1')}
              onClick={() => onModSelect?.('door')}
              disabled={disabled}
            >
              <DoorOpen className="h-4 w-4" />
              <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-violet-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Door (D)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={modMode === 'window' ? 'default' : 'ghost'}
              size="icon"
              className={cn('h-9 w-9 relative', modMode === 'window' && 'ring-2 ring-offset-1')}
              onClick={() => onModSelect?.('window')}
              disabled={disabled}
            >
              <AppWindow className="h-4 w-4" />
              <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-cyan-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Window (Q)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Undo/Redo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onUndo}
              disabled={!canUndo || disabled}
            >
              <Undo className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onRedo}
              disabled={!canRedo || disabled}
            >
              <Redo className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};