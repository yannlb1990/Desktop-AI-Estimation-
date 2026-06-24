import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Ruler, FileText, CheckCircle } from "lucide-react";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";

interface Props {
  firstName: string;
  trialDays: number;
  onDismiss: () => void;
}

const steps = [
  {
    icon: Upload,
    label: "Upload your plan",
    desc: "PDF plans, any scale",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Ruler,
    label: "Take measurements",
    desc: "Line, area, wall, count tools",
    color: "text-violet-400",
    bg: "bg-violet-400/10",
  },
  {
    icon: FileText,
    label: "Send your tender",
    desc: "PDF or Excel, one click",
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
];

const WelcomeOverlay = ({ firstName, trialDays, onDismiss }: Props) => {
  const navigate = useNavigate();

  const handleStart = () => {
    onDismiss();
    navigate("/project/new");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-cyan-400 to-primary/40" />

        <div className="p-8 space-y-7">

          {/* Logo + heading */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 mb-4">
              <MetricoreLogoMark height={32} />
              <span className="font-display text-xl font-bold">Metricore</span>
            </div>
            <h1 className="font-display text-3xl font-bold">
              Welcome{firstName ? `, ${firstName}` : ""}!
            </h1>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                Your {trialDays}-day free trial is now active
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Here's how to get your first estimate in minutes.
            </p>
          </div>

          {/* 3-step flow */}
          <div className="flex items-start gap-3">
            {steps.map((step, i) => (
              <div key={step.label} className="flex-1 flex flex-col items-center text-center gap-2 relative">
                <div className={`w-11 h-11 rounded-xl ${step.bg} flex items-center justify-center`}>
                  <step.icon className={`h-5 w-5 ${step.color}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground leading-tight">{step.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className="absolute top-3 -right-2 h-3.5 w-3.5 text-muted-foreground/40" />
                )}
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="space-y-3 pt-1">
            <Button
              onClick={handleStart}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-base py-6 h-auto font-semibold shadow-glow"
            >
              Upload Your First Plan
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <button
              type="button"
              onClick={onDismiss}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              I'll explore on my own
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default WelcomeOverlay;
