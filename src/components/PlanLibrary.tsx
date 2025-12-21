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
import { supabase } from "@/integrations/supabase/client";
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

export const PlanLibrary = ({ projectId, onOpenPlan }: PlanLibraryProps) => {
  const [plans, setPlans] = useState<PlanPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDiscipline, setUploadDiscipline] = useState<string>("unknown");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadPlans();
  }, [projectId]);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch plans with measurement counts
      const { data: planData, error } = await supabase
        .from('plan_pages')
        .select(`
          id,
          file_url,
          original_filename,
          discipline,
          scale_factor,
          created_at,
          project_id
        `)
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get measurement counts for each plan
      const plansWithCounts = await Promise.all(
        (planData || []).map(async (plan) => {
          const { count } = await supabase
            .from('plan_measurements')
            .select('*', { count: 'exact', head: true })
            .eq('plan_page_id', plan.id);
          
          return {
            ...plan,
            measurement_count: count || 0
          };
        })
      );

      setPlans(plansWithCounts);
    } catch (error) {
      console.error('Error loading plans:', error);
      toast.error("Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload to storage with user ID prefix for RLS
      const fileName = `${user.id}/${Date.now()}_${uploadFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('plans')
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('plans')
        .getPublicUrl(fileName);

      // Create plan_page record
      const { error: insertError } = await supabase
        .from('plan_pages')
        .insert({
          user_id: user.id,
          project_id: projectId,
          file_url: publicUrl,
          original_filename: uploadFile.name,
          discipline: uploadDiscipline,
          status: 'uploaded'
        });

      if (insertError) throw insertError;

      toast.success("Plan uploaded successfully");
      setShowUploadDialog(false);
      setUploadFile(null);
      loadPlans();
    } catch (error) {
      console.error('Error uploading plan:', error);
      toast.error("Failed to upload plan");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (planId: string) => {
    try {
      const { error } = await supabase
        .from('plan_pages')
        .delete()
        .eq('id', planId);

      if (error) throw error;

      toast.success("Plan deleted");
      loadPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error("Failed to delete plan");
    }
  };

  const getScaleDisplay = (scaleFactor: number | null) => {
    if (!scaleFactor) return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Not set</Badge>;
    // scaleFactor is in mm per canvas unit, so 1000/scaleFactor gives proper ratio
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
