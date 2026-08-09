import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getUserStorageKey } from '@/lib/localAuth';
import type { FFESheet } from './types';
import { roomTotal, sheetTotal } from './storage';

// Metricore design system
const NAVY: [number, number, number]        = [9, 17, 31];
const CYAN: [number, number, number]        = [0, 200, 255];
const WHITE: [number, number, number]       = [255, 255, 255];
const DARK: [number, number, number]        = [20, 30, 50];
const MUTED: [number, number, number]       = [120, 140, 165];
const ROW_ALT: [number, number, number]     = [245, 248, 252];
const SUBTOTAL_BG: [number, number, number] = [232, 239, 250];

function fmt(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 });
}

function getBrand() {
  try {
    return JSON.parse(localStorage.getItem(getUserStorageKey('quote_brand')) || '{}');
  } catch {
    return {};
  }
}

function imgType(src: string): 'PNG' | 'JPEG' {
  return src.startsWith('data:image/png') || src.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
}

export async function exportFFEtoPDF(
  sheet: FFESheet,
  projectName: string,
  resolvedUrls: Record<string, string> = {},
): Promise<void> {
  const brand = getBrand();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ── Header bar ────────────────────────────────────────────────────────────
  const headerH = 26;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, headerH, 'F');

  // Cyan accent stripe at bottom of header
  doc.setFillColor(...CYAN);
  doc.rect(0, headerH - 1.5, pageW, 1.5, 'F');

  // Logo
  let titleX = margin;
  if (brand.logo) {
    try {
      const lw = Math.min((brand.logoSize ?? 1) * 22, 38);
      const lh = lw * 0.5;
      doc.addImage(brand.logo, imgType(brand.logo), margin, (headerH - lh) / 2, lw, lh);
      titleX = margin + lw + 5;
    } catch { /* skip bad logo */ }
  }

  // Title
  doc.setTextColor(...WHITE);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('FF&E SCHEDULE', titleX, 11);

  if (brand.companyName) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...CYAN);
    doc.text(brand.companyName.toUpperCase(), titleX, 19);
  }

  // Right: project name + date
  doc.setTextColor(...WHITE);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(projectName || 'Project', pageW - margin, 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(
    new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    pageW - margin, 17, { align: 'right' },
  );
  if (brand.abn) {
    doc.text(`ABN ${brand.abn}`, pageW - margin, 23, { align: 'right' });
  }

  let y = headerH + 8;

  // ── Rooms ──────────────────────────────────────────────────────────────────
  for (const room of sheet.rooms) {
    if (room.items.length === 0) continue;

    if (y > 255) { doc.addPage(); y = 14; }

    // Room heading with cyan left accent bar
    doc.setFillColor(...CYAN);
    doc.rect(margin, y - 3.5, 2, 6.5, 'F');

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(room.name.toUpperCase(), margin + 5, y);
    y += 3;

    const rows = room.items.map(item => {
      const photoCount = item.photos.filter(p => {
        const src = resolvedUrls[p.id] || p.localUrl;
        return !!src && (src.startsWith('data:') || src.startsWith('https://'));
      }).length;
      return [
        item.name,
        item.category,
        `${item.quantity} ${item.unit}`,
        item.supplier || '—',
        item.model || '—',
        fmt(item.supplyCost),
        fmt(item.installCost),
        fmt((item.supplyCost + item.installCost) * item.quantity),
        item.status,
        photoCount > 0 ? String(photoCount) : '—',
      ];
    });

    autoTable(doc, {
      startY: y + 2,
      head: [['Item', 'Category', 'Qty', 'Supplier', 'Model/Spec', 'Supply', 'Install', 'Total', 'Status', 'Photos']],
      body: rows,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
        textColor: DARK,
        lineColor: [215, 225, 240],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: NAVY,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      },
      alternateRowStyles: { fillColor: ROW_ALT },
      columnStyles: {
        0: { cellWidth: 34 },
        1: { cellWidth: 18 },
        2: { cellWidth: 11 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
        5: { cellWidth: 16, halign: 'right' },
        6: { cellWidth: 16, halign: 'right' },
        7: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
        8: { cellWidth: 16 },
        9: { cellWidth: 9,  halign: 'center' },
      },
      didDrawPage: (data) => { y = data.cursor?.y ?? y; },
    });

    y = (doc as any).lastAutoTable.finalY;

    // Subtotal row
    doc.setFillColor(...SUBTOTAL_BG);
    doc.rect(margin, y, pageW - margin * 2, 7.5, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(`${room.name} subtotal`, margin + 3, y + 4.8);
    doc.setTextColor(...CYAN);
    doc.text(fmt(roomTotal(room)), pageW - margin - 3, y + 4.8, { align: 'right' });
    y += 11;

    // Photo thumbnails below each item
    for (const item of room.items) {
      const photos = item.photos.filter(p => {
        const src = resolvedUrls[p.id] || p.localUrl;
        return !!src && (src.startsWith('data:') || src.startsWith('https://'));
      });
      if (photos.length === 0) continue;

      if (y > 252) { doc.addPage(); y = 14; }

      const THUMB = 24;
      const LABEL_W = 32;

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...MUTED);
      doc.text(`Photos — ${item.name}`, margin, y + THUMB / 2 + 2);

      let px = margin + LABEL_W;
      for (const photo of photos.slice(0, 6)) {
        const src = resolvedUrls[photo.id] || photo.localUrl;
        if (!src) continue;
        if (px + THUMB > pageW - margin) {
          px = margin + LABEL_W;
          y += THUMB + 3;
          if (y > 255) { doc.addPage(); y = 14; }
        }
        try {
          doc.setDrawColor(200, 215, 235);
          doc.setLineWidth(0.25);
          doc.rect(px - 0.5, y - 0.5, THUMB + 1, THUMB + 1, 'S');
          doc.addImage(src, imgType(src), px, y, THUMB, THUMB);
          px += THUMB + 3;
        } catch { /* skip unloadable photo */ }
      }
      y += THUMB + 6;
    }
  }

  // ── Grand total ────────────────────────────────────────────────────────────
  if (y > 260) { doc.addPage(); y = 14; }

  // Cyan divider
  doc.setFillColor(...CYAN);
  doc.rect(margin, y, pageW - margin * 2, 1, 'F');
  y += 7;

  const excl = sheetTotal(sheet);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text('Total FF&E (excl. GST)', margin, y);
  doc.setTextColor(...DARK);
  doc.text(fmt(excl), pageW - margin, y, { align: 'right' });
  y += 7;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text('GST (10%)', margin, y);
  doc.text(fmt(excl * 0.1), pageW - margin, y, { align: 'right' });
  y += 5;

  // Total incl. GST — navy block with cyan value
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, pageW - margin * 2, 9, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text('Total FF&E (incl. GST)', margin + 3, y + 5.8);
  doc.setTextColor(...CYAN);
  doc.text(fmt(excl * 1.1), pageW - margin - 3, y + 5.8, { align: 'right' });

  // ── Footer on every page ───────────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...NAVY);
    doc.rect(0, pageH - 8, pageW, 8, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(`Page ${i} of ${pageCount}`, pageW / 2, pageH - 3, { align: 'center' });
    doc.setTextColor(...CYAN);
    doc.text('Metricore', margin, pageH - 3);
  }

  const slug = (projectName || 'project').replace(/\s+/g, '-').toLowerCase();
  doc.save(`${slug}-ffe-schedule-${new Date().toISOString().split('T')[0]}.pdf`);
}
