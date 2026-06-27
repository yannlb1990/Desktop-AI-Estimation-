import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Measurement } from '@/lib/takeoff/types';
import { cn } from '@/lib/utils';

export interface WallSpec {
  id: string;
  label: string;
  description: string;
  framingSystem: string;
  hasLining: boolean;
  liningType: string;
  hasInsulation: boolean;
  insulationType: string;
  liningFaces: number;
}

export const WALL_SPECS: WallSpec[] = [
  {
    id: 'standard_internal',
    label: 'Standard Internal',
    description: '90mm timber · PB both faces · R2.0 batts',
    framingSystem: 'timber_90_mgp10',
    hasLining: true,
    liningType: 'pb_10',
    hasInsulation: true,
    insulationType: 'r2_batts',
    liningFaces: 2,
  },
  {
    id: 'external',
    label: 'External Wall',
    description: '90mm timber · FC + PB faces · R2.5 batts',
    framingSystem: 'timber_90_mgp10',
    hasLining: true,
    liningType: 'fc_9',
    hasInsulation: true,
    insulationType: 'r25_batts',
    liningFaces: 2,
  },
  {
    id: 'wet_area',
    label: 'Wet Area',
    description: '90mm timber · FC both faces · no batts',
    framingSystem: 'timber_90_mgp10',
    hasLining: true,
    liningType: 'fc_6',
    hasInsulation: false,
    insulationType: '',
    liningFaces: 2,
  },
  {
    id: 'steel_internal',
    label: 'Steel Stud',
    description: '92mm steel · PB both faces · R2.0 batts',
    framingSystem: 'steel_92',
    hasLining: true,
    liningType: 'pb_10',
    hasInsulation: true,
    insulationType: 'r2_batts',
    liningFaces: 2,
  },
  {
    id: 'brick_veneer',
    label: 'Brick Veneer',
    description: 'Track only · PB internal face · R2.5 batts',
    framingSystem: 'timber_90_mgp10',
    hasLining: true,
    liningType: 'pb_10',
    hasInsulation: true,
    insulationType: 'r25_batts',
    liningFaces: 1,
  },
];

const LINING_LABELS: Record<string, string> = {
  pb_10: 'Plasterboard 10mm',
  pb_13: 'Plasterboard 13mm',
  fc_6: 'FC Cement 6mm',
  fc_9: 'FC Cement 9mm',
};

const INSULATION_LABELS: Record<string, string> = {
  r2_batts: 'R2.0 Batts',
  r25_batts: 'R2.5 Batts',
  r3_batts: 'R3.0 Batts',
  r4_batts: 'R4.0 Batts',
};

const FRAMING_LABELS: Record<string, string> = {
  timber_90_mgp10: 'Timber 90mm MGP10',
  timber_90_mgp12: 'Timber 90mm MGP12',
  steel_64: 'Steel 64mm stud',
  steel_92: 'Steel 92mm stud',
};

export interface WallUpdate {
  id: string;
  configuredMeasurement: Measurement;
}

interface WallSetupDialogProps {
  open: boolean;
  walls: Measurement[];
  onConfirm: (updates: WallUpdate[]) => void;
  onCancel: () => void;
}

export const WallSetupDialog: React.FC<WallSetupDialogProps> = ({
  open,
  walls,
  onConfirm,
  onCancel,
}) => {
  const [height, setHeight] = useState('2.7');
  const [selectedSpec, setSelectedSpec] = useState<WallSpec>(WALL_SPECS[0]);

  const h = Math.max(parseFloat(height) || 2.7, 0.1);
  const totalLM = walls.reduce((sum, w) => sum + w.realValue, 0);
  const framingM2 = totalLM * h;
  const liningM2 = totalLM * h * selectedSpec.liningFaces;
  const itemCount = 1 + (selectedSpec.hasLining ? 1 : 0) + (selectedSpec.hasInsulation ? 1 : 0);

  const handleConfirm = () => {
    const updates: WallUpdate[] = walls.map(w => ({
      id: w.id,
      configuredMeasurement: {
        ...w,
        measurementType: 'Wall' as const,
        height: h,
        framingSystem: selectedSpec.framingSystem,
        hasLining: selectedSpec.hasLining,
        liningType: selectedSpec.hasLining ? selectedSpec.liningType : undefined,
        liningFaces: selectedSpec.liningFaces,
        hasInsulation: selectedSpec.hasInsulation,
        insulationType: selectedSpec.hasInsulation ? selectedSpec.insulationType : undefined,
      },
    }));
    onConfirm(updates);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-lg z-[10002]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            Wall Setup
            <span className="text-sm font-normal text-muted-foreground">
              {walls.length} wall{walls.length !== 1 ? 's' : ''} · {totalLM.toFixed(1)} LM total
            </span>
          </DialogTitle>
        </DialogHeader>
        <hr className="border-border/50 -mx-2" />

        {/* Wall list */}
        <div className="max-h-44 overflow-y-auto space-y-1 rounded-md border border-border bg-muted/30 p-2">
          {walls.map((w, i) => (
            <div
              key={w.id}
              className="flex items-center justify-between text-sm px-2 py-1 rounded bg-background/50"
            >
              <span className="text-muted-foreground truncate">{w.label || `Wall ${i + 1}`}</span>
              <span className="font-mono text-xs shrink-0 ml-2">{w.realValue.toFixed(2)} LM</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground px-1">
          <span>{walls.length} wall{walls.length !== 1 ? 's' : ''} selected</span>
          <span className="font-mono font-medium">{totalLM.toFixed(2)} LM total</span>
        </div>

        {/* Height */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium w-24 shrink-0">Wall height</span>
          <div className="flex items-center gap-2 flex-1">
            <Input
              type="number"
              value={height}
              onChange={e => setHeight(e.target.value)}
              className="h-9 w-20 text-center font-mono text-sm"
              step="0.05"
              min="1"
              max="6"
            />
            <span className="text-sm text-muted-foreground">m</span>
            <div className="flex gap-1 ml-auto">
              {[2.4, 2.7, 3.0].map(p => (
                <button
                  key={p}
                  onClick={() => setHeight(String(p))}
                  className={cn(
                    'h-7 px-2.5 rounded text-xs font-mono transition-colors',
                    parseFloat(height) === p
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {p}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Spec presets */}
        <div>
          <span className="text-sm font-medium mb-2 block">Wall specification</span>
          <div className="grid grid-cols-3 gap-2">
            {WALL_SPECS.map(spec => (
              <button
                key={spec.id}
                onClick={() => setSelectedSpec(spec)}
                className={cn(
                  'flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-all',
                  selectedSpec.id === spec.id
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                    : 'border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50'
                )}
              >
                <span className="text-sm font-medium">{spec.label}</span>
                <span className="text-[11px] text-muted-foreground leading-tight">{spec.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Live preview */}
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 space-y-1.5">
          <div className="text-[10px] font-mono text-amber-400/70 uppercase tracking-widest mb-2">
            Items that will be added to estimate
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Framing — {FRAMING_LABELS[selectedSpec.framingSystem] || selectedSpec.framingSystem}
            </span>
            <span className="font-mono font-medium">
              {totalLM.toFixed(1)} LM → {framingM2.toFixed(1)} m²
            </span>
          </div>

          {selectedSpec.hasLining && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Lining — {LINING_LABELS[selectedSpec.liningType] || selectedSpec.liningType}
                {selectedSpec.liningFaces === 2 && ' (× 2 faces)'}
              </span>
              <span className="font-mono font-medium">{liningM2.toFixed(1)} m²</span>
            </div>
          )}

          {selectedSpec.hasInsulation && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Insulation — {INSULATION_LABELS[selectedSpec.insulationType] || selectedSpec.insulationType}
              </span>
              <span className="font-mono font-medium">{framingM2.toFixed(1)} m²</span>
            </div>
          )}

          <div className="border-t border-amber-400/10 pt-1.5 flex justify-between text-sm font-semibold text-amber-400">
            <span>Total</span>
            <span>{itemCount} line item{itemCount !== 1 ? 's' : ''} created</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={!height || parseFloat(height) <= 0}
            className="gap-2"
          >
            Add {walls.length} Wall{walls.length !== 1 ? 's' : ''} to Estimate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
