import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";

interface Props {
  firstName: string;
  trialDays: number;
  onDismiss: () => void;
}

const WelcomeOverlay = ({ firstName, trialDays, onDismiss }: Props) => {
  const navigate = useNavigate();

  const handleStart = () => {
    onDismiss();
    navigate("/project/new");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-8 flex flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <MetricoreLogoMark height={24} />
          <span className="font-display text-base font-bold tracking-tight">Metricore</span>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-2xl font-bold leading-tight">
            {firstName ? `Welcome, ${firstName}` : "Welcome to Metricore"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Start with a plan. Upload the PDF, set the scale, then measure walls, floors and roofs.
            Everything you measure goes into the estimate, and the quote is built from that.
          </p>
          {trialDays > 0 && (
            <p className="text-sm text-muted-foreground">
              Your trial has {trialDays} {trialDays === 1 ? "day" : "days"} left.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleStart} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            Upload a plan
          </Button>
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeOverlay;
