import { useState } from 'react';
import { Ruler, CheckCircle, RotateCcw, X, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { calculatePresetScaleWorld, calculateManualScaleWorld } from '@/lib/takeoff/calculations';
import { ScaleData, WorldPoint, DistanceUnit } from '@/lib/takeoff/types';
import { toast } from 'sonner';

interface ScalingCalibratorProps {
  currentScale: ScaleData | null;
  isCalibrated: boolean;
  onScaleSet: (scale: ScaleData) => void;
  onManualCalibrationStart: () => void;
  onManualCalibrationCancel?: () => void;
  onResetScale?: () => void;
  manualPoints: [WorldPoint, WorldPoint] | null;
  onCalibrationComplete: () => void;
  pdfViewport?: { width: number; height: number } | null;
  onStartVerify?: () => void;
}

export const ScalingCalibrator = ({
  currentScale,
  isCalibrated,
  onScaleSet,
  onManualCalibrationStart,
  onManualCalibrationCancel,
  onResetScale,
  manualPoints,
  onCalibrationComplete,
  pdfViewport,
  onStartVerify,
}: ScalingCalibratorProps) => {
  const [calibrationMode, setCalibrationMode] = useState<'preset' | 'manual'>('preset');
  const [selectedScale, setSelectedScale] = useState('1:100');
  const [customScale, setCustomScale] = useState('');
  const [manualDistance, setManualDistance] = useState('');
  const [unit, setUnit] = useState<DistanceUnit>('m');
  const [drawingAreaPercent, setDrawingAreaPercent] = useState(85);
  const [useCustomScale, setUseCustomScale] = useState(false);

  // Expanded preset scales for Australian construction drawings
  const presetScales = [
    '1:10', '1:20', '1:25', '1:50', '1:75',
    '1:100', '1:150', '1:200', '1:250', '1:500', '1:1000'
  ];

  const handlePresetScale = () => {
    const pageWidth = pdfViewport?.width || 595;

    // Use custom scale if enabled and valid
    let scaleToUse = selectedScale;
    if (useCustomScale && customScale) {
      const customRatio = parseInt(customScale);
      if (isNaN(customRatio) || customRatio <= 0) {
        toast.error('Please enter a valid custom scale ratio (e.g., 75 for 1:75)');
        return;
      }
      scaleToUse = `1:${customRatio}`;
    }

    console.log('Preset scale using PDF width:', pageWidth, 'Drawing area:', drawingAreaPercent + '%', 'Scale:', scaleToUse);

    const scale = calculatePresetScaleWorld(scaleToUse, pageWidth, drawingAreaPercent / 100);
    onScaleSet(scale);
    toast.success(`Scale set to ${scaleToUse} (${drawingAreaPercent}% drawing area)`);
  };

  const handleManualCalibrationComplete = () => {
    if (!manualPoints || manualPoints.length !== 2) {
      toast.error('Please draw a calibration line on the plan');
      return;
    }

    const distance = parseFloat(manualDistance);
    if (isNaN(distance) || distance <= 0) {
      toast.error('Please enter a valid distance');
      return;
    }

    const scale = calculateManualScaleWorld(
      manualPoints[0],
      manualPoints[1],
      distance,
      unit
    );

    console.log('Manual calibration:', {
      points: manualPoints,
      distance,
      unit,
      unitsPerMetre: scale.unitsPerMetre
    });

    onScaleSet(scale);
    toast.success('Manual calibration complete');
    setManualDistance('');
    onCalibrationComplete();
  };

  const handleCancel = () => {
    setManualDistance('');
    onManualCalibrationCancel?.();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Ruler className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Scale Calibration</h3>
        {isCalibrated && (
          <div className="flex items-center gap-1 ml-auto">
            <CheckCircle className="h-4 w-4 text-green-500" />
            {onResetScale && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onResetScale}
                title="Reset scale"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {isCalibrated && currentScale && (
        <div className="bg-green-50 dark:bg-green-950 p-3 rounded-md space-y-2">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            ✓ Scale Active: {currentScale.scaleFactor ? `1:${currentScale.scaleFactor}` : 'Manual'}
          </p>
          <p className="text-xs text-green-700 dark:text-green-300">
            {currentScale.unitsPerMetre.toFixed(2)} PDF units per metre
            {currentScale.scaleMethod === 'preset' && ' — preset'}
            {currentScale.scaleMethod === 'manual' && ' — verified'}
          </p>
          {onStartVerify && currentScale.scaleMethod === 'preset' && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs border-green-600 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900"
              onClick={onStartVerify}
            >
              <Ruler className="h-3 w-3 mr-1.5" />
              Verify Scale on Drawing
            </Button>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant={calibrationMode === 'preset' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCalibrationMode('preset')}
          className="flex-1"
        >
          Preset Scale
        </Button>
        <Button
          variant={calibrationMode === 'manual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCalibrationMode('manual')}
          className="flex-1"
        >
          Manual Calibration
        </Button>
      </div>

      {calibrationMode === 'preset' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Select Scale</Label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomScale}
                  onChange={(e) => setUseCustomScale(e.target.checked)}
                  className="h-3 w-3"
                />
                Custom
              </label>
            </div>

            {useCustomScale ? (
              <div className="flex gap-2 items-center">
                <span className="text-sm font-medium">1:</span>
                <Input
                  type="number"
                  placeholder="e.g., 75"
                  value={customScale}
                  onChange={(e) => setCustomScale(e.target.value)}
                  min="1"
                  step="1"
                  className="flex-1"
                />
              </div>
            ) : (
              <Select value={selectedScale} onValueChange={setSelectedScale}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover max-h-60">
                  {presetScales.map(scale => (
                    <SelectItem key={scale} value={scale}>
                      {scale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Drawing Area %</Label>
              <span className="text-xs font-medium">{drawingAreaPercent}%</span>
            </div>
            <Slider
              value={[drawingAreaPercent]}
              onValueChange={(val) => setDrawingAreaPercent(val[0])}
              min={50}
              max={100}
              step={1}
              className="w-full"
            />
            <p className="text-[10px] text-muted-foreground">
              Adjust for title blocks & borders (85% typical for A1/A3)
            </p>
          </div>

          {pdfViewport && (
            <p className="text-xs text-muted-foreground">
              PDF size: {pdfViewport.width.toFixed(0)} × {pdfViewport.height.toFixed(0)} pts
            </p>
          )}
          <Button onClick={handlePresetScale} className="w-full">
            Apply Scale
          </Button>
        </div>
      )}

      {calibrationMode === 'manual' && (
        <div className="space-y-3">
          <div className="bg-muted p-3 rounded-md text-sm">
            <p className="font-medium mb-1">Instructions:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Click "Start" then click-drag a line on a known dimension</li>
              <li>Enter the real-world distance</li>
              <li>Click "Apply" to set scale</li>
            </ol>
          </div>

          {!manualPoints && (
            <Button onClick={onManualCalibrationStart} className="w-full">
              Start Calibration
            </Button>
          )}

          {manualPoints && (
            <>
              <div className="bg-green-50 dark:bg-green-950 p-2 rounded-md">
                <Badge variant="secondary" className="w-full justify-center py-1 mb-2">
                  Line drawn on plan ✓
                </Badge>
                <p className="text-xs text-center text-muted-foreground">
                  Line length: {Math.hypot(
                    manualPoints[1].x - manualPoints[0].x,
                    manualPoints[1].y - manualPoints[0].y
                  ).toFixed(1)} PDF units
                </p>
              </div>

              <div className="space-y-2">
                <Label>Real-World Distance</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="e.g., 5.5"
                    value={manualDistance}
                    onChange={(e) => setManualDistance(e.target.value)}
                    min="0"
                    step="0.01"
                    className="flex-1"
                  />
                  <Select value={unit} onValueChange={(v: DistanceUnit) => setUnit(v)}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="m">metres</SelectItem>
                      <SelectItem value="mm">mm</SelectItem>
                      <SelectItem value="cm">cm</SelectItem>
                      <SelectItem value="ft">feet</SelectItem>
                      <SelectItem value="in">inches</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Enter the exact dimension shown on the plan (e.g., 5.5m or 5500mm)
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  onClick={handleManualCalibrationComplete}
                  className="flex-1"
                  disabled={!manualDistance || parseFloat(manualDistance) <= 0}
                >
                  Apply
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
