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
import { renderDxfToBlob } from '@/lib/takeoff/dxfRenderer';

interface PDFUploadManagerProps {
  projectId: string;
  onUploadComplete: (pdfFile: PDFFile) => void;
  onError: (error: string) => void;
}

/** Upload a blob/file to Supabase Storage and return its permanent public URL.
 *  Falls back gracefully if the bucket doesn't exist or the user is not signed in. */
async function uploadToCloud(
  blob: Blob,
  planId: string,
  ext: string,
  onProgress?: (pct: number) => void,
): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null; // not signed in — skip cloud upload

    const uid = session.user.id;
    const fileId = crypto.randomUUID();
    const path = `${uid}/${fileId}.${ext}`;

    onProgress?.(30);

    const { error } = await (supabase as any).storage
      .from('plan-pdfs')
      .upload(path, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' });

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
    const isDxf = file.name.toLowerCase().endsWith('.dxf');
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!isDxf && !validTypes.includes(file.type)) return 'File must be PDF, PNG, JPG, or DXF';
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

    const isDxf = file.name.toLowerCase().endsWith('.dxf');

    try {
      if (isDxf) {
        // ── DXF path ──────────────────────────────────────────────────────────
        setUploadPct(15);
        const { blob: pngBlob } = await renderDxfToBlob(file);
        setUploadPct(40);

        const planId = `${file.name}_${file.size}`;

        // Cache the rendered PNG bytes in IndexedDB so it survives navigation
        const pngBuffer = await pngBlob.arrayBuffer();
        await cachePDF(planId, pngBuffer, file.name, 1);
        setUploadPct(55);

        // Upload rendered PNG to Supabase (always .png regardless of .dxf source)
        const cloudUrl = await uploadToCloud(pngBlob, planId, 'png', setUploadPct);
        setCloudSaved(cloudUrl !== null);
        setUploadPct(90);

        if (currentBlobUrl.current) URL.revokeObjectURL(currentBlobUrl.current);
        const blobUrl = URL.createObjectURL(pngBlob);
        currentBlobUrl.current = blobUrl;
        const urlToUse = cloudUrl ?? blobUrl;

        toast.success(`DXF imported${cloudUrl ? ' · saved to cloud' : ''}`);
        savePlanToLibrary(projectId, { planId, filename: file.name, uploadedAt: new Date().toISOString(), pageCount: 1 });
        setUploadPct(100);
        currentBlobUrl.current = cloudUrl ? null : blobUrl;
        onUploadComplete({ file, url: urlToUse, name: file.name, pageCount: 1, planId });

      } else {
        // ── PDF / image path ──────────────────────────────────────────────────
        const arrayBuffer = await file.arrayBuffer();
        setUploadPct(15);

        let pageCount = 1;
        if (file.type === 'application/pdf') {
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
          pageCount = pdf.numPages;
        }

        const planId = `${file.name}_${file.size}`;
        await cachePDF(planId, arrayBuffer, file.name, pageCount);
        setUploadPct(25);

        const ext = file.name.split('.').pop() ?? 'pdf';
        const cloudUrl = await uploadToCloud(file, planId, ext, setUploadPct);
        setCloudSaved(cloudUrl !== null);
        setUploadPct(90);

        if (currentBlobUrl.current) URL.revokeObjectURL(currentBlobUrl.current);
        const blobUrl = URL.createObjectURL(file);
        currentBlobUrl.current = blobUrl;
        const urlToUse = cloudUrl ?? blobUrl;

        toast.success(`Plan loaded — ${pageCount} page${pageCount > 1 ? 's' : ''}${cloudUrl ? ' · saved to cloud' : ''}`);
        savePlanToLibrary(projectId, { planId, filename: file.name, uploadedAt: new Date().toISOString(), pageCount });
        setUploadPct(100);
        currentBlobUrl.current = cloudUrl ? null : blobUrl;
        onUploadComplete({ file, url: urlToUse, name: file.name, pageCount, planId });
      }
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
          accept=".pdf,.png,.jpg,.jpeg,.dxf"
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
                  <p className="text-lg font-medium">Upload Plan</p>
                  <p className="text-sm text-muted-foreground mt-1">PDF, PNG, JPG, or DXF up to 50MB</p>
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
