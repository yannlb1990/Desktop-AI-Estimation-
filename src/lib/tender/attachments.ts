/**
 * Documents that go with a tender. Company documents (insurances, licence, company profile)
 * are uploaded once, kept with their expiry date and ticked on every tender; project
 * documents (contract, drawings, SWMS...) belong to one job. Files live in the private
 * tender-documents bucket under the builder's own folder; the lists are synced with the
 * account (company) and the project (project documents), so every device sees them.
 */
import { supabase } from '@/integrations/supabase/client';
import { getUserStorageKey } from '@/lib/localAuth';
import { syncProjectToSupabase } from '@/lib/db/projects';
import { loadUserPreferencesFromSupabase, syncUserPreferencesToSupabase } from '@/lib/db/userPreferences';

const BUCKET = 'tender-documents';
/** Until the tender-documents storage exists (migration 20261109000000), files go to the
 *  private plans storage under the builder's own documents folder. */
const FALLBACK_BUCKET = 'plan-pdfs';

export const DOC_TYPES = [
  { key: 'contract', label: 'Contract and terms and conditions', company: false },
  { key: 'public_liability', label: 'Public liability insurance', company: true, needed: true },
  { key: 'contract_works', label: 'Contract works insurance', company: true, needed: true },
  { key: 'licence', label: "Builder's licence", company: true, needed: true },
  { key: 'home_warranty', label: 'Home warranty certificate', company: false },
  { key: 'swms', label: 'SWMS and safety documents', company: false },
  { key: 'company_profile', label: 'Company profile', company: true },
  { key: 'drawings', label: 'Drawings and specifications', company: false },
  { key: 'other', label: 'Other', company: false },
] as const;
export type DocType = typeof DOC_TYPES[number]['key'];
export const docTypeLabel = (t: string) => DOC_TYPES.find(d => d.key === t)?.label ?? 'Other';

export interface StoredDoc {
  id: string;
  type: DocType;
  fileName: string;
  path: string;
  size: number;
  mime: string;
  uploadedAt: string;
  /** company documents: the date the certificate or licence runs out (YYYY-MM-DD) */
  expiresAt?: string | null;
  /** 'Other': what the document is */
  label?: string;
  /** the storage the file is in (older uploads: tender-documents) */
  bucket?: string;
}

export const MAX_DOC_BYTES = 20 * 1024 * 1024;
const ALLOWED = /^(application\/pdf|image\/(png|jpe?g|webp|heic)|application\/(msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet))|application\/vnd\.ms-excel)$/;

export function isExpired(d: StoredDoc, today = new Date().toISOString().slice(0, 10)): boolean {
  return !!d.expiresAt && d.expiresAt < today;
}

async function uid(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in again to upload documents');
  return session.user.id;
}

/** Uploads a file to the builder's folder: company/... or <projectId>/... */
export async function uploadDoc(file: File, type: DocType, scope: 'company' | string): Promise<StoredDoc> {
  if (file.size > MAX_DOC_BYTES) throw new Error(`${file.name} is over 20 MB`);
  if (file.type && !ALLOWED.test(file.type)) throw new Error(`${file.name}: use a PDF, Word, Excel or photo file`);
  const id = crypto.randomUUID();
  const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-80);
  const user = await uid();
  const opts = { contentType: file.type || 'application/octet-stream', upsert: false };
  let bucket = BUCKET;
  let path = `${user}/${scope}/${id}-${safe}`;
  let { error } = await supabase.storage.from(bucket).upload(path, file, opts);
  if (error && /bucket not found/i.test(error.message)) {
    bucket = FALLBACK_BUCKET;
    path = `${user}/documents/${scope}/${id}-${safe}`;
    ({ error } = await supabase.storage.from(bucket).upload(path, file, opts));
  }
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { id, type, fileName: file.name, path, bucket, size: file.size, mime: file.type, uploadedAt: new Date().toISOString() };
}

/** A link to open or download the file, valid for an hour. */
export async function docUrl(d: StoredDoc): Promise<string | null> {
  const { data } = await supabase.storage.from(d.bucket ?? BUCKET).createSignedUrl(d.path, 3600);
  return data?.signedUrl ?? null;
}

export function removeDocFile(d: StoredDoc) {
  supabase.storage.from(d.bucket ?? BUCKET).remove([d.path]).catch(() => undefined);
}

// ── company documents (once per builder) ──────────────────────────────────────
const COMPANY_KEY = () => getUserStorageKey('company_documents');

export function loadCompanyDocsLocal(): StoredDoc[] {
  try { return JSON.parse(localStorage.getItem(COMPANY_KEY()) || '[]'); } catch { return []; }
}

/** This device's list, refreshed from the account when online. */
export async function loadCompanyDocs(): Promise<StoredDoc[]> {
  const remote = await loadUserPreferencesFromSupabase().catch(() => null);
  const list: StoredDoc[] | undefined = remote?.company_documents;
  if (Array.isArray(list)) { localStorage.setItem(COMPANY_KEY(), JSON.stringify(list)); return list; }
  return loadCompanyDocsLocal();
}

export function saveCompanyDocs(list: StoredDoc[]) {
  localStorage.setItem(COMPANY_KEY(), JSON.stringify(list));
  syncUserPreferencesToSupabase({ company_documents: list });
  window.dispatchEvent(new CustomEvent('tender-docs-changed', { detail: { company: true } }));
}

// ── project documents and what goes with this tender ─────────────────────────
export interface ProjectTenderDocs { attachments: StoredDoc[]; excludedCompany: string[] }

function readProject(projectId: string): any {
  try { return JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]').find((p: any) => p.id === projectId) ?? null; } catch { return null; }
}

export function loadProjectDocs(projectId: string): ProjectTenderDocs {
  const p = readProject(projectId);
  return { attachments: p?.tender_attachments ?? [], excludedCompany: p?.tender_excluded_company_docs ?? [] };
}

export function saveProjectDocs(projectId: string, docs: ProjectTenderDocs) {
  const key = getUserStorageKey('local_projects');
  const all: any[] = JSON.parse(localStorage.getItem(key) || '[]');
  const idx = all.findIndex(p => p.id === projectId);
  if (idx === -1) return;
  all[idx] = { ...all[idx], tender_attachments: docs.attachments, tender_excluded_company_docs: docs.excludedCompany };
  localStorage.setItem(key, JSON.stringify(all));
  syncProjectToSupabase(all[idx]);
  window.dispatchEvent(new CustomEvent('tender-docs-changed', { detail: { projectId } }));
}

/** Everything going with this tender: ticked company documents (not expired) and the job's own. */
export function attachedDocs(company: StoredDoc[], project: ProjectTenderDocs): StoredDoc[] {
  return [
    ...company.filter(d => !project.excludedCompany.includes(d.id) && !isExpired(d)),
    ...project.attachments,
  ];
}

/** Uploads from before this (kept only in this browser and lost on reload) to re-upload. */
export function legacyTenderDocNames(projectId: string): string[] {
  try { return (JSON.parse(localStorage.getItem(`local_tender_docs_${projectId}`) || '[]') as any[]).map(d => d.file_name).filter(Boolean); } catch { return []; }
}
export function clearLegacyTenderDocs(projectId: string) {
  try { localStorage.removeItem(`local_tender_docs_${projectId}`); } catch { /* nothing to clear */ }
}
