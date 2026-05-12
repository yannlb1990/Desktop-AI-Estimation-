import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Measurement } from './types';
import { groupSubtotals, unitGrandTotals, withOrdinals } from './ledger';

export interface TakeoffReportOptions {
  projectName: string;
  planName?: string;
  measurements: Measurement[];
}

const BRAND = '#1e40af';
const LIGHT_GRAY = '#f3f4f6';
const MID_GRAY = '#9ca3af';
const DARK = '#111827';
const SUBTOTAL_BG = '#dbeafe';

function fmtVal(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs < 1) return value.toFixed(3);
  if (abs < 100) return value.toFixed(2);
  return value.toFixed(1);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export function generateTakeoffPdf(options: TakeoffReportOptions): void {
  const { projectName, planName, measurements } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR;

  const dateStr = new Date().toLocaleDateString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  // ── Header bar ──
  const [br, bg, bb] = hexToRgb(BRAND);
  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, pageW, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TAKEOFF REPORT', marginL, 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(dateStr, pageW - marginR, 10, { align: 'right' });
  doc.text(projectName, marginL, 17);
  if (planName) {
    doc.text(planName, pageW - marginR, 17, { align: 'right' });
  }

  // ── Summary strip ──
  let y = 28;
  const grandTotals = unitGrandTotals(measurements);
  const summaryItems: string[] = [
    `Measurements: ${measurements.length}`,
    ...grandTotals.map((gt) => `${gt.unit}: ${fmtVal(gt.total)}`),
  ];
  doc.setFillColor(...hexToRgb(LIGHT_GRAY));
  doc.rect(marginL, y, contentW, 8, 'F');
  doc.setTextColor(...hexToRgb(DARK));
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const colW = contentW / summaryItems.length;
  summaryItems.forEach((item, i) => {
    doc.text(item, marginL + colW * i + 2, y + 5.5);
  });

  y += 13;

  // ── Group tables ──
  const ordered = withOrdinals(measurements);
  const byGroup = new Map<string, typeof ordered>();
  for (const row of ordered) {
    const g = row.measurement.area || 'General';
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(row);
  }

  for (const [group, rows] of byGroup.entries()) {
    // Group label
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hexToRgb(BRAND));
    doc.text(group.toUpperCase(), marginL, y);
    y += 2;

    // Build table rows
    const bodyRows = rows.map(({ ordinal, measurement: m }) => [
      String(ordinal),
      m.type,
      m.label || '—',
      fmtVal(m.realValue),
      m.unit,
      String(m.pageIndex + 1),
    ]);

    // Subtotal rows
    const subs = groupSubtotals(rows.map((r) => r.measurement))[0];
    const subtotalRows: (string | { content: string; colSpan?: number; styles?: object })[][] = [];
    if (subs) {
      for (const [unit, total] of Object.entries(subs.totals)) {
        if (total === 0) continue;
        subtotalRows.push([
          { content: '', styles: {} },
          { content: `${group} subtotal`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: SUBTOTAL_BG } },
          { content: fmtVal(total), styles: { fontStyle: 'bold', fillColor: SUBTOTAL_BG } },
          { content: unit, styles: { fontStyle: 'bold', fillColor: SUBTOTAL_BG } },
          { content: '', styles: {} },
        ]);
      }
    }

    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [['#', 'Type', 'Label', 'Value', 'Unit', 'Page']],
      body: [...bodyRows, ...subtotalRows as string[][]],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.5, textColor: hexToRgb(DARK) },
      headStyles: { fillColor: hexToRgb(BRAND), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 22 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 20, halign: 'right' },
        4: { cellWidth: 18 },
        5: { cellWidth: 12, halign: 'center' },
      },
      didDrawPage: (data) => {
        const pg = (doc.internal as unknown as { getCurrentPageInfo(): { pageNumber: number } })
          .getCurrentPageInfo().pageNumber;
        const total = doc.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(...hexToRgb(MID_GRAY));
        doc.setFont('helvetica', 'normal');
        doc.text(
          `${projectName}  —  Page ${pg} of ${total}`,
          pageW / 2,
          pageH - 6,
          { align: 'center' },
        );
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

    if (y > pageH - 30) {
      doc.addPage();
      y = 20;
    }
  }

  // ── Grand totals ──
  if (grandTotals.length > 0) {
    if (y > pageH - 40) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hexToRgb(BRAND));
    doc.text('GRAND TOTALS', marginL, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [['Unit', 'Total', 'Count']],
      body: grandTotals.map((gt) => [gt.unit, fmtVal(gt.total), String(gt.count)]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: hexToRgb(BRAND), textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 30, halign: 'right' },
        2: { cellWidth: 20, halign: 'right' },
      },
    });
  }

  // ── Page footers on all pages ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...hexToRgb(MID_GRAY));
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${projectName}  —  Page ${i} of ${totalPages}`,
      pageW / 2,
      pageH - 6,
      { align: 'center' },
    );
  }

  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${safeName}_takeoff.pdf`);
}
