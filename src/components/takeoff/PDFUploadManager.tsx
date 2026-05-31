import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertCircle, Cloud, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { PDFFile } from '@/lib/takeoff/types';
import { savePlanToLibrary } from '@/components/DocumentLibrary';
import { cachePDF } from '@/lib/takeoff/pdfCache';
import { supabase } from '@/integrations/supabase/client';

interface PDFUploadManagerProps {
  projectId: string;
  onUploadComplete: (pdfFile: PDFFile) => void;
  onError: (error: string) => void;
}

/** Upload a PDF/image to Supabase Storage and return its permanent public URL.
 *  Falls back gracefully if the bucket doesn't exist or the user is not signed in. */
async function uploadToCloud(
  file: File,
  planId: string,
  onProgress?: (pct: number) => void,
): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null; // not signed in — skip cloud upload

    const uid = session.user.id;
    const ext = file.name.split('.').pop() ?? 'pdf';
    const path = `${uid}/${planId}.${ext}`;

    // Report ~30% while uploading
    onProgress?.(30);

    const { error } = await (supabase as any).storage
      .from('plan-pdfs')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) {
      console.warn('[PDFUpload] Supabase Storage upload failed:', error.message);
      return null;
    }

    onProgress?.(80);

    const { data } = (supabase as any).storage.from('plan-pdfs').getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (err) {
    console.warn('[PDFUpload] Cloud upload error:', err);
    return null;
  }
}

export const PDFUploadManager = ({ projectId, onUploadComplete, onError }: PDFUploadManagerProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [cloudSaved, setCloudSaved] = useState<boolean | null>(null); // null = not tried yet
  const [validationError, setValidationError] = useState<string | null>(null);
  const currentBlobUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (currentBlobUrl.current) URL.revokeObjectURL(currentBlobUrl.current);
    };
  }, []);

  const validateFile = (file: File): string | null => {
    if (file.size > 50 * 1024 * 1024) return 'File size must be less than 50MB';
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) return 'File must be PDF, PNG, or JPG';
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidationError(null);
    setCloudSaved(null);

    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      onError(error);
      return;
    }

    setUploading(true);
    setUploadPct(5);

    try {
      // Read once — reuse for pdfjs page count + IndexedDB cache + cloud upload
      const arrayBuffer = await file.arrayBuffer();
      setUploadPct(15);

      let pageCount = 1;
      if (file.type === 'application/pdf') {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
        pageCount = pdf.numPages;
      }

      // Stable identifier: name + byte size
      const planId = `${file.name}_${file.size}`;

      // 1. Persist to IndexedDB (instant local restore after navigation)
      await cachePDF(planId, arrayBuffer, file.name, pageCount);
      setUploadPct(25);

      // 2. Upload to Supabase Storage for permanent cross-session URL
      const cloudUrl = await uploadToCloud(file, planId, setUploadPct);
      setCloudSaved(cloudUrl !== null);
      setUploadPct(90);

      // 3. Create blob URL for immediate display (no latency)
      if (currentBlobUrl.current) URL.revokeObjectURL(currentBlobUrl.current);
      const blobUrl = URL.createObjectURL(file);
      currentBlobUrl.current = blobUrl;

      // Use the permanent cloud URL if available — survives page refresh forever.
      // Fall back to blob URL for the current session only.
      const urlToUse = cloudUrl ?? blobUrl;

      toast.success(`Plan loaded — ${pageCount} page${pageCount > 1 ? 's' : ''}${cloudUrl ? ' · saved to cloud' : ''}`);

      savePlanToLibrary(projectId, {
        planId,
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        pageCount,
      });

      setUploadPct(100);
      currentBlobUrl.current = cloudUrl ? null : blobUrl; // cloud owns the URL now
      onUploadComplete({ file, url: urlToUse, name: file.name, pageCount, planId });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setValidationError(errorMsg);
      onError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setUploading(false);
      setUploadPct(0);
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
                <p className="text-lg font-medium">Loading plan…</p>
                <p className="text-sm text-muted-foreground">
                  {uploadPct < 25 ? 'Reading file…' : uploadPct < 80 ? 'Saving to cloud…' : 'Almost done…'}
                </p>
                <Progress value={uploadPct} className="w-48" />
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 text-muted-foreground" />
                <div>
                  <p className="text-lg font-medium">Upload PDF or Image</p>
                  <p className="text-sm text-muted-foreground mt-1">PDF, PNG, or JPG up to 50MB</p>
                </div>
                <Button type="button" variant="secondary">Choose File</Button>
              </>
            )}
          </div>
        </label>
      </div>

      {cloudSaved === true && (
        <Alert className="border-green-200 bg-green-50">
          <Cloud className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            Plan saved to cloud — it will reload automatically after any page refresh.
          </AlertDescription>
        </Alert>
      )}

      {cloudSaved === false && (
        <Alert className="border-amber-200 bg-amber-50">
          <CloudOff className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            Plan stored locally only — you may need to re-upload after clearing browser data.
          </AlertDescription>
        </Alert>
      )}

      {cloudSaved === null && !uploading && (
        <Alert className="border-amber-200 bg-amber-50">
          <CloudOff className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            Plans are stored locally in your browser. Your PDF and all measurements will be restored automatically when you return to this project.
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
