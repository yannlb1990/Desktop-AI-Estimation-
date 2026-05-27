import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getUserStorageKey } from '@/lib/localAuth';
import type { FFESheet, FFERoom } from './types';
import { roomTotal, sheetTotal } from './storage';

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

export async function exportFFEtoPDF(sheet: FFESheet, projectName: string): Promise<void> {
  const brand = getBrand();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;

  // ── Header ──────────────────────────────────────────────────────────────────
  // Logo
  let logoH = 0;
  if (brand.logo) {
    try {
      const imgType = brand.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      const logoW = Math.min((brand.logoSize ?? 1) * 30, 50);
      logoH = logoW * 0.5;
      doc.addImage(brand.logo, imgType, margin, 10, logoW, logoH);
    } catch { /* skip bad logo */ }
  }

  const headerY = logoH > 0 ? 10 + logoH + 4 : 14;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FF&E Schedule', pageW - margin, headerY, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(projectName || 'Project', pageW - margin, headerY + 7, { align: 'right' });
  doc.text(new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }), pageW - margin, headerY + 13, { align: 'right' });

  if (brand.companyName) {
    doc.setFontSize(9);
    doc.text(brand.companyName, margin, headerY + 7);
    if (brand.abn) doc.text(`ABN ${brand.abn}`, margin, headerY + 13);
  }

  // Divider
  const dividerY = headerY + 18;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, dividerY, pageW - margin, dividerY);

  let cursorY = dividerY + 6;

  // ── Rooms ──────────────────────────────────────────────────────────────────
  for (const room of sheet.rooms) {
    if (room.items.length === 0) continue;

    // Check page space
    if (cursorY > 260) {
      doc.addPage();
      cursorY = 14;
    }

    // Room heading
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(room.name, margin, cursorY);
    cursorY += 5;

    const rows = room.items.map(item => [
      item.name,
      item.category,
      `${item.quantity} ${item.unit}`,
      item.supplier || '—',
      item.model || '—',
      fmt(item.supplyCost),
      fmt(item.installCost),
      fmt((item.supplyCost + item.installCost) * item.quantity),
      item.status,
    ]);

    autoTable(doc, {
      startY: cursorY,
      head: [['Item', 'Category', 'Qty', 'Supplier', 'Model/Spec', 'Supply', 'Install', 'Total', 'Status']],
      body: rows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [245, 245, 245], textColor: [50, 50, 50], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 20 },
        2: { cellWidth: 14 },
        3: { cellWidth: 24 },
        4: { cellWidth: 24 },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
        8: { cellWidth: 18 },
      },
      didDrawPage: (data) => { cursorY = data.cursor?.y ?? cursorY; },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 4;

    // Room subtotal
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(`${room.name} subtotal:`, pageW - margin - 50, cursorY, { align: 'left' });
    doc.text(fmt(roomTotal(room)), pageW - margin, cursorY, { align: 'right' });
    cursorY += 8;

    // Photos for this room (thumbnails, up to 3 per item)
    for (const item of room.items) {
      const photos = item.photos.filter(p => p.supabaseUrl || p.localUrl);
      if (photos.length === 0) continue;

      if (cursorY > 250) { doc.addPage(); cursorY = 14; }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text(`Photos — ${item.name}`, margin, cursorY);
      cursorY += 3;

      let photoX = margin;
      const photoSize = 28;
      for (const photo of photos.slice(0, 4)) {
        const src = photo.supabaseUrl || photo.localUrl;
        try {
          const imgType = src.includes('png') ? 'PNG' : 'JPEG';
          doc.addImage(src, imgType, photoX, cursorY, photoSize, photoSize);
          photoX += photoSize + 3;
          if (photoX + photoSize > pageW - margin) { photoX = margin; cursorY += photoSize + 3; }
        } catch { /* skip unloadable image */ }
      }
      cursorY += photoSize + 6;
    }
  }

  // ── Grand total ────────────────────────────────────────────────────────────
  if (cursorY > 265) { doc.addPage(); cursorY = 14; }
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, cursorY, pageW - margin, cursorY);
  cursorY += 6;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('Total FF&E (excl. GST)', margin, cursorY);
  doc.text(fmt(sheetTotal(sheet)), pageW - margin, cursorY, { align: 'right' });
  cursorY += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`GST (10%)`, margin, cursorY);
  doc.text(fmt(sheetTotal(sheet) * 0.1), pageW - margin, cursorY, { align: 'right' });
  cursorY += 6;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('Total FF&E (incl. GST)', margin, cursorY);
  doc.text(fmt(sheetTotal(sheet) * 1.1), pageW - margin, cursorY, { align: 'right' });

  // ── Page numbers ───────────────────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${pageCount}`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  const slug = (projectName || 'project').replace(/\s+/g, '-').toLowerCase();
  doc.save(`${slug}-ffe-schedule-${new Date().toISOString().split('T')[0]}.pdf`);
}
