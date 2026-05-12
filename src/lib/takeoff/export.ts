import { Measurement, CostItem } from "./types";

// ─── BOQ Export (professional QS format, matches TCA/Rawlinsons BOQ structure) ─────────────

export interface BOQExportOptions {
  projectName: string;
  projectLocation?: string;
  state?: string;
  costItems: CostItem[];
  contingencyPercent?: number;
  marginPercent?: number;
  includeGST?: boolean;
}

const TRADE_ORDER = [
  'Preliminaries', 'Scaffolding', 'Demolition', 'Civil', 'Site Works',
  'Concrete', 'Formwork', 'Reinforcement', 'Structural Steel', 'Metalwork',
  'Roofing', 'External Works', 'External Cladding', 'Ceilings & Partitions',
  'Plasterboard', 'Carpentry', 'Brickwork', 'Waterproofing', 'Joinery',
  'Windows & Doors', 'Tiling', 'Floor Coverings', 'Epoxy Flooring',
  'Painting', 'Plumbing', 'Electrical', 'HVAC', 'Fire Services', 'Landscaping',
  'Crane / Lifting', 'Certifications', 'General', 'Other',
];

function esc(v: string | number): string {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function $$(n: number): string {
  return n > 0 ? `$${n.toFixed(2)}` : '-';
}

export function exportToBOQCsv(opts: BOQExportOptions): string {
  const {
    projectName, projectLocation = '', state = 'QLD',
    costItems, contingencyPercent = 0, marginPercent = 0, includeGST = true,
  } = opts;

  const lines: string[] = [];
  const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });

  // Header block
  lines.push(`PROJECT,${esc(projectName)}`);
  lines.push(`LOCATION,${esc(projectLocation)}`);
  lines.push(`STATE,${esc(state)}`);
  lines.push(`DATE,${esc(dateStr)}`);
  lines.push('');

  const COL = 'ITEM,DESCRIPTION,QTY,UNIT,LABOUR,MATERIALS,PLANT,MISC,SUBCONTRACTOR,RATE,TOTAL,COMMENTS';
  lines.push(COL);

  // Group by trade, sort
  const byTrade = new Map<string, CostItem[]>();
  for (const item of costItems) {
    const t = item.trade || 'General';
    if (!byTrade.has(t)) byTrade.set(t, []);
    byTrade.get(t)!.push(item);
  }

  const trades = [...byTrade.keys()].sort((a, b) => {
    const ai = TRADE_ORDER.indexOf(a); const bi = TRADE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  let tradeIdx = 0;
  let grandTotal = 0;

  const summaryRows: string[] = [];

  for (const trade of trades) {
    tradeIdx++;
    const items = byTrade.get(trade)!;

    // Trade section header
    lines.push('');
    lines.push(`${tradeIdx}.0,${esc(trade.toUpperCase())},,,,,,,,,,`);

    let sectionTotal = 0;

    items.forEach((item, lineIdx) => {
      const matWaste = item.materialWastePercent ?? 5;
      const labWaste = item.labourWastePercent ?? 10;
      const hrs = item.laborHours ?? 0;
      const rate = item.hourlyRate ?? 65;

      const matTotal = item.quantity * item.unitCost * (1 + matWaste / 100);
      const labTotal = hrs * rate * (1 + labWaste / 100);
      const subTotal = item.subtotal > 0 ? item.subtotal : matTotal + labTotal;

      // Detect if item is effectively a subcontractor lump sum (no breakdown)
      const isSub = item.laborHours === undefined && item.unitCost > 0;
      const labStr  = isSub ? '' : $$(labTotal);
      const matStr  = isSub ? '' : $$(matTotal);
      const subStr  = isSub ? $$(subTotal) : '';
      const rateStr = item.unitCost > 0 ? $$(item.unitCost) : '';

      const itemNum = `${tradeIdx}.${String(lineIdx + 1).padStart(2, '0')}`;
      const desc = esc(item.name || item.description || '');
      const comments = esc(item.comments || item.notes || '');

      lines.push([
        itemNum, desc,
        item.quantity > 0 ? item.quantity.toFixed(2) : '-',
        esc(item.unit || ''),
        labStr, matStr, '', '', subStr,
        rateStr, $$(subTotal), comments,
      ].join(','));

      sectionTotal += subTotal;
    });

    // Section subtotal
    lines.push([
      '', esc(`${trade.toUpperCase()} SUBTOTAL`),
      '', '', '', '', '', '', '', '',
      $$(sectionTotal), '',
    ].join(','));

    summaryRows.push([esc(tradeIdx.toString()), esc(trade), '', '', '', '', '', '', '', '', $$(sectionTotal), ''].join(','));
    grandTotal += sectionTotal;
  }

  // Summary table
  lines.push('');
  lines.push('');
  lines.push('SUMMARY,,,,,,,,,,');
  lines.push(COL);
  lines.push(...summaryRows);

  // Contingency
  const contingency = grandTotal * (contingencyPercent / 100);
  if (contingencyPercent > 0) {
    lines.push(['', esc(`CONTINGENCY (${contingencyPercent}%)`), '', '', '', '', '', '', '', '', $$(contingency), ''].join(','));
  }

  // Margin
  const margin = (grandTotal + contingency) * (marginPercent / 100);
  if (marginPercent > 0) {
    lines.push(['', esc(`MARGIN (${marginPercent}%)`), '', '', '', '', '', '', '', '', $$(margin), ''].join(','));
  }

  const subTotalWithAdditions = grandTotal + contingency + margin;
  const gst = includeGST ? subTotalWithAdditions * 0.1 : 0;
  const totalInclGST = subTotalWithAdditions + gst;

  lines.push(['', 'PROJECT TOTAL (ex GST)', '', '', '', '', '', '', '', '', $$(subTotalWithAdditions), ''].join(','));
  if (includeGST) {
    lines.push(['', 'GST (10%)', '', '', '', '', '', '', '', '', $$(gst), ''].join(','));
    lines.push(['', 'PROJECT TOTAL (inc GST)', '', '', '', '', '', '', '', '', $$(totalInclGST), ''].join(','));
  }

  return lines.join('\n');
}

const CSV_HEADERS = [
  "label",
  "type",
  "unit",
  "realValue",
  "worldValue",
  "pageIndex",
  "timestamp",
  "points"
];

function sanitizeValue(value: string | number | boolean) {
  const stringValue = String(value ?? "");
  if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes("\"")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function exportMeasurementsToCSV(measurements: Measurement[]): string {
  const rows = measurements.map((measurement) => {
    const pointString = measurement.worldPoints
      .map((p) => `${p.x.toFixed(2)}:${p.y.toFixed(2)}`)
      .join("|");

    return [
      sanitizeValue(measurement.label),
      sanitizeValue(measurement.type),
      sanitizeValue(measurement.unit),
      sanitizeValue(measurement.realValue.toFixed(3)),
      sanitizeValue(measurement.worldValue.toFixed(3)),
      sanitizeValue(measurement.pageIndex + 1),
      sanitizeValue(measurement.timestamp instanceof Date ? measurement.timestamp.toISOString() : String(measurement.timestamp)),
      sanitizeValue(pointString)
    ].join(",");
  });

  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export function exportMeasurementsToJSON(measurements: Measurement[]): string {
  return JSON.stringify(
    measurements.map((m) => ({
      ...m,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
    })),
    null,
    2
  );
}
