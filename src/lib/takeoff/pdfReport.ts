import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Measurement } from './types';
import { groupSubtotals, unitGrandTotals, withOrdinals } from './ledger';

export interface TakeoffReportOptions {
  projectName: string;
  planName?: string;
  measurements: Measurement[];
}

export interface AnnotatedTakeoffOptions {
  projectName: string;
  planName?: string;
  measurements: Measurement[];
  canvasDataUrl: string; // PNG data URL from fabric.js canvas
  canvasWidth?: number;  // actual pixel width of the canvas element
  canvasHeight?: number; // actual pixel height of the canvas element
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

// ── Shared table helper ────────────────────────────────────────────────────────

function addMeasurementTables(
  doc: jsPDF,
  measurements: Measurement[],
  projectName: string,
  startY: number,
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR;
  let y = startY;

  const grandTotals = unitGrandTotals(measurements);

  // Summary strip
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

  const ordered = withOrdinals(measurements);
  const byGroup = new Map<string, typeof ordered>();
  for (const row of ordered) {
    const g = row.measurement.area || 'General';
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(row);
  }

  for (const [group, rows] of byGroup.entries()) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hexToRgb(BRAND));
    doc.text(group.toUpperCase(), marginL, y);
    y += 2;

    const bodyRows = rows.map(({ ordinal, measurement: m }) => [
      String(ordinal),
      m.type,
      m.label || '—',
      fmtVal(m.realValue),
      m.unit,
      String(m.pageIndex + 1),
    ]);

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
      didDrawPage: () => {
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

  if (grandTotals.length > 0) {
    if (y > pageH - 40) { doc.addPage(); y = 20; }
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
}

// ── Annotated takeoff PDF ─────────────────────────────────────────────────────

export function generateAnnotatedTakeoffPdf(options: AnnotatedTakeoffOptions): void {
  const { projectName, planName, measurements, canvasDataUrl, canvasWidth, canvasHeight } = options;

  // A3 landscape for the plan page
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 14;
  const marginR = 14;
  const headerH = 22;
  const legendH = 48;
  const footerH = 10;

  const dateStr = new Date().toLocaleDateString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  // ── Page 1: Plan image ───────────────────────────────────────────────────────
  const [br, bg, bb] = hexToRgb(BRAND);
  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, pageW, headerH, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ANNOTATED TAKEOFF', marginL, 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(dateStr, pageW - marginR, 10, { align: 'right' });
  doc.text(projectName, marginL, 17);
  if (planName) doc.text(planName, pageW - marginR, 17, { align: 'right' });

  // Available space for the plan image
  const imgAreaTop = headerH + 4;
  const imgAreaBottom = pageH - legendH - footerH;
  const imgAreaH = imgAreaBottom - imgAreaTop;
  const imgAreaW = pageW - marginL - marginR;

  // Fit image preserving aspect ratio — we parse dimensions from a temp Image
  // jsPDF accepts dataUrl directly; we compute display size from a 1:1 pixel ratio assumption.
  // Use imgAreaW/imgAreaH as max bounds.
  const img = new Image();
  img.src = canvasDataUrl;
  // Use caller-supplied canvas dimensions first, then naturalWidth (available synchronously
  // for data URLs in most browsers), then fall back to the PDF area dimensions.
  const natW = img.naturalWidth || canvasWidth || imgAreaW;
  const natH = img.naturalHeight || canvasHeight || imgAreaH;
  const scale = Math.min(imgAreaW / natW, imgAreaH / natH);
  const dispW = natW * scale;
  const dispH = natH * scale;
  const imgX = marginL + (imgAreaW - dispW) / 2;

  doc.addImage(canvasDataUrl, 'PNG', imgX, imgAreaTop, dispW, dispH);

  // ── Colour legend ─────────────────────────────────────────────────────────────
  const legendTop = pageH - legendH - footerH + 2;
  doc.setFillColor(...hexToRgb(LIGHT_GRAY));
  doc.rect(marginL, legendTop, pageW - marginL - marginR, legendH - 4, 'F');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRgb(BRAND));
  doc.text('MEASUREMENT LEGEND', marginL + 2, legendTop + 5);

  // Unique colours with their first label+value
  const seen = new Map<string, { label: string; value: string; unit: string }>();
  for (const m of measurements) {
    const colour = m.color || '#3b82f6';
    if (!seen.has(colour)) {
      seen.set(colour, {
        label: m.label || m.type,
        value: fmtVal(m.realValue),
        unit: m.unit,
      });
    }
  }

  const entries = Array.from(seen.entries());
  const colsPerRow = 6;
  const entryW = (pageW - marginL - marginR - 4) / colsPerRow;
  const swatchSize = 4;

  entries.slice(0, 24).forEach((entry, idx) => {
    const [colour, info] = entry;
    const col = idx % colsPerRow;
    const row = Math.floor(idx / colsPerRow);
    const ex = marginL + 2 + col * entryW;
    const ey = legendTop + 10 + row * 12;

    const [cr, cg, cb] = hexToRgb(colour);
    doc.setFillColor(cr, cg, cb);
    doc.rect(ex, ey, swatchSize, swatchSize, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...hexToRgb(DARK));
    const labelText = info.label.length > 18 ? info.label.slice(0, 17) + '…' : info.label;
    doc.text(`${labelText}  ${info.value} ${info.unit}`, ex + swatchSize + 1.5, ey + swatchSize - 0.5);
  });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(...hexToRgb(MID_GRAY));
  doc.setFont('helvetica', 'normal');
  doc.text(`${projectName}  —  Page 1  ·  Annotated plan`, pageW / 2, pageH - 4, { align: 'center' });

  // ── Page 2+: Measurement tables (A4 portrait) ─────────────────────────────────
  if (measurements.length > 0) {
    doc.addPage('a4', 'portrait');
    const p2W = doc.internal.pageSize.getWidth();
    const p2H = doc.internal.pageSize.getHeight();
    const ml = 14;
    const mr = 14;

    doc.setFillColor(br, bg, bb);
    doc.rect(0, 0, p2W, headerH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TAKEOFF REPORT', ml, 10);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(dateStr, p2W - mr, 10, { align: 'right' });
    doc.text(projectName, ml, 17);

    addMeasurementTables(doc, measurements, projectName, headerH + 6);

    // Re-stamp all pages with correct total count
    const totalPages = doc.getNumberOfPages();
    for (let i = 2; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(...hexToRgb(MID_GRAY));
      doc.setFont('helvetica', 'normal');
      doc.text(
        `${projectName}  —  Page ${i} of ${totalPages}`,
        p2W / 2,
        p2H - 6,
        { align: 'center' },
      );
    }
  }

  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${safeName}_annotated.pdf`);
}
