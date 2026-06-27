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
        <div className="bg-muted/10 dark:bg-card/50 border border-border/35 dark:border-border/45 p-3 rounded-lg space-y-1.5">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-[#E1DCC9]/80 shrink-0" />
            <p className="text-sm font-medium text-foreground/80 dark:text-foreground/80">
              {currentScale.scaleFactor ? `1:${currentScale.scaleFactor}` : 'Manual'} — active
            </p>
          </div>
          <p className="text-xs text-[#E1DCC9]/60 dark:text-[#E1DCC9]/70 pl-6">
            {currentScale.unitsPerMetre.toFixed(2)} PDF units / metre
          </p>
          {onStartVerify && currentScale.scaleMethod === 'preset' && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs mt-1 border-[#E1DCC9]/35 text-[#E1DCC9]/60 dark:text-[#E1DCC9]/70 hover:bg-muted/20 dark:hover:bg-card"
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
