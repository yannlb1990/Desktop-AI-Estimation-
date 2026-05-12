import React, { useState, useCallback } from 'react';
import {
  Loader2, Brain, AlertTriangle, AlertCircle, Info, CheckCircle2,
  Wrench, BookOpen, ClipboardList, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { extractFullPageText } from '@/lib/takeoff/pdfTextExtractor';
import type {
  PlanIntelligenceResult,
  PlanNote,
  MaterialSpec,
  StandardRef,
  ActionItem,
  NoteType,
  SpecCategory,
  ActionPriority,
} from '@/lib/takeoff/planIntelligenceTypes';

interface PlanIntelligencePanelProps {
  pdfUrl: string | null;
  pageCount: number;
  projectName?: string;
  projectType?: 'residential' | 'commercial' | 'industrial';
}

// ── Styling helpers ──────────────────────────────────────────────────────────

const NOTE_STYLES: Record<NoteType, { bg: string; border: string; icon: React.ReactNode; label: string }> = {
  critical:      { bg: 'bg-red-50',    border: 'border-red-300',    icon: <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />,     label: 'CRITICAL' },
  warning:       { bg: 'bg-amber-50',  border: 'border-amber-300',  icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />, label: 'WARNING' },
  specification: { bg: 'bg-blue-50',   border: 'border-blue-300',   icon: <Wrench className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />,         label: 'SPEC' },
  verify:        { bg: 'bg-purple-50', border: 'border-purple-300', icon: <CheckCircle2 className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />,  label: 'VERIFY' },
  general:       { bg: 'bg-gray-50',   border: 'border-gray-200',   icon: <Info className="h-3.5 w-3.5 text-gray-500 shrink-0 mt-0.5" />,            label: 'NOTE' },
};

const SPEC_COLORS: Record<SpecCategory, string> = {
  Timber:        'bg-amber-100 text-amber-800',
  Concrete:      'bg-gray-200 text-gray-800',
  Steel:         'bg-blue-100 text-blue-800',
  Masonry:       'bg-orange-100 text-orange-800',
  Insulation:    'bg-green-100 text-green-800',
  Glazing:       'bg-cyan-100 text-cyan-800',
  Waterproofing: 'bg-indigo-100 text-indigo-800',
  Fixings:       'bg-yellow-100 text-yellow-800',
  Roofing:       'bg-red-100 text-red-800',
  Fire:          'bg-red-200 text-red-900',
  Energy:        'bg-lime-100 text-lime-800',
  Acoustic:      'bg-violet-100 text-violet-800',
  Plumbing:      'bg-teal-100 text-teal-800',
  Electrical:    'bg-purple-100 text-purple-800',
  Other:         'bg-gray-100 text-gray-700',
};

const PRIORITY_STYLES: Record<ActionPriority, { badge: string; label: string }> = {
  high:   { badge: 'bg-red-100 text-red-700 border-red-200',    label: 'HIGH' },
  medium: { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'MED' },
  low:    { badge: 'bg-gray-100 text-gray-600 border-gray-200', label: 'LOW' },
};

// ── Sub-renderers ────────────────────────────────────────────────────────────

function NoteCard({ note }: { note: PlanNote }) {
  const s = NOTE_STYLES[note.type] || NOTE_STYLES.general;
  return (
    <div className={`flex gap-2 p-2.5 rounded border ${s.bg} ${s.border}`}>
      {s.icon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="text-[10px] font-bold tracking-wide opacity-70">{s.label}</span>
          {note.trade && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{note.trade}</Badge>
          )}
          {note.location && (
            <span className="text-[10px] text-muted-foreground">{note.location}</span>
          )}
        </div>
        <p className="text-xs leading-relaxed">{note.content}</p>
      </div>
    </div>
  );
}

function SpecCard({ spec }: { spec: MaterialSpec }) {
  return (
    <div className="flex gap-2 p-2.5 rounded border bg-background">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className={`text-[10px] font-semibold px-1.5 py-0 rounded-sm ${SPEC_COLORS[spec.category] || SPEC_COLORS.Other}`}>
            {spec.category}
          </span>
          {spec.value && (
            <code className="text-[10px] bg-muted px-1 rounded">{spec.value}</code>
          )}
          {spec.standard && (
            <span className="text-[10px] text-muted-foreground">{spec.standard}</span>
          )}
        </div>
        <p className="text-xs leading-relaxed">{spec.specification}</p>
        {spec.locations && spec.locations.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{spec.locations.join(' · ')}</p>
        )}
      </div>
    </div>
  );
}

function StandardCard({ std }: { std: StandardRef }) {
  return (
    <div className={`p-2.5 rounded border ${std.compliance_required ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold">{std.code}</p>
          <p className="text-[11px] text-muted-foreground">{std.title}</p>
        </div>
        {std.compliance_required && (
          <Badge className="bg-blue-600 text-white text-[10px] shrink-0">Required</Badge>
        )}
      </div>
      <p className="text-xs mt-1 leading-relaxed">{std.context}</p>
    </div>
  );
}

function ActionCard({ item }: { item: ActionItem }) {
  const s = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.low;
  return (
    <div className="p-2.5 rounded border bg-background">
      <div className="flex items-start gap-2">
        <Badge variant="outline" className={`text-[10px] font-bold shrink-0 ${s.badge}`}>{s.label}</Badge>
        <div className="flex-1 min-w-0">
          {item.trade && (
            <span className="text-[10px] text-muted-foreground block mb-0.5">{item.trade}</span>
          )}
          <p className="text-xs font-medium leading-tight">{item.action}</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{item.reason}</p>
        </div>
      </div>
    </div>
  );
}

// ── Text report export ───────────────────────────────────────────────────────

function generateReport(result: PlanIntelligenceResult, projectName: string): string {
  const lines: string[] = [
    `PLAN INTELLIGENCE REPORT`,
    `Project: ${projectName}`,
    `Generated: ${new Date().toLocaleDateString('en-AU')}`,
    `Chunks processed: ${result.chunksProcessed}`,
    '',
    '═══════════════════════════════════════',
    `ACTION ITEMS (${result.action_items.length})`,
    '═══════════════════════════════════════',
  ];

  const sorted = [...result.action_items].sort((a, b) => {
    const order: Record<ActionPriority, number> = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
  });
  sorted.forEach((a, i) => {
    lines.push(`${i + 1}. [${a.priority.toUpperCase()}] ${a.action}`);
    lines.push(`   ${a.reason}`);
    if (a.trade) lines.push(`   Trade: ${a.trade}`);
    lines.push('');
  });

  lines.push('', '═══════════════════════════════════════', `PLAN NOTES (${result.notes.length})`, '═══════════════════════════════════════');
  result.notes
    .filter((n) => n.type === 'critical' || n.type === 'warning')
    .forEach((n) => {
      lines.push(`[${n.type.toUpperCase()}]${n.trade ? ` (${n.trade})` : ''}`);
      lines.push(`  ${n.content}`);
      if (n.location) lines.push(`  Location: ${n.location}`);
      lines.push('');
    });

  lines.push('', '═══════════════════════════════════════', `SPECIFICATIONS (${result.specifications.length})`, '═══════════════════════════════════════');
  result.specifications.forEach((s) => {
    lines.push(`[${s.category}]${s.value ? ` ${s.value}` : ''}${s.standard ? ` (${s.standard})` : ''}`);
    lines.push(`  ${s.specification}`);
    lines.push('');
  });

  lines.push('', '═══════════════════════════════════════', `APPLICABLE STANDARDS (${result.standards.length})`, '═══════════════════════════════════════');
  result.standards.forEach((s) => {
    lines.push(`${s.code} — ${s.title}`);
    lines.push(`  ${s.context}`);
    lines.push('');
  });

  return lines.join('\n');
}

// ── Main component ───────────────────────────────────────────────────────────

export const PlanIntelligencePanel: React.FC<PlanIntelligencePanelProps> = ({
  pdfUrl,
  pageCount,
  projectName = 'Project',
  projectType,
}) => {
  const [status, setStatus] = useState<'idle' | 'reading' | 'analyzing' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<PlanIntelligenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [noteFilter, setNoteFilter] = useState<NoteType | 'all'>('all');

  const busy = status === 'reading' || status === 'analyzing';

  const handleAnalyze = useCallback(async () => {
    if (!pdfUrl) { toast.error('No PDF loaded'); return; }
    setStatus('reading');
    setError(null);
    setResult(null);
    setProgress('Reading PDF text…');

    const pageTexts: string[] = [];
    for (let i = 0; i < pageCount; i++) {
      setProgress(`Reading page ${i + 1} of ${pageCount}…`);
      try {
        const text = await extractFullPageText(pdfUrl, i);
        if (text.trim()) pageTexts.push(`--- PAGE ${i + 1} ---\n${text}`);
      } catch { /* skip */ }
    }

    if (pageTexts.length === 0) {
      setError('No readable text in PDF. Document may be scanned — try the AI Extraction panel instead.');
      setStatus('error');
      return;
    }

    setStatus('analyzing');
    setProgress('Analysing with AI…');

    const { data, error: fnError } = await supabase.functions.invoke<PlanIntelligenceResult>(
      'comprehensive-plan-analysis',
      { body: { text: pageTexts.join('\n\n'), projectName, projectType } },
    );

    if (fnError || !data?.success) {
      const msg = fnError?.message || data?.error || 'Analysis failed';
      setError(msg);
      setStatus('error');
      toast.error(msg);
      return;
    }

    setResult(data);
    setStatus('done');
    setProgress('');

    const total = data.notes.length + data.specifications.length + data.standards.length + data.action_items.length;
    toast.success(`Found ${total} items across ${data.chunksProcessed} text chunk${data.chunksProcessed !== 1 ? 's' : ''}`);
  }, [pdfUrl, pageCount, projectName, projectType]);

  const handleDownload = () => {
    if (!result) return;
    const text = generateReport(result, projectName);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_plan_intelligence.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredNotes = result
    ? noteFilter === 'all'
      ? result.notes
      : result.notes.filter((n) => n.type === noteFilter)
    : [];

  const criticalCount = result?.notes.filter((n) => n.type === 'critical' || n.type === 'warning').length ?? 0;
  const highActions = result?.action_items.filter((a) => a.priority === 'high').length ?? 0;

  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">Plan Intelligence</h3>
        </div>
        {result && (
          <div className="flex items-center gap-1.5">
            {criticalCount > 0 && (
              <Badge className="bg-red-600 text-white text-[10px]">{criticalCount} alerts</Badge>
            )}
            {highActions > 0 && (
              <Badge className="bg-amber-500 text-white text-[10px]">{highActions} actions</Badge>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Analyse button */}
      <Button onClick={handleAnalyze} disabled={!pdfUrl || busy} className="w-full" size="sm">
        {busy ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{progress || 'Working…'}</>
        ) : (
          <><Brain className="h-4 w-4 mr-2" />{result ? 'Re-analyse Plan' : 'Analyse Full Plan'}</>
        )}
      </Button>

      {/* Results */}
      {result && (
        <>
          <Tabs defaultValue="notes">
            <TabsList className="w-full h-8 text-xs">
              <TabsTrigger value="notes" className="flex-1 text-xs">
                Notes
                {result.notes.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">{result.notes.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="specs" className="flex-1 text-xs">
                Specs
                {result.specifications.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">{result.specifications.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="standards" className="flex-1 text-xs">
                AS/NCC
                {result.standards.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">{result.standards.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="actions" className="flex-1 text-xs">
                Actions
                {result.action_items.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">{result.action_items.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Notes tab */}
            <TabsContent value="notes" className="mt-2 space-y-2">
              <div className="flex gap-1 flex-wrap">
                {(['all', 'critical', 'warning', 'specification', 'verify', 'general'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setNoteFilter(f)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                      noteFilter === f
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:bg-muted'
                    }`}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                    {f !== 'all' && (
                      <span className="ml-1 opacity-70">
                        {result.notes.filter((n) => n.type === f).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <ScrollArea className="h-72">
                <div className="space-y-1.5 pr-2">
                  {filteredNotes.length === 0
                    ? <p className="text-xs text-muted-foreground text-center py-4">No notes of this type found.</p>
                    : filteredNotes.map((note, i) => <NoteCard key={i} note={note} />)
                  }
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Specs tab */}
            <TabsContent value="specs" className="mt-2">
              <ScrollArea className="h-72">
                <div className="space-y-1.5 pr-2">
                  {result.specifications.length === 0
                    ? <p className="text-xs text-muted-foreground text-center py-4">No specifications extracted.</p>
                    : result.specifications.map((spec, i) => <SpecCard key={i} spec={spec} />)
                  }
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Standards tab */}
            <TabsContent value="standards" className="mt-2">
              <ScrollArea className="h-72">
                <div className="space-y-1.5 pr-2">
                  {result.standards.length === 0
                    ? <p className="text-xs text-muted-foreground text-center py-4">No standards identified.</p>
                    : result.standards.map((std, i) => <StandardCard key={i} std={std} />)
                  }
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Actions tab */}
            <TabsContent value="actions" className="mt-2">
              <ScrollArea className="h-72">
                <div className="space-y-1.5 pr-2">
                  {result.action_items.length === 0
                    ? <p className="text-xs text-muted-foreground text-center py-4">No action items identified.</p>
                    : [...result.action_items]
                        .sort((a, b) => {
                          const order: Record<ActionPriority, number> = { high: 0, medium: 1, low: 2 };
                          return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
                        })
                        .map((item, i) => <ActionCard key={i} item={item} />)
                  }
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <Button variant="outline" size="sm" className="w-full" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5 mr-2" />
            Download Intelligence Report
          </Button>
        </>
      )}

      <p className="text-xs text-muted-foreground leading-tight">
        Reads all plan text and uses AI to surface notes, material specs, applicable Australian standards, and action items — including details commonly missed in manual reviews.
      </p>
    </Card>
  );
};
