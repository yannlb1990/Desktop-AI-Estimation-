import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Trash2, FileText, Download, File } from "lucide-react";
import { toast } from "sonner";

interface TenderDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  description: string | null;
  created_at: string;
}

interface TenderDocumentsProps {
  projectId: string;
}

function storageKey(projectId: string) {
  return `local_tender_docs_${projectId}`;
}

function loadDocs(projectId: string): TenderDocument[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(projectId)) || "[]");
  } catch {
    return [];
  }
}

function saveDocs(projectId: string, docs: TenderDocument[]) {
  localStorage.setItem(storageKey(projectId), JSON.stringify(docs));
}

export const TenderDocuments = ({ projectId }: TenderDocumentsProps) => {
  const [documents, setDocuments] = useState<TenderDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingDescription, setEditingDescription] = useState<string | null>(null);

  useEffect(() => {
    setDocuments(loadDocs(projectId));
  }, [projectId]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg'
    ];

    const current = loadDocs(projectId);
    const added: TenderDocument[] = [];

    Array.from(files).forEach(file => {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: File type not allowed. Please upload PDF, DOCX, PNG, or JPG files.`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: File size exceeds 10MB limit.`);
        return;
      }

      const blobUrl = URL.createObjectURL(file);
      added.push({
        id: crypto.randomUUID(),
        file_name: file.name,
        file_url: blobUrl,
        file_type: file.type,
        file_size: file.size,
        description: null,
        created_at: new Date().toISOString(),
      });
      toast.success(`${file.name} uploaded successfully`);
    });

    if (added.length > 0) {
      const updated = [...added, ...current];
      saveDocs(projectId, updated);
      setDocuments(updated);
    }

    setUploading(false);
    event.target.value = '';
  };

  const updateDescription = (docId: string, description: string) => {
    const updated = loadDocs(projectId).map(d =>
      d.id === docId ? { ...d, description } : d
    );
    saveDocs(projectId, updated);
    setDocuments(updated);
    setEditingDescription(null);
    toast.success("Description updated");
  };

  const deleteDocument = (doc: TenderDocument) => {
    if (!confirm(`Delete ${doc.file_name}?`)) return;
    const updated = loadDocs(projectId).filter(d => d.id !== doc.id);
    saveDocs(projectId, updated);
    setDocuments(updated);
    toast.success("Document deleted");
  };

  const downloadDocument = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    if (fileType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
    if (fileType.startsWith('image/')) return <File className="h-4 w-4 text-blue-500" />;
    return <File className="h-4 w-4 text-gray-500" />;
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="font-display text-xl font-bold mb-2">Tender Documents</h3>
        <p className="text-sm text-muted-foreground">
          Upload supporting documents to include with your tender (contracts, T&Cs, insurance certificates, etc.)
        </p>
      </div>

      <div className="mb-6">
        <Label htmlFor="file-upload" className="cursor-pointer">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary hover:bg-accent/50 transition-colors">
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">Click to upload documents</p>
            <p className="text-xs text-muted-foreground">
              PDF, DOCX, PNG, JPG (max 10MB per file)
            </p>
          </div>
          <Input
            id="file-upload"
            type="file"
            multiple
            accept=".pdf,.docx,image/png,image/jpeg"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </Label>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No documents uploaded yet</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Type</TableHead>
              <TableHead>File Name</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>{getFileIcon(doc.file_type)}</TableCell>
                <TableCell className="font-medium">{doc.file_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatFileSize(doc.file_size)}
                </TableCell>
                <TableCell>
                  {editingDescription === doc.id ? (
                    <Input
                      autoFocus
                      defaultValue={doc.description || ''}
                      onBlur={(e) => updateDescription(doc.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') updateDescription(doc.id, e.currentTarget.value);
                        if (e.key === 'Escape') setEditingDescription(null);
                      }}
                      className="h-8"
                    />
                  ) : (
                    <div
                      onClick={() => setEditingDescription(doc.id)}
                      className="cursor-pointer hover:text-primary min-h-[32px] flex items-center"
                    >
                      {doc.description || (
                        <span className="text-muted-foreground italic">Click to add description</span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadDocument(doc.file_url, doc.file_name)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDocument(doc)}
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

      {uploading && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Uploading documents...
        </div>
      )}
    </Card>
  );
};
