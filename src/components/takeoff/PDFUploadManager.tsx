import { useState } from 'react';
import { Upload, FileText, AlertCircle, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { PDFFile } from '@/lib/takeoff/types';

interface PDFUploadManagerProps {
  projectId: string;
  onUploadComplete: (pdfFile: PDFFile) => void;
  onError: (error: string) => void;
}

export const PDFUploadManager = ({ projectId, onUploadComplete, onError }: PDFUploadManagerProps) => {
  const [uploading, setUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidationError(null);

    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      onError(error);
      return;
    }

    setUploading(true);

    try {
      const pageCount = await getPageCount(file);
      const url = URL.createObjectURL(file);

      toast.success(`Plan loaded — ${pageCount} page${pageCount > 1 ? 's' : ''}`);

      onUploadComplete({ file, url, name: file.name, pageCount });
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
                <p className="text-lg font-medium">Loading plan…</p>
                <p className="text-sm text-muted-foreground">Reading pages</p>
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

      <Alert className="border-amber-200 bg-amber-50">
        <CloudOff className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-700">
          Plans load locally for your session. Measurements are saved and will persist across page refreshes.
        </AlertDescription>
      </Alert>

      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
