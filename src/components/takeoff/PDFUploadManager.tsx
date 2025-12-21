import { useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
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
    // Max 50MB
    if (file.size > 50 * 1024 * 1024) {
      return 'File size must be less than 50MB';
    }
    
    // Check file type
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      return 'File must be PDF, PNG, or JPG';
    }
    
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidationError(null);
    
    // Validate file
    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      onError(error);
      return;
    }

    setUploading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload to Supabase storage
      const filename = `${Date.now()}_${file.name}`;
      const filePath = `${user.id}/${projectId}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from('plans')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('plans')
        .getPublicUrl(filePath);

      // Get page count (for PDFs, use PDF.js)
      let pageCount = 1;
      if (file.type === 'application/pdf') {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        pageCount = pdf.numPages;
      }

      const pdfFile: PDFFile = {
        file,
        url: publicUrl,
        name: file.name,
        pageCount
      };

      onUploadComplete(pdfFile);
      toast.success(`Uploaded ${file.name} (${pageCount} page${pageCount > 1 ? 's' : ''})`);
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
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
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
              <FileText className="h-12 w-12 text-muted-foreground animate-pulse" />
            ) : (
              <Upload className="h-12 w-12 text-muted-foreground" />
            )}
            <div>
              <p className="text-lg font-medium">
                {uploading ? 'Uploading...' : 'Upload PDF or Image'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                PDF, PNG, or JPG up to 50MB
              </p>
            </div>
            {!uploading && (
              <Button type="button" variant="secondary">
                Choose File
              </Button>
            )}
          </div>
        </label>
      </div>

      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
