import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DOC_TYPES, type DocType, type StoredDoc, isExpired, uploadDoc, docUrl, removeDocFile,
  loadCompanyDocs, loadCompanyDocsLocal, saveCompanyDocs, loadProjectDocs, saveProjectDocs,
  legacyTenderDocNames, clearLegacyTenderDocs, type ProjectTenderDocs,
} from '@/lib/tender/attachments';

const sizeText = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * The documents that go with a tender, by type. With a project: company documents are
 * ticked automatically (untick to leave one out) and the job's own documents are uploaded
 * here. Without a project (Settings): the company documents themselves, with expiry dates.
 */
export function TenderAttachments({ projectId }: { projectId?: string }) {
  const [company, setCompany] = useState<StoredDoc[]>(loadCompanyDocsLocal);
  const [project, setProject] = useState<ProjectTenderDocs>(() => projectId ? loadProjectDocs(projectId) : { attachments: [], excludedCompany: [] });
  const [busy, setBusy] = useState<string | null>(null);
  const [legacy, setLegacy] = useState<string[]>(() => projectId ? legacyTenderDocNames(projectId) : []);

  useEffect(() => { loadCompanyDocs().then(setCompany).catch(() => {}); }, []);
  useEffect(() => { if (projectId) setProject(loadProjectDocs(projectId)); }, [projectId]);

  const onFiles = async (files: FileList | null, type: DocType, isCompany: boolean) => {
    const target = { type, company: isCompany };
    if (!files?.length) return;
    setBusy(target.type);
    try {
      for (const f of Array.from(files)) {
        const doc = await uploadDoc(f, target.type, target.company ? 'company' : projectId!);
        if (target.company) {
          // one current document per company type: the new one replaces the old
          const old = company.filter(d => d.type === target.type);
          old.forEach(removeDocFile);
          const next = [...company.filter(d => d.type !== target.type), { ...doc, expiresAt: old[0]?.expiresAt ?? null }];
          setCompany(next); saveCompanyDocs(next);
        } else {
          const next = { ...project, attachments: [...project.attachments, doc] };
          setProject(next); saveProjectDocs(projectId!, next);
        }
      }
      toast.success('Uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally { setBusy(null); }
  };

  const open = async (d: StoredDoc) => {
    const url = await docUrl(d);
    if (url) window.open(url, '_blank', 'noopener'); else toast.error('Could not open the file');
  };
  const removeCompany = (d: StoredDoc) => { removeDocFile(d); const next = company.filter(x => x.id !== d.id); setCompany(next); saveCompanyDocs(next); };
  const removeProject = (d: StoredDoc) => { removeDocFile(d); const next = { ...project, attachments: project.attachments.filter(x => x.id !== d.id) }; setProject(next); saveProjectDocs(projectId!, next); };
  const setExpiry = (d: StoredDoc, expiresAt: string) => { const next = company.map(x => x.id === d.id ? { ...x, expiresAt: expiresAt || null } : x); setCompany(next); saveCompanyDocs(next); };
  const toggleCompany = (d: StoredDoc, on: boolean) => {
    const next = { ...project, excludedCompany: on ? project.excludedCompany.filter(id => id !== d.id) : [...project.excludedCompany, d.id] };
    setProject(next); saveProjectDocs(projectId!, next);
  };

  const types = projectId ? DOC_TYPES : DOC_TYPES.filter(t => t.company);
  return (
    <div className="space-y-2 text-sm">
      {legacy.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
          Documents uploaded here before were only kept in this browser and can no longer be opened: {legacy.join(', ')}. Upload them again below.
          <button className="ml-2 underline" onClick={() => { clearLegacyTenderDocs(projectId!); setLegacy([]); }}>Dismiss</button>
        </div>
      )}
      {!projectId && <p className="text-xs text-muted-foreground">Uploaded once, these go with every tender automatically. Set the expiry date: an expired document is left out and flagged.</p>}
      {types.map(t => {
        const companyDocs = t.company ? company.filter(d => d.type === t.key) : [];
        const projectDocs = projectId ? project.attachments.filter(d => d.type === t.key) : [];
        const has = companyDocs.length + projectDocs.length > 0;
        const missing = !has && 'needed' in t && t.needed;
        return (
          <div key={t.key} className={cn('rounded-lg border px-3 py-2', missing ? 'border-amber-500/40 bg-amber-500/5' : 'border-border')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{t.label}
                <span className={cn('ml-2 text-xs font-normal', missing ? 'text-amber-400' : has ? 'text-muted-foreground' : 'text-muted-foreground/70')}>
                  {missing ? 'Missing' : has ? (t.company ? 'Company document' : 'Attached') : 'Not attached'}
                </span>
              </span>
              <label className={cn('inline-flex h-7 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted', busy !== null && 'pointer-events-none opacity-50')}>
                {busy === t.key ? 'Uploading...' : t.company && companyDocs.length ? 'Replace' : 'Upload'}
                <input type="file" multiple={!t.company} className="hidden" data-doc-type={t.key} accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                  onChange={e => { onFiles(e.target.files, t.key, t.company); e.target.value = ''; }} />
              </label>
            </div>
            {companyDocs.map(d => {
              const expired = isExpired(d);
              const included = !project.excludedCompany.includes(d.id) && !expired;
              return (
                <div key={d.id} className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {projectId && (
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={included} disabled={expired} onChange={e => toggleCompany(d, e.target.checked)} />
                      Send with this tender
                    </label>
                  )}
                  <button className="underline-offset-2 hover:underline" onClick={() => open(d)}>{d.fileName}</button>
                  <span className="text-muted-foreground">{sizeText(d.size)}</span>
                  {projectId
                    ? d.expiresAt && <span className={expired ? 'text-red-400' : 'text-muted-foreground'}>{expired ? 'Expired' : 'Expires'} {new Date(d.expiresAt).toLocaleDateString('en-AU')}</span>
                    : (
                      <label className="flex items-center gap-1.5 text-muted-foreground">Expires
                        <input type="date" value={d.expiresAt ?? ''} onChange={e => setExpiry(d, e.target.value)}
                          className="h-7 rounded border border-input bg-background px-1.5 text-xs text-foreground" />
                        {expired && <span className="text-red-400">expired</span>}
                      </label>
                    )}
                  {!projectId && <button className="text-muted-foreground hover:text-destructive" onClick={() => removeCompany(d)}>Remove</button>}
                </div>
              );
            })}
            {projectDocs.map(d => (
              <div key={d.id} className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                <button className="underline-offset-2 hover:underline" onClick={() => open(d)}>{d.fileName}</button>
                <span className="text-muted-foreground">{sizeText(d.size)}</span>
                <button className="text-muted-foreground hover:text-destructive" onClick={() => removeProject(d)}>Remove</button>
              </div>
            ))}
          </div>
        );
      })}
      {projectId && <p className="text-xs text-muted-foreground">Company documents (insurances, licence, profile) are managed once in Settings, Company documents. The tender lists every attached document.</p>}
    </div>
  );
}
