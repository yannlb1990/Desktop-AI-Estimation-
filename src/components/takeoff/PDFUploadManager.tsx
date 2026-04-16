import { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { PDFFile } from '@/lib/takeoff/types';
import { supabase } from '@/integrations/supabase/client';

interface PDFUploadManagerProps {
  projectId: string;
  onUploadComplete: (pdfFile: PDFFile) => void;
  onError: (error: string) => void;
}

export const PDFUploadManager = ({ projectId, onUploadComplete, onError }: PDFUploadManagerProps) => {
  const [uploading, setUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'cloud' | 'local' | null>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > 50 * 1024 * 1024) return 'File size must be less than 50MB';
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) return 'File must be PDF, PNG, or JPG';
    return null;
  };

  const getPageCount = async (file: File): Promise<number> => {
    if (file.type !== 'application/pdf') return 1;
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  };

  const uploadToSupabase = async (file: File): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${user.id}/${projectId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('plans')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        // Bucket may not exist yet — try creating it or fall back
        console.warn('Supabase storage upload failed:', uploadError.message);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage.from('plans').getPublicUrl(path);

      // Save URL back to project record
      await supabase
        .from('projects')
        .update({ plan_file_url: publicUrl, plan_file_name: file.name } as any)
        .eq('id', projectId);

      return publicUrl;
    } catch (err) {
      console.warn('Supabase upload error:', err);
      return null;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidationError(null);
    setUploadMode(null);

    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      onError(error);
      return;
    }

    setUploading(true);

    try {
      const pageCount = await getPageCount(file);

      // Try Supabase Storage first
      const cloudUrl = await uploadToSupabase(file);

      let finalUrl: string;
      if (cloudUrl) {
        finalUrl = cloudUrl;
        setUploadMode('cloud');
        toast.success(`Uploaded to cloud — ${pageCount} page${pageCount > 1 ? 's' : ''}`);
      } else {
        // Fall back to local blob URL for this session
        finalUrl = URL.createObjectURL(file);
        setUploadMode('local');
        toast.warning('Saved locally for this session only — cloud upload unavailable');
      }

      const pdfFile: PDFFile = {
        file,
        url: finalUrl,
        name: file.name,
        pageCount,
      };

      onUploadComplete(pdfFile);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setValidationError(errorMsg);
      onError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-secondary/50 transition-colors">
        <input
          type="file"
          id="pdf-upload"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        <label htmlFor="pdf-upload" className="cursor-pointer">
          <div className="flex flex-col items-center gap-4">
            {uploading ? (
              <>
                <FileText className="h-12 w-12 text-muted-foreground animate-pulse" />
                <p className="text-lg font-medium">Uploading to cloud…</p>
                <p className="text-sm text-muted-foreground">Reading pages and saving your plan</p>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 text-muted-foreground" />
                <div>
                  <p className="text-lg font-medium">Upload PDF or Image</p>
                  <p className="text-sm text-muted-foreground mt-1">PDF, PNG, or JPG up to 50MB</p>
                  <p className="text-xs text-muted-foreground mt-1">Plans are saved to the cloud and restored automatically</p>
                </div>
                <Button type="button" variant="secondary">Choose File</Button>
              </>
            )}
          </div>
        </label>
      </div>

      {uploadMode === 'cloud' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            Plan saved to cloud — your measurements and scale will be restored automatically next time you open this project.
          </AlertDescription>
        </Alert>
      )}

      {uploadMode === 'local' && (
        <Alert className="border-amber-200 bg-amber-50">
          <CloudOff className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            Plan loaded locally for this session. To enable cloud storage, create a <strong>plans</strong> bucket in your Supabase Storage dashboard with public read access. Your measurements are still saved locally.
          </AlertDescription>
        </Alert>
      )}

      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
