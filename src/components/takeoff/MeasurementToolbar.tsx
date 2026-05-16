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

  const modTools = [
    { id: 'wall' as const, icon: Columns, label: 'Add Wall (W)', color: 'bg-amber-500', ring: 'ring-amber-500' },
    { id: 'door' as const, icon: DoorOpen, label: 'Add Door (D)', color: 'bg-violet-500', ring: 'ring-violet-500' },
    { id: 'window' as const, icon: AppWindow, label: 'Add Window (Q)', color: 'bg-cyan-500', ring: 'ring-cyan-500' },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-1">
        {/* ── Row 1: Measure tools ── */}
        <div className="flex items-center gap-1 p-2 bg-card border border-border rounded-lg overflow-x-auto">
          {/* Navigation Tools */}
          {navigationTools.map(({ id, icon: Icon, label }) => (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <Button
                  variant={activeTool === id ? 'default' : 'ghost'}
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => onToolSelect(id)}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}

          <Separator orientation="vertical" className="h-6 mx-1 shrink-0" />

          {/* Eraser Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === 'eraser' ? 'destructive' : 'ghost'}
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => onToolSelect('eraser')}
              >
                <Eraser className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eraser — click a measurement to delete (E)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-1 shrink-0" />

          {/* Measurement Tools */}
          {measurementTools.map(({ id, icon: Icon, label, color }) => {
            const isActive = modMode === null && activeTool === id;
            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    size="icon"
                    className={cn('h-9 w-9 relative shrink-0', isActive && 'ring-2 ring-offset-1')}
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

          {disabled && (
            <Badge variant="secondary" className="ml-1 text-xs shrink-0">
              Set scale first
            </Badge>
          )}

          <Separator orientation="vertical" className="h-6 mx-1 shrink-0" />

          {/* Undo/Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onUndo} disabled={!canUndo || disabled}>
                <Undo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onRedo} disabled={!canRedo || disabled}>
                <Redo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        {/* ── Row 2: Modifications (always visible) ── */}
        {onModSelect && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 border border-border rounded-lg">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide shrink-0 select-none">
              Add to plan:
            </span>
            {modTools.map(({ id, icon: Icon, label, color, ring }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={modMode === id ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      'h-8 gap-1.5 shrink-0',
                      modMode === id && `ring-2 ring-offset-1 ${ring}`
                    )}
                    onClick={() => onModSelect(id)}
                    disabled={disabled}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium capitalize">{id}</span>
                    <span className={cn('h-2 w-2 rounded-full shrink-0', color)} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
            {modMode && (
              <span className="text-xs text-muted-foreground ml-1 italic">
                Draw on the plan — a cost dialog will appear
              </span>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
