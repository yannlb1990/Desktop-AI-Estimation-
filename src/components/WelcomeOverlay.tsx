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
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Cyan top line */}
        <div className="h-[2px] w-full bg-primary" />

        <div className="p-10 flex flex-col gap-8">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <MetricoreLogoMark height={28} />
            <span className="font-display text-lg font-bold tracking-tight">Metricore</span>
          </div>

          {/* Heading block */}
          <div className="space-y-3">
            <h1 className="font-display text-[2rem] font-bold leading-tight">
              {firstName ? `You're in, ${firstName}.` : "You're in."}
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              Upload a PDF plan and start measuring. Your {trialDays}-day trial gives you full access — no limits.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleStart}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold py-5 h-auto text-sm tracking-wide shadow-glow"
            >
              Upload your first plan
            </Button>
            <button
              type="button"
              onClick={onDismiss}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Skip for now
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default WelcomeOverlay;
