import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUp, Eye, Trash2, Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface PlanPage {
  id: string;
  file_url: string;
  original_filename: string | null;
  discipline: string | null;
  scale_factor: number | null;
  created_at: string;
  project_id: string | null;
  measurement_count?: number;
}

interface PlanLibraryProps {
  projectId: string;
  onOpenPlan: (planUrl: string, planPageId: string) => void;
}

function storageKey(projectId: string) {
  return `local_plan_pages_${projectId}`;
}

function loadPlansFromStorage(projectId: string): PlanPage[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(projectId)) || "[]");
  } catch {
    return [];
  }
}

function savePlansToStorage(projectId: string, plans: PlanPage[]) {
  localStorage.setItem(storageKey(projectId), JSON.stringify(plans));
}

export const PlanLibrary = ({ projectId, onOpenPlan }: PlanLibraryProps) => {
  const [plans, setPlans] = useState<PlanPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDiscipline, setUploadDiscipline] = useState<string>("unknown");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setPlans(loadPlansFromStorage(projectId));
    setLoading(false);
  }, [projectId]);

  const handleUpload = () => {
    if (!uploadFile) return;

    setUploading(true);
    try {
      const blobUrl = URL.createObjectURL(uploadFile);
      const newPlan: PlanPage = {
        id: crypto.randomUUID(),
        file_url: blobUrl,
        original_filename: uploadFile.name,
        discipline: uploadDiscipline,
        scale_factor: null,
        created_at: new Date().toISOString(),
        project_id: projectId,
        measurement_count: 0,
      };

      const updated = [newPlan, ...loadPlansFromStorage(projectId)];
      savePlansToStorage(projectId, updated);
      setPlans(updated);

      toast.success("Plan uploaded successfully");
      setShowUploadDialog(false);
      setUploadFile(null);
    } catch (error) {
      console.error('Error uploading plan:', error);
      toast.error("Failed to upload plan");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (planId: string) => {
    const updated = loadPlansFromStorage(projectId).filter(p => p.id !== planId);
    savePlansToStorage(projectId, updated);
    setPlans(updated);
    toast.success("Plan deleted");
  };

  const getScaleDisplay = (scaleFactor: number | null) => {
    if (!scaleFactor) return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Not set</Badge>;
    const ratio = Math.round(1000 / scaleFactor);
    return <Badge variant="secondary">1:{ratio}</Badge>;
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Plan Library</h3>
          </div>
          <Button onClick={() => setShowUploadDialog(true)} size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload Plan
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading plans...</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No plans uploaded yet</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => setShowUploadDialog(true)}
            >
              Upload Your First Plan
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Discipline</TableHead>
                <TableHead>Scale</TableHead>
                <TableHead>Measurements</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">
                    {plan.original_filename || 'Untitled Plan'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {plan.discipline || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>{getScaleDisplay(plan.scale_factor)}</TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {plan.measurement_count} measurement{plan.measurement_count !== 1 ? 's' : ''}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenPlan(plan.file_url, plan.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Open
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(plan.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload New Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Plan File (PDF, JPG, PNG)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="mt-2"
              />
              {uploadFile && (
                <p className="text-sm text-muted-foreground mt-1">
                  Selected: {uploadFile.name}
                </p>
              )}
            </div>
            <div>
              <Label>Discipline</Label>
              <Select value={uploadDiscipline} onValueChange={setUploadDiscipline}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="architectural">Architectural</SelectItem>
                  <SelectItem value="structural">Structural</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="hydraulic">Hydraulic/Plumbing</SelectItem>
                  <SelectItem value="mechanical">Mechanical</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
