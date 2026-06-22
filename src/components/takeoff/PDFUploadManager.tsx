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
        const { blob: pngBlob, truncated } = await renderDxfToBlob(file);
        if (truncated) console.warn(`DXF truncated to ${50_000} entities for rendering`);
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

        toast.success(`Plan loaded: ${pageCount} page${pageCount > 1 ? 's' : ''}${cloudUrl ? ' · saved to cloud' : ''}`);
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
      <div className="border-2 border-dashed border-border rounded-xl transition-all hover:border-primary/50 hover:bg-primary/[0.03] group">
        <input
          type="file"
          id="pdf-upload"
          accept=".pdf,.png,.jpg,.jpeg,.dxf"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        <label htmlFor="pdf-upload" className="cursor-pointer block p-10">
          <div className="flex flex-col items-center gap-4">
            {uploading ? (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-7 w-7 text-primary animate-pulse" />
                </div>
                <p className="text-base font-semibold">Loading plan…</p>
                <p className="text-sm text-muted-foreground">
                  {uploadPct < 25 ? 'Reading file…' : uploadPct < 80 ? 'Saving to cloud…' : 'Almost done…'}
                </p>
                <Progress value={uploadPct} className="w-48" />
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Upload className="h-7 w-7 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold">Drop your plan here</p>
                  <p className="text-sm text-muted-foreground mt-0.5">or click to browse files</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {['PDF', 'PNG', 'JPG', 'DXF'].map(t => (
                    <span key={t} className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{t}</span>
                  ))}
                  <span className="text-[11px] text-muted-foreground/60">· up to 50MB</span>
                </div>
                <Button type="button" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Choose File
                </Button>
              </>
            )}
          </div>
        </label>
      </div>

      {cloudSaved === true && (
        <div className="flex items-center gap-3 rounded-lg border border-border border-l-2 border-l-accent bg-muted/30 px-4 py-3 text-sm">
          <Cloud className="h-4 w-4 shrink-0 text-accent" />
          <p className="text-muted-foreground">Plan saved to cloud — reloads automatically on every visit.</p>
        </div>
      )}

      {cloudSaved === false && (
        <div className="flex items-center gap-3 rounded-lg border border-border border-l-2 border-l-orange-400/60 bg-muted/30 px-4 py-3 text-sm">
          <CloudOff className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">Stored locally — re-upload if you clear browser data.</p>
        </div>
      )}

      {cloudSaved === null && !uploading && (
        <div className="flex items-center gap-3 rounded-lg border border-border border-l-2 border-l-primary/40 bg-muted/30 px-4 py-3 text-sm">
          <CloudOff className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">Plans save in your browser and restore automatically each visit.</p>
        </div>
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
