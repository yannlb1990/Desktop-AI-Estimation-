import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CostItem } from './types';

export interface SOWProjectMeta {
  projectName: string;
  clientName: string;
  clientContact?: string;
  clientPhone?: string;
  projectAddress: string;
  contactPerson?: string;
  contactMobile?: string;
  dateSubmitted?: string;
  state?: string;
  /** Extra notes / exclusions per trade key */
  tradeNotes?: Record<string, string[]>;
  /** Provisional Sums per trade key */
  provisionalSums?: Record<string, { description: string; amount: number }[]>;
}

export interface SOWGeneratorOptions {
  meta: SOWProjectMeta;
  costItems: CostItem[];
}

const BRAND   = '#1e40af';
const LIGHT   = '#eff6ff';
const DARK    = '#111827';
const MID     = '#6b7280';
const WHITE   = '#ffffff';
const SECTION = '#dbeafe';

function hex(h: string): [number, number, number] {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0,2),16), parseInt(s.slice(2,4),16), parseInt(s.slice(4,6),16)];
}

function currency(n: number): string {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 });
}

function drawPageFooter(doc: jsPDF, pageNum: number, totalPages: number, projectName: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...hex(MID));
  doc.setLineWidth(0.2);
  doc.line(14, pageH - 12, pageW - 14, pageH - 12);
  doc.setFontSize(7);
  doc.setTextColor(...hex(MID));
  doc.setFont('helvetica', 'normal');
  doc.text(projectName, 14, pageH - 7);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageW - 14, pageH - 7, { align: 'right' });
  doc.text('SCOPE OF WORKS — CONFIDENTIAL', pageW / 2, pageH - 7, { align: 'center' });
}

export function generateSOWPdf(opts: SOWGeneratorOptions): void {
  const { meta, costItems } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 14, mR = 14;
  const cW = pageW - mL - mR;

  const dateStr = meta.dateSubmitted ||
    new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });

  // ────────────────────────────────────────────────────────────
  // PAGE 1 — COVER
  // ────────────────────────────────────────────────────────────

  // Blue header band
  doc.setFillColor(...hex(BRAND));
  doc.rect(0, 0, pageW, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.text('Scope of Works', mL, 22);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Prepared by Watermark Constructions', mL, 32);

  // Thin accent line
  doc.setDrawColor(...hex(BRAND));
  doc.setLineWidth(1);
  doc.line(mL, 46, pageW - mR, 46);

  // Project details table
  let y = 55;
  const labelW = 52;
  const valueX = mL + labelW + 4;

  const fields: [string, string][] = [
    ['Project Name',          meta.projectName],
    ['Client',                meta.clientName],
    ...(meta.clientContact ? [['Client Contact', meta.clientContact] as [string, string]] : []),
    ...(meta.clientPhone    ? [['Client Contact Number', meta.clientPhone] as [string, string]] : []),
    ['Project Address',       meta.projectAddress],
    ['Watermark Contact',     meta.contactPerson || 'Yann'],
    ...(meta.contactMobile  ? [['Watermark Mobile', meta.contactMobile] as [string, string]] : []),
    ['Date Submitted',        dateStr],
  ];

  fields.forEach(([label, value], i) => {
    const rowY = y + i * 11;
    doc.setFillColor(...hex(i % 2 === 0 ? LIGHT : WHITE));
    doc.rect(mL, rowY - 5, cW, 11, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hex(DARK));
    doc.text(label, mL + 3, rowY + 2);

    doc.setFont('helvetica', 'normal');
    doc.text(String(value), valueX, rowY + 2);
  });

  y = y + fields.length * 11 + 10;

  // Bottom of cover: scope summary
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...hex(MID));
  const summary = `This scope of works document has been prepared in accordance with the agreed project brief. `
    + `All prices are ex-GST unless stated otherwise. Quote valid 30 days from date of submission.`;
  const lines = doc.splitTextToSize(summary, cW);
  doc.text(lines, mL, y);

  // ────────────────────────────────────────────────────────────
  // PAGES 2+ — TRADE SECTIONS
  // ────────────────────────────────────────────────────────────

  // Group cost items by trade
  const tradeOrder: string[] = [];
  const byTrade = new Map<string, CostItem[]>();
  for (const item of costItems) {
    const t = item.trade || 'General';
    if (!byTrade.has(t)) { byTrade.set(t, []); tradeOrder.push(t); }
    byTrade.get(t)!.push(item);
  }

  // Sort trades in logical construction order
  const TRADE_ORDER = [
    'Preliminaries', 'Site Works', 'Demolition', 'Concrete', 'Structural Steel',
    'Carpentry', 'Brickwork', 'Roofing', 'Windows & Doors', 'Waterproofing',
    'Plasterboard', 'Tiling', 'Joinery', 'Floor Coverings', 'Painting',
    'Plumbing', 'Electrical', 'HVAC', 'Fire Services', 'Landscaping',
    'External Works', 'Certifications', 'Other', 'General',
  ];
  tradeOrder.sort((a, b) => {
    const ai = TRADE_ORDER.indexOf(a); const bi = TRADE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const tradeTotals: { trade: string; total: number }[] = [];

  for (const trade of tradeOrder) {
    const items = byTrade.get(trade)!;
    const psItems = meta.provisionalSums?.[trade] || [];
    const notes = meta.tradeNotes?.[trade] || [];
    const sectionTotal = items.reduce((s, i) => s + (i.subtotal || 0), 0)
      + psItems.reduce((s, p) => s + p.amount, 0);
    tradeTotals.push({ trade, total: sectionTotal });

    doc.addPage();

    // Section header band
    doc.setFillColor(...hex(BRAND));
    doc.rect(0, 0, pageW, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(trade.toUpperCase(), mL, 11);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(meta.projectName, pageW - mR, 11, { align: 'right' });

    y = 24;

    // Line items table
    const tableBody: (string | object)[][] = items.map((item) => [
      item.name || item.description || '—',
      item.description && item.description !== item.name ? item.description : '',
      item.quantity > 0 ? String(Number(item.quantity.toFixed(2))) : '—',
      item.unit || '—',
      item.unitCost > 0 ? currency(item.unitCost) : '—',
      item.subtotal > 0 ? currency(item.subtotal) : '—',
    ]);

    // Provisional sum rows
    psItems.forEach((ps) => {
      tableBody.push([
        `PS: ${ps.description}`,
        { content: 'Provisional Sum', styles: { fontStyle: 'italic', textColor: hex(MID) } },
        '—', '—', '—',
        currency(ps.amount),
      ]);
    });

    autoTable(doc, {
      startY: y,
      margin: { left: mL, right: mR },
      head: [['Item', 'Description', 'Qty', 'Unit', 'Rate', 'Amount']],
      body: tableBody as string[][],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: hex(DARK) },
      headStyles: { fillColor: hex(SECTION), textColor: hex(BRAND), fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 38, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 15, halign: 'right' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 26, halign: 'right' },
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    // Section total bar
    y += 1;
    doc.setFillColor(...hex(BRAND));
    doc.rect(mL, y, cW, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${trade.toUpperCase()} TOTAL (ex-GST)`, mL + 3, y + 6);
    doc.text(currency(sectionTotal), pageW - mR - 2, y + 6, { align: 'right' });

    y += 14;

    // General notes / exclusions
    if (notes.length > 0) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...hex(DARK));
      doc.text('General Notes', mL, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...hex(MID));
      notes.forEach((note) => {
        const wrapped = doc.splitTextToSize(`• ${note}`, cW - 4);
        doc.text(wrapped, mL + 2, y);
        y += wrapped.length * 4 + 1;
      });
    }
  }

  // ────────────────────────────────────────────────────────────
  // LAST PAGE — TOTALS
  // ────────────────────────────────────────────────────────────
  doc.addPage();

  doc.setFillColor(...hex(BRAND));
  doc.rect(0, 0, pageW, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTALS', mL, 11);

  y = 24;

  // Per-trade summary table
  autoTable(doc, {
    startY: y,
    margin: { left: mL, right: mR },
    head: [['Trade', 'Amount (ex-GST)']],
    body: tradeTotals.map(({ trade, total }) => [trade, currency(total)]),
    foot: (() => {
      const sub = tradeTotals.reduce((s, t) => s + t.total, 0);
      const gst = sub * 0.1;
      const total = sub + gst;
      return [
        [{ content: 'Sub Total', styles: { fontStyle: 'bold' } }, { content: currency(sub), styles: { fontStyle: 'bold', halign: 'right' } }],
        [{ content: 'GST (10%)', styles: { fontStyle: 'bold' } }, { content: currency(gst), styles: { fontStyle: 'bold', halign: 'right' } }],
        [{ content: 'TOTAL (inc. GST)', styles: { fontStyle: 'bold', fillColor: hex(BRAND) as unknown as string, textColor: [255,255,255] as unknown as string } },
         { content: currency(total), styles: { fontStyle: 'bold', fillColor: hex(BRAND) as unknown as string, textColor: [255,255,255] as unknown as string, halign: 'right' } }],
      ];
    })(),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, textColor: hex(DARK) },
    headStyles: { fillColor: hex(SECTION), textColor: hex(BRAND), fontStyle: 'bold' },
    footStyles: { fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 40, halign: 'right' },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // Footer note
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...hex(MID));
  const footerNote = 'This quote is valid for 30 days from the date submitted. Prices are subject to material and labour variations beyond this period. '
    + 'All works to be carried out in accordance with applicable Australian Standards and NCC requirements.';
  doc.text(doc.splitTextToSize(footerNote, cW), mL, y);

  // ────────────────────────────────────────────────────────────
  // Footer on all pages
  // ────────────────────────────────────────────────────────────
  const totalPg = doc.getNumberOfPages();
  for (let pg = 1; pg <= totalPg; pg++) {
    doc.setPage(pg);
    drawPageFooter(doc, pg, totalPg, meta.projectName);
  }

  const safe = meta.projectName.replace(/[^a-zA-Z0-9_\- ]/g, '_').replace(/\s+/g, '_');
  doc.save(`SOW_${safe}.pdf`);
}
