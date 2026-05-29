import { Ruler, CheckCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScaleData } from '@/lib/takeoff/types';

interface ScalingCalibratorProps {
  currentScale: ScaleData | null;
  isCalibrated: boolean;
  onManualCalibrationStart: () => void;
  onResetScale?: () => void;
  onStartVerify?: () => void;
}

export const ScalingCalibrator = ({
  currentScale,
  isCalibrated,
  onManualCalibrationStart,
  onResetScale,
  onStartVerify,
}: ScalingCalibratorProps) => {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Ruler className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Scale Calibration</h3>
        {isCalibrated && onResetScale && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-auto"
            onClick={onResetScale}
            title="Reset calibration"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isCalibrated && currentScale ? (
        <div className="bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 p-3 rounded-lg space-y-1.5">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              {currentScale.scaleFactor ? `1:${currentScale.scaleFactor}` : 'Manual'} — active
            </p>
          </div>
          <p className="text-xs text-green-700 dark:text-green-300 pl-6">
            {currentScale.unitsPerMetre.toFixed(2)} PDF units / metre
          </p>
          {onStartVerify && currentScale.scaleMethod === 'preset' && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs mt-1 border-green-600 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900"
              onClick={onStartVerify}
            >
              <Ruler className="h-3 w-3 mr-1.5" />
              Verify on drawing
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-3 rounded-lg">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Measurements show in PDF units until you calibrate.
          </p>
        </div>
      )}

      <Button
        onClick={onManualCalibrationStart}
        className="w-full"
        variant={isCalibrated ? 'outline' : 'default'}
      >
        <Ruler className="h-4 w-4 mr-2" />
        {isCalibrated ? 'Re-calibrate' : 'Calibrate'}
      </Button>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Draw a line over any known dimension on the plan, then enter its real length.
      </p>
    </div>
  );
};
