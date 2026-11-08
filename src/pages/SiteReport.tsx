import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getVisit } from '@/lib/site/siteStore';
import type { SiteVisit } from '@/lib/site/visit';
import { SiteVisitReport } from '@/components/site/SiteVisitReport';

/** /site-report/:visitId — a site visit as a report on the computer, ready to print or save as PDF. */
export default function SiteReport() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const [visit, setVisit] = useState<SiteVisit | null | undefined>(undefined);
  useEffect(() => { if (visitId) getVisit(visitId).then(setVisit); }, [visitId]);

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <nav className="border-b border-border bg-background print:hidden">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-6">
          <Button variant="ghost" size="sm" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}>Back</Button>
          <div className="flex gap-2">
            {visit?.projectId && <Button variant="outline" size="sm" onClick={() => navigate(`/project/${visit.projectId}?tab=estimate`)}>Open the project</Button>}
            <Button size="sm" disabled={!visit} onClick={() => window.print()}>Print or save as PDF</Button>
          </div>
        </div>
      </nav>
      <div className="container mx-auto max-w-4xl px-4 py-6 md:px-6 print:max-w-none print:px-0 print:py-0">
        <h1 className="mb-4 font-display text-2xl font-bold">Site report</h1>
        {visit === undefined && <p className="text-muted-foreground">Loading the visit...</p>}
        {visit === null && <p className="text-muted-foreground">This visit was not found. It may not have reached the office yet: open it on the phone with signal.</p>}
        {visit && (
          <div className="rounded-xl border border-border bg-card p-5 print:border-0 print:p-0">
            <SiteVisitReport visit={visit} />
          </div>
        )}
      </div>
    </div>
  );
}
