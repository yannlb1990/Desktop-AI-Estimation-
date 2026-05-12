import { useState, useEffect } from "react";
import * as pdfjs from "pdfjs-dist";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { AlertCircle, DoorOpen, Droplets, ShowerHead } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription } from "./ui/alert";
import {
  extractOpeningsAllPages,
  extractTextFromPDF,
  countSymbolReferences,
} from "@/lib/takeoff/pdfTextExtractor";

interface FixturesSummaryProps {
  projectId?: string;
  pdfUrl?: string;
}

interface DoorSummary {
  schedule_id: string | null;
  type: string;
  count: number;
  width_mm: number | null;
  height_mm: number | null;
}

interface WindowSummary {
  schedule_id: string | null;
  type: string;
  count: number;
  width_mm: number | null;
  height_mm: number | null;
}

interface FixtureCounts {
  toilet: number;
  basin: number;
  shower: number;
  sink: number;
}

interface Summary {
  doors: DoorSummary[];
  windows: WindowSummary[];
  fixtures: FixtureCounts;
  issues: string[];
}

export const FixturesSummary = ({ pdfUrl }: FixturesSummaryProps) => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSummary();
  }, [pdfUrl]);

  const loadSummary = async () => {
    if (!pdfUrl) {
      setSummary(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const pdf = await pdfjs.getDocument(pdfUrl).promise;
      const pageCount = pdf.numPages;

      const openings = await extractOpeningsAllPages(pdfUrl, pageCount);

      const fixtures: FixtureCounts = { toilet: 0, basin: 0, shower: 0, sink: 0 };
      for (let p = 0; p < pageCount; p++) {
        const texts = await extractTextFromPDF(pdfUrl, p);
        const refs = countSymbolReferences(texts);
        fixtures.toilet += refs.toilets || 0;
        fixtures.basin += refs.basins || 0;
        fixtures.shower += refs.showers || 0;
      }

      const doors: DoorSummary[] = openings
        .filter(o => o.type === "door")
        .map(o => ({
          schedule_id: o.ref,
          type: "Door",
          count: 1,
          width_mm: o.width ?? null,
          height_mm: o.height ?? null,
        }));

      const windows: WindowSummary[] = openings
        .filter(o => o.type === "window")
        .map(o => ({
          schedule_id: o.ref,
          type: "Window",
          count: 1,
          width_mm: o.width ?? null,
          height_mm: o.height ?? null,
        }));

      const issues: string[] = [];
      const noDims = openings.filter(o => !o.width && !o.height);
      if (noDims.length > 0) {
        issues.push(`${noDims.length} opening(s) detected without dimensions`);
      }

      setSummary({ doors, windows, fixtures, issues });
    } catch (error) {
      console.error("Error loading fixtures summary:", error);
      toast.error("Failed to detect fixtures");
    } finally {
      setLoading(false);
    }
  };

  if (!pdfUrl) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Upload a plan to detect fixtures and openings.</p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">No fixture data available. Run symbol detection first.</p>
      </Card>
    );
  }

  const totalDoors = summary.doors.reduce((sum, d) => sum + d.count, 0);
  const totalWindows = summary.windows.reduce((sum, w) => sum + w.count, 0);
  const totalFixtures = Object.values(summary.fixtures).reduce((sum, count) => sum + count, 0);

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Fixtures & Openings Summary</h3>

          {summary.issues.length > 0 && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {summary.issues.map((issue, idx) => (
                    <li key={idx} className="text-sm">{issue}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {summary.doors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <DoorOpen className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Doors ({totalDoors} total)</h4>
            </div>
            <div className="space-y-2">
              {summary.doors.map((door, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant={door.schedule_id ? "default" : "secondary"}>
                      {door.schedule_id || "Unscheduled"}
                    </Badge>
                    <span className="text-sm">
                      {door.width_mm && door.height_mm
                        ? `${door.width_mm}mm × ${door.height_mm}mm`
                        : "No dimensions"}
                    </span>
                  </div>
                  <Badge variant="outline">{door.count} ea</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {summary.windows.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-5 w-5 text-primary">▢</div>
              <h4 className="font-medium">Windows ({totalWindows} total)</h4>
            </div>
            <div className="space-y-2">
              {summary.windows.map((window, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant={window.schedule_id ? "default" : "secondary"}>
                      {window.schedule_id || "Unscheduled"}
                    </Badge>
                    <span className="text-sm">
                      {window.width_mm && window.height_mm
                        ? `${window.width_mm}mm × ${window.height_mm}mm`
                        : "No dimensions"}
                    </span>
                  </div>
                  <Badge variant="outline">{window.count} ea</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalFixtures > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Droplets className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Plumbing Fixtures ({totalFixtures} total)</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {summary.fixtures.toilet > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <div className="text-2xl mb-1">🚽</div>
                  <div className="text-sm font-medium">{summary.fixtures.toilet} Toilets</div>
                </div>
              )}
              {summary.fixtures.basin > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <div className="text-2xl mb-1">🚰</div>
                  <div className="text-sm font-medium">{summary.fixtures.basin} Basins</div>
                </div>
              )}
              {summary.fixtures.shower > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <ShowerHead className="h-6 w-6 mx-auto mb-1" />
                  <div className="text-sm font-medium">{summary.fixtures.shower} Showers</div>
                </div>
              )}
            </div>
          </div>
        )}

        {summary.doors.length === 0 && summary.windows.length === 0 && totalFixtures === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No symbols detected. Check the plan has text-based W/D tags or a window/door schedule.
          </div>
        )}
      </div>
    </Card>
  );
};
