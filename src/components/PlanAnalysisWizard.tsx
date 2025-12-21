import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Upload, Eye, Ruler, Square, Scan, FileText, Calculator } from "lucide-react";
import { PlanViewer } from "./PlanViewer";
import { FixturesSummary } from "./FixturesSummary";

interface PlanAnalysisWizardProps {
  projectId: string;
  planUrl: string;
}

type Step = "upload" | "preview" | "scale" | "measure" | "detect" | "extract" | "review";

const STEPS: { id: Step; label: string; icon: any; description: string }[] = [
  { id: "upload", label: "Upload", icon: Upload, description: "Upload & validate plan file" },
  { id: "preview", label: "Preview", icon: Eye, description: "Preview & select page" },
  { id: "scale", label: "Set Scale", icon: Ruler, description: "Calibrate drawing scale" },
  { id: "measure", label: "Measure", icon: Square, description: "Measure areas & dimensions" },
  { id: "detect", label: "Detect", icon: Scan, description: "AI symbol detection" },
  { id: "extract", label: "Extract", icon: FileText, description: "Extract schedules" },
  { id: "review", label: "Review", icon: Calculator, description: "Review & generate quantities" },
];

export const PlanAnalysisWizard = ({ projectId, planUrl }: PlanAnalysisWizardProps) => {
  const [currentStep, setCurrentStep] = useState<Step>("preview");
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set(["upload"]));

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progress = ((completedSteps.size) / STEPS.length) * 100;

  const handleStepComplete = (step: Step) => {
    setCompletedSteps(prev => new Set([...prev, step]));
    const nextIndex = STEPS.findIndex(s => s.id === step) + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const isStepCompleted = (step: Step) => completedSteps.has(step);
  const isStepCurrent = (step: Step) => currentStep === step;
  const isStepAccessible = (step: Step) => {
    const stepIndex = STEPS.findIndex(s => s.id === step);
    const prevStep = STEPS[stepIndex - 1];
    return stepIndex === 0 || (prevStep && isStepCompleted(prevStep.id));
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Plan Analysis Workflow</h2>
            <Badge variant="secondary" className="text-sm">
              Step {currentStepIndex + 1} of {STEPS.length}
            </Badge>
          </div>
          
          <Progress value={progress} className="h-2" />
          
          {/* Step Navigation */}
          <div className="grid grid-cols-7 gap-2">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const completed = isStepCompleted(step.id);
              const current = isStepCurrent(step.id);
              const accessible = isStepAccessible(step.id);
              
              return (
                <button
                  key={step.id}
                  onClick={() => accessible && setCurrentStep(step.id)}
                  disabled={!accessible}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                    current
                      ? "border-primary bg-primary/5 shadow-sm"
                      : completed
                      ? "border-accent/30 bg-accent/5"
                      : "border-border bg-muted/30 opacity-50"
                  } ${accessible ? "cursor-pointer hover:shadow-md" : "cursor-not-allowed"}`}
                >
                  <div className={`relative ${
                    current ? "text-primary" : completed ? "text-accent" : "text-muted-foreground"
                  }`}>
                    <StepIcon className="h-5 w-5" />
                    {completed && (
                      <CheckCircle2 className="h-3 w-3 text-accent absolute -top-1 -right-1 bg-background rounded-full" />
                    )}
                  </div>
                  <div className="text-xs font-medium text-center">{step.label}</div>
                </button>
              );
            })}
          </div>

          {/* Current Step Description */}
          <div className="bg-muted/50 p-4 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Circle className="h-4 w-4 text-primary fill-primary" />
              <span className="font-semibold">Current Step:</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {STEPS[currentStepIndex].description}
            </p>
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      <Card className="p-6">
        {currentStep === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">Preview Plan</h3>
              <Button onClick={() => handleStepComplete("preview")}>
                Continue to Scale Setup →
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Review your uploaded plan. Zoom and pan to inspect details before proceeding.
            </p>
            <div className="border border-border rounded-lg overflow-hidden">
              <PlanViewer 
                key="preview-step"
                planUrl={planUrl} 
                projectId={projectId}
                wizardMode={true}
                currentTool="plan"
              />
            </div>
          </div>
        )}

        {currentStep === "scale" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">Set Drawing Scale</h3>
              <Button onClick={() => handleStepComplete("scale")}>
                Continue to Measurements →
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Click two points on a known dimension (e.g., a wall marked as 5000mm), then enter the real-world distance.
            </p>
            <div className="border border-border rounded-lg overflow-hidden">
              <PlanViewer 
                key="scale-step"
                planUrl={planUrl} 
                projectId={projectId}
                wizardMode={true}
                currentTool="calibrate"
              />
            </div>
          </div>
        )}

        {currentStep === "measure" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">Measure Areas</h3>
              <Button onClick={() => handleStepComplete("measure")}>
                Continue to Symbol Detection →
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Draw polygons around rooms to calculate floor areas in m². Click corners, then click near the start point to close.
            </p>
            <div className="border border-border rounded-lg overflow-hidden">
              <PlanViewer 
                key="measure-step"
                planUrl={planUrl} 
                projectId={projectId}
                wizardMode={true}
                currentTool="measure-m2"
              />
            </div>
          </div>
        )}

        {currentStep === "detect" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">AI Symbol Detection</h3>
              <Button onClick={() => handleStepComplete("detect")}>
                Continue to Schedule Extraction →
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              AI will detect doors, windows, and plumbing fixtures with bounding boxes and confidence scores.
            </p>
            <div className="border border-border rounded-lg overflow-hidden">
              <PlanViewer 
                key="detect-step"
                planUrl={planUrl} 
                projectId={projectId}
                wizardMode={true}
                currentTool="detect"
              />
            </div>
          </div>
        )}

        {currentStep === "extract" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">Extract Door/Window Schedules</h3>
              <Button onClick={() => handleStepComplete("extract")}>
                Continue to Review →
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              AI will extract door and window schedule tables with IDs, dimensions, and materials.
            </p>
            <div className="border border-border rounded-lg overflow-hidden">
              <PlanViewer 
                key="extract-step"
                planUrl={planUrl} 
                projectId={projectId}
                wizardMode={true}
                currentTool="extract"
              />
            </div>
          </div>
        )}

        {currentStep === "review" && (
          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Analysis Complete</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Review the detected fixtures and openings below. This data can be used to generate estimate items.
              </p>
              <Button className="w-full">
                <Calculator className="mr-2 h-5 w-5" />
                Generate Estimate Items from Analysis
              </Button>
            </Card>
            
            <FixturesSummary projectId={projectId} />
          </div>
        )}
      </Card>
    </div>
  );
};
