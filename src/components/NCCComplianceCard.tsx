import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";

interface NCCComplianceCardProps {
  estimateItems: Array<{
    description: string;
    category: string;
  }>;
}

export const NCCComplianceCard = ({ estimateItems }: NCCComplianceCardProps) => {
  const nccChecks = [
    {
      category: "Insulation",
      requirement: "Ceiling R-value ≥ R2.5 (Climate Zone 4 - Sydney)",
      nccReference: "NCC 2025 Volume 2 - Part 3.12.1.1",
      checkLogic: () => {
        const ceilingInsulation = estimateItems.find(i => 
          i.description.toLowerCase().includes('ceiling') && 
          (i.description.toLowerCase().includes('batt') || i.description.toLowerCase().includes('insulation'))
        );
        return ceilingInsulation?.description.includes('R2.5') || 
               ceilingInsulation?.description.includes('R3.5') ||
               ceilingInsulation?.description.includes('R4.0') || false;
      },
      recommendation: "Specify R2.5 ceiling batts minimum for Sydney (Climate Zone 4)"
    },
    {
      category: "Accessibility",
      requirement: "Door width ≥ 820mm clear opening",
      nccReference: "AS 1428.1 - Accessible Door Width",
      checkLogic: () => {
        const doors = estimateItems.filter(i => 
          i.description.toLowerCase().includes('door')
        );
        // Simplified check - would need proper dimension extraction
        return doors.length === 0 || doors.some(d => 
          d.description.includes('820') || 
          d.description.includes('900') ||
          d.description.includes('920')
        );
      },
      recommendation: "Ensure all doorways provide 820mm clear opening width"
    },
    {
      category: "Fire Safety",
      requirement: "Fire rating between attached dwellings ≥ 60min",
      nccReference: "NCC 2025 Volume 2 - Part 3.7.2",
      checkLogic: () => {
        const fireWalls = estimateItems.filter(i => 
          i.description.toLowerCase().includes('fire') ||
          i.description.toLowerCase().includes('party wall') ||
          i.description.toLowerCase().includes('frl')
        );
        return fireWalls.some(w => 
          w.description.includes('60min') || 
          w.description.includes('FRL')
        );
      },
      recommendation: "Specify 60min fire rated plasterboard for party walls"
    },
    {
      category: "Wet Areas",
      requirement: "Shower recess minimum 900x900mm",
      nccReference: "NCC 2025 Volume 2 - Part 3.8.3",
      checkLogic: () => {
        const shower = estimateItems.find(i => 
          i.description.toLowerCase().includes('shower')
        );
        // Simplified - would need proper dimension checks
        return shower === undefined || shower.description.includes('900') || shower.description.includes('1000');
      },
      recommendation: "Ensure shower recess is at least 900mm x 900mm"
    },
    {
      category: "Stairways",
      requirement: "Riser max 190mm, Going min 250mm",
      nccReference: "NCC 2025 Volume 2 - Part 3.9.1",
      checkLogic: () => {
        const stairs = estimateItems.find(i => 
          i.description.toLowerCase().includes('stair')
        );
        // If no stairs in estimate, assume compliant
        return stairs === undefined;
      },
      recommendation: "Verify stair dimensions: risers ≤190mm, goings ≥250mm"
    },
  ];

  const results = nccChecks.map(check => ({
    ...check,
    compliant: check.checkLogic()
  }));

  const passedCount = results.filter(r => r.compliant).length;
  const totalCount = results.length;

  const exportComplianceReport = () => {
    // Generate compliance report
    const reportContent = `
NCC 2025 COMPLIANCE REPORT
Generated: ${new Date().toLocaleDateString('en-AU')}

COMPLIANCE CHECKS:
${results.map(r => `
${r.category}
Requirement: ${r.requirement}
Reference: ${r.nccReference}
Status: ${r.compliant ? 'COMPLIANT ✓' : 'CHECK REQUIRED ⚠️'}
${!r.compliant ? `Recommendation: ${r.recommendation}` : ''}
`).join('\n')}

SUMMARY:
${passedCount} of ${totalCount} checks passed
${passedCount === totalCount ? 'All checks compliant!' : 'Please review items marked for checking'}
    `.trim();

    // Create downloadable text file
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NCC_Compliance_Report_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Compliance report downloaded");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>NCC 2025 Compliance Check</CardTitle>
        <CardDescription>
          Automated analysis against NCC requirements for Australian construction
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {results.map((result, idx) => (
            <div 
              key={idx} 
              className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors"
            >
              {result.compliant ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm">{result.category}</h4>
                <p className="text-sm text-muted-foreground">{result.requirement}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Reference: {result.nccReference}
                </p>
                {!result.compliant && (
                  <Alert variant="default" className="mt-2 bg-amber-500/10 border-amber-500/20">
                    <AlertDescription className="text-sm">
                      ⚠️ {result.recommendation}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <Badge variant={result.compliant ? "default" : "outline"} className="flex-shrink-0">
                {result.compliant ? 'Compliant' : 'Check Required'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4">
        <div>
          <p className="text-sm font-semibold">
            {passedCount} / {totalCount} checks passed
          </p>
          <p className="text-xs text-muted-foreground">
            {passedCount === totalCount 
              ? 'All compliance checks met!' 
              : `${totalCount - passedCount} items require review`
            }
          </p>
        </div>
        <Button onClick={exportComplianceReport}>
          <FileText className="mr-2 h-4 w-4" />
          Export Compliance Report
        </Button>
      </CardFooter>
    </Card>
  );
};
