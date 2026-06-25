import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ProgressClaimStage {
  id: string;
  name: string;
  value: number;
  percentComplete: number;
}

export interface ProgressClaimOptions {
  projectName: string;
  siteAddress: string;
  clientName: string;
  state: string;
  claimNumber: number;
  claimDate: string;
  contractSum: number;
  retentionPct: number;
  previouslyClaimed: number;
  stages: ProgressClaimStage[];
  contractorName: string;
  contractorAbn: string;
}

const BRAND = '#1e40af';
const LIGHT_GRAY = '#f3f4f6';
const DARK = '#111827';
const MID_GRAY = '#9ca3af';
const WARNING_BG = '#fef9c3';
const WARNING_BORDER = '#ca8a04';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function fmt(n: number): string {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface SopaInfo {
  act: string;
  days: number;
}

function getSopaInfo(state: string): SopaInfo {
  switch (state.toUpperCase()) {
    case 'QLD':
      return { act: 'Building Industry Fairness (Security of Payment) Act 2017 (QLD)', days: 15 };
    case 'VIC':
      return { act: 'Building and Construction Industry Security of Payment Act 2002 (VIC)', days: 10 };
    case 'WA':
      return { act: 'Construction Contracts Act 2004 (WA)', days: 12 };
    case 'SA':
      return { act: 'Building and Construction Industry Security of Payment Act 2009 (SA)', days: 15 };
    case 'ACT':
      return { act: 'Building and Construction Industry (Security of Payment) Act 2009 (ACT)', days: 10 };
    case 'TAS':
      return { act: 'Building and Construction Industry Security of Payment Act 2009 (TAS)', days: 10 };
    default:
      return { act: 'Building and Construction Industry Security of Payment Act 1999 (NSW)', days: 10 };
  }
}

export function generateProgressClaimPdf(options: ProgressClaimOptions): void {
  const {
    projectName, siteAddress, clientName, state,
    claimNumber, claimDate, contractSum, retentionPct,
    previouslyClaimed, stages, contractorName, contractorAbn,
  } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR;

  const sopa = getSopaInfo(state);
  const claimDateFormatted = new Date(claimDate).toLocaleDateString('en-AU', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // ── Header bar ──────────────────────────────────────────────────────────────
  const [br, bg, bb] = hexToRgb(BRAND);
  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PROGRESS CLAIM', marginL, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Claim No. ${claimNumber}`, pageW - marginR, 10, { align: 'right' });
  doc.text(claimDateFormatted, pageW - marginR, 17, { align: 'right' });

  doc.setFontSize(8.5);
  doc.text(contractorName, marginL, 20);
  if (contractorAbn) {
    doc.text(`ABN: ${contractorAbn}`, marginL, 25);
  }

  let y = 35;

  // ── Project / client info ────────────────────────────────────────────────────
  doc.setFillColor(...hexToRgb(LIGHT_GRAY));
  doc.rect(marginL, y, contentW, 18, 'F');

  doc.setTextColor(...hexToRgb(DARK));
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PROJECT', marginL + 3, y + 5);
  doc.text('CLIENT', marginL + 3 + contentW / 2, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(projectName, marginL + 3, y + 10);
  doc.text(siteAddress || '—', marginL + 3, y + 15);
  doc.text(clientName || '—', marginL + 3 + contentW / 2, y + 10);

  y += 23;

  // ── SOPA Notice box ─────────────────────────────────────────────────────────
  const [wr, wg, wb] = hexToRgb(WARNING_BG);
  doc.setFillColor(wr, wg, wb);
  doc.setDrawColor(...hexToRgb(WARNING_BORDER));
  doc.setLineWidth(0.5);
  doc.rect(marginL, y, contentW, 20, 'FD');

  doc.setTextColor(...hexToRgb(DARK));
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT CLAIM — SECURITY OF PAYMENT ACT NOTICE', marginL + 3, y + 5);

  doc.setFont('helvetica', 'normal');
  const sopaText = doc.splitTextToSize(
    `This is a Payment Claim made under the ${sopa.act}. ` +
    `The respondent has ${sopa.days} business days from receipt of this claim to provide a Payment Schedule. ` +
    `Failure to respond may result in the claimant becoming entitled to the claimed amount.`,
    contentW - 6,
  );
  doc.text(sopaText, marginL + 3, y + 10);

  y += 26;

  // ── Stages table ─────────────────────────────────────────────────────────────
  doc.setTextColor(...hexToRgb(BRAND));
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('CLAIM BREAKDOWN', marginL, y);
  y += 3;

  const tableBody = stages.map((stage) => {
    const valueClaimed = stage.value * (stage.percentComplete / 100);
    // Apportion previous claims across stages by value weighting
    const stageWeight = contractSum > 0 ? stage.value / contractSum : 0;
    const stagePrevious = previouslyClaimed * stageWeight;
    const thisClaim = Math.max(0, valueClaimed - stagePrevious);
    return [
      stage.name,
      `$${fmt(stage.value)}`,
      `${stage.percentComplete}%`,
      `$${fmt(valueClaimed)}`,
      `$${fmt(stagePrevious)}`,
      `$${fmt(thisClaim)}`,
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginR },
    head: [['Stage', 'Contract Value', '% Complete', 'Value Claimed', 'Prev. Claimed', 'This Claim']],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, textColor: hexToRgb(DARK) },
    headStyles: { fillColor: hexToRgb(BRAND), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 28, halign: 'right' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ── Summary box ──────────────────────────────────────────────────────────────
  const totalValueClaimed = stages.reduce((s, st) => s + st.value * (st.percentComplete / 100), 0);
  const retentionAmount = totalValueClaimed * (retentionPct / 100);
  const amountExcRetention = totalValueClaimed - retentionAmount - previouslyClaimed;
  const netClaim = Math.max(0, amountExcRetention);
  const gst = netClaim * 0.1;
  const totalDue = netClaim + gst;

  if (y > pageH - 65) {
    doc.addPage();
    y = 20;
  }

  doc.setTextColor(...hexToRgb(BRAND));
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT SUMMARY', marginL, y);
  y += 3;

  const summaryRows = [
    ['Contract Sum', `$${fmt(contractSum)}`],
    [`Retention (${retentionPct}%)`, `($${fmt(retentionAmount)})`],
    ['Previously Claimed', `($${fmt(previouslyClaimed)})`],
    ['Amount Excluding Retention & Prior Claims', `$${fmt(netClaim)}`],
    ['GST (10%)', `$${fmt(gst)}`],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: marginL + contentW / 2, right: marginR },
    head: [['Description', 'Amount (AUD)']],
    body: summaryRows,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: hexToRgb(DARK) },
    headStyles: { fillColor: hexToRgb(BRAND), textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 30, halign: 'right' },
    },
    foot: [['TOTAL DUE THIS CLAIM (incl. GST)', `$${fmt(totalDue)}`]],
    footStyles: { fillColor: hexToRgb(BRAND), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // ── Footer on all pages ───────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...hexToRgb(MID_GRAY));
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Claim submitted under SOPA — Payment due within ${sopa.days} business days of claim date  |  ${projectName}  —  Page ${i} of ${totalPages}`,
      pageW / 2,
      pageH - 6,
      { align: 'center' },
    );
  }

  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${safeName}_progress_claim_${claimNumber}.pdf`);
}
