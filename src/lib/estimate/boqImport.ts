/**
 * Reading a bill of quantities (BOQ) into estimate lines. The file has already been turned
 * into rows of cells (Excel, CSV or PDF); this works out the columns, follows the trade and
 * room headings, joins descriptions that run over several rows, leaves out subtotal and
 * "carried forward" rows (importing them counts the work twice), spots PC and PS sums,
 * and checks the rows add up to the BOQ's own total.
 */
import { normaliseTrade, isKnownTrade, type TradeName } from '@/lib/trades';

export interface BoqColumns {
  item: number; description: number; qty: number; unit: number; rate: number; amount: number;
  /** the header row, or -1 when the columns were guessed */
  headerRow: number;
}

export interface BoqRow {
  /** row number in the file (1 = first row) */
  line: number;
  itemNo: string;
  /** the BOQ's own words, joined over rows */
  text: string;
  trade: string;
  scope: string;
  area: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  allowance?: 'PC' | 'PS';
  /** things to look at before importing */
  issues: string[];
}

export interface BoqParse {
  columns: BoqColumns;
  rows: BoqRow[];
  skipped: { line: number; text: string; reason: string }[];
  /** the BOQ's own total, when it has one */
  boqTotal: number | null;
}

const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** "$1,250.50", "1 250", "(300)" and "-" read as numbers; anything else as NaN */
export function parseNumber(s: unknown): number {
  let t = clean(s).replace(/[$\s]|AUD/gi, '').replace(/,/g, '');
  if (!t || t === '-' || t === '–') return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (!/^-?\d*\.?\d+$/.test(t)) return NaN;
  const n = Number(t);
  return neg ? -n : n;
}

export function normaliseUnit(u: string): string {
  const s = clean(u).toLowerCase().replace(/\.$/, '');
  if (!s) return '';
  if (/^(m2|m²|sqm|sq ?m|m\^2)$/.test(s)) return 'm²';
  if (/^(m3|m³|cum|cu ?m|m\^3)$/.test(s)) return 'm³';
  if (/^(m|lm|l\/m|lin ?m|lineal ?m|metres?|mtr)$/.test(s)) return 'lm';
  if (/^(no|nr|ea|each|no\.|pcs?|qty|unit|units)$/.test(s)) return 'ea';
  if (/^(item|items|ls|l\/s|lump ?sum|sum|prov|ps|pc|allow|lot|job)$/.test(s)) return 'item';
  if (/^(t|tonnes?|tonne)$/.test(s)) return 't';
  if (/^(kg|kgs)$/.test(s)) return 'kg';
  if (/^(hrs?|hours?)$/.test(s)) return 'hr';
  if (/^(wk|weeks?)$/.test(s)) return 'wk';
  return clean(u);
}

/** Words that name a trade, checked in order (more specific first). */
const TRADE_WORDS: [RegExp, TradeName][] = [
  [/\bpreliminar|site establishment|site amenit|site supervision|temporary fenc/i, 'Preliminaries'],
  [/\bdemoli|strip ?out|remove existing|asbestos/i, 'Demolition'],
  [/\btermite|pest barrier/i, 'Termite Protection'],
  [/\bgarage door|roller door|panel ?lift/i, 'Garage Doors'],
  [/\bshower screen|mirror|shaving cabinet/i, 'Shower Screens & Mirrors'],
  [/\bbalustrad|handrail/i, 'Balustrades & Metalwork'],
  [/\bscaffold|edge protection/i, 'Scaffolding'],
  [/\bskip bin|rubbish|builders clean|final clean|waste removal/i, 'Waste & Cleaning'],
  [/\bcertif|home warranty|hbcf|qbcc|council fee|engineer|basix|energy rating|insurance|permit/i, 'Certifications'],
  [/\bwaterproof|membrane|tanking/i, 'Waterproofing'],
  [/\bvanity|cabinet|benchtop|joinery|kitchen|pantry|robe|linen|cupboard|kickboard/i, 'Joinery'],
  [/\bappliance|oven|cooktop|rangehood|dishwasher/i, 'Appliances'],
  [/\bsplit system|ducted|air ?con|hvac|mechanical/i, 'HVAC'],
  [/\bsolar|switchboard|power point|\bgpo|downlight|light point|lighting|smoke (alarm|detector)|exhaust fan|data point|electric/i, 'Electrical'],
  [/\bhydraulic|plumb|sewer|stormwater|drainage|downpipe connection|hot water|toilet|\bwc\b|basin|tapware|\btap\b|floor waste|gas (line|fitting)|rainwater tank/i, 'Plumbing'],
  [/\bsarking|colorbond|roof|gutter|fascia|downpipe|ridge|flashing/i, 'Roofing'],
  [/\bwindow|sliding door|stacker|glazing|fly ?screen/i, 'Windows & Doors'],
  [/\brender/i, 'Render'],
  [/\bbrick|block ?work|masonry/i, 'Brickwork'],
  [/\bcladding|weatherboard|eaves lining|wall wrap/i, 'Cladding'],
  [/\binsulat|\bbatts\b/i, 'Insulation'],
  [/\bplasterboard|gyprock|cornice|square set|bulkhead|wet area board/i, 'Plasterboard'],
  [/\btile|tiling|grout|screed/i, 'Tiling'],
  [/\bpaint/i, 'Painting'],
  [/\bepoxy|polished concrete|grind and seal/i, 'Epoxy Flooring'],
  [/\bcarpet|vinyl|floating floor|laminate floor|hybrid floor|timber floor|floor covering|engineered timber/i, 'Floor Coverings'],
  [/\bstructural steel|steel beam|steel post|\bub\b|\bpfc\b|\bshs\b|\brhs\b/i, 'Structural Steel'],
  [/\bconcrete|slab|footing|\bpier|reinforc|\bmesh\b|\breo\b|formwork|pump hire/i, 'Concrete'],
  [/\bexcavat|earthwork|site clear|\bfill\b|compact|trench|cut and fill/i, 'Site Works'],
  [/\bframe|framing|stud|truss|joist|bearer|noggin|lintel|yellow ?tongue|skirting|architrave|door (hang|install)|hang door|\bdoors?\b|deck|pergola|stair|carpent/i, 'Carpentry'],
  [/\bfence|fencing|gate/i, 'Fencing'],
  [/\bpaving|driveway|path|crossover|letterbox|clothesline/i, 'External Works'],
  [/\bturf|landscap|garden|mulch|planting|retaining/i, 'Landscaping'],
  [/\bcrane|lifting/i, 'Crane / Lifting'],
];

/** The trade a piece of text points to, or '' when it doesn't name one. */
export function tradeFromText(text: string): string {
  const t = clean(text);
  if (!t) return '';
  const direct = normaliseTrade(t.replace(/^[\d.\s-]+/, '').replace(/[:.]+$/, ''));
  if (isKnownTrade(direct)) return direct;
  for (const [re, trade] of TRADE_WORDS) if (re.test(t)) return trade;
  return '';
}

const AREA_RE = /\b(master bed(room)?|bed(room)?\s*\d*|ensuite\s*\d*|bath(room)?\s*\d*|kitchen|butler'?s pantry|laundry|living( room)?|dining( room)?|family( room)?|lounge|rumpus|media( room)?|theatre|study|office|garage|carport|alfresco|patio|deck|balcony|porch|verandah|entry|hallway|hall|powder( room)?|\bwc\b|walk[- ]in robe|wir|pantry|stairs?|granny flat|external|outdoor)\b/i;
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\bWc\b/, 'WC').replace(/\bWir\b/, 'WIR');

/** The room a heading names ("Bathroom 2 - Tiling" is Bathroom 2), or '' */
export function areaFromText(text: string): string {
  const m = clean(text).match(AREA_RE);
  return m ? titleCase(m[0]).trim() : '';
}

const TOTAL_RE = /^(sub[- ]?total|total|grand total|carried (forward|to|over)|brought forward|c\/f|b\/f|page total|section total|trade total|summary|balance)\b/i;
const PC_RE = /\b(p\.?\s?c\.?(\s*(sum|item|allowance))?|prime cost)\b/i;
const PS_RE = /\b(p\.?\s?s\.?(\s*(sum|allowance))?|provisional sum|provisional allowance)\b/i;

/** Which column is which: from a header row if there is one, else from what the cells hold. */
export function detectColumns(rows: string[][]): BoqColumns {
  const cols: BoqColumns = { item: -1, description: -1, qty: -1, unit: -1, rate: -1, amount: -1, headerRow: -1 };
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const cells = rows[r].map(c => clean(c).toLowerCase());
    const find = (re: RegExp) => cells.findIndex(c => re.test(c));
    const description = find(/^(description|item description|description of work|scope|details|particulars|work)/);
    const qty = find(/^(qty|quantity|quant\.?|no\.? of)\b/);
    if (description !== -1 && qty !== -1) {
      cols.headerRow = r;
      cols.description = description;
      cols.qty = qty;
      cols.unit = find(/^(unit|units|uom|u\/m)$/);
      cols.rate = find(/^(rate|unit rate|unit price|unit cost|\$\/unit|price)\b/);
      cols.amount = cells.findIndex((c, i) => i !== cols.rate && /^(amount|total|extension|extended|sum|cost|value|\$)\b/.test(c));
      cols.item = cells.findIndex((c, i) => i < description && /^(item|ref|no\.?|code|#|clause)\b/.test(c));
      return cols;
    }
  }
  // No header: the longest text column is the description; numbers after it are qty, rate, amount
  const width = Math.max(0, ...rows.map(r => r.length));
  const textLen = Array.from({ length: width }, (_, i) => rows.reduce((s, r) => s + (isNaN(parseNumber(r[i])) ? clean(r[i]).length : 0), 0));
  cols.description = textLen.indexOf(Math.max(...textLen));
  const numeric = Array.from({ length: width }, (_, i) => i).filter(i => i > cols.description &&
    rows.filter(r => !isNaN(parseNumber(r[i]))).length >= Math.max(2, rows.length * 0.2));
  const unitCol = Array.from({ length: width }, (_, i) => i).find(i => i > cols.description &&
    rows.filter(r => /^(m2|m²|m3|m³|m|lm|no|nr|ea|item|ls|sum)$/i.test(clean(r[i]))).length >= 2);
  cols.unit = unitCol ?? -1;
  [cols.qty, cols.rate, cols.amount] = [numeric[0] ?? -1, numeric[1] ?? -1, numeric[2] ?? -1];
  if (cols.description > 0) cols.item = 0;
  return cols;
}

/** A description fit for the estimate: no leading numbering, first letter capitalised. */
export function cleanScope(text: string): string {
  const t = clean(text).replace(/^(\(?[a-z]\)|[\d]+(\.[\d]+)*[.)]?)\s+/i, '');
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

export function parseBoq(rows: string[][]): BoqParse {
  const columns = detectColumns(rows);
  const out: BoqRow[] = [];
  const skipped: BoqParse['skipped'] = [];
  let boqTotal: number | null = null;
  let headingTrade = '';
  let headingArea = '';
  let pending: string[] = [];
  let pendingItem = '';
  const cell = (r: string[], i: number) => (i >= 0 ? clean(r[i]) : '');

  for (let r = columns.headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    const line = r + 1;
    const itemNo = cell(row, columns.item);
    let desc = cell(row, columns.description);
    // text sitting in another column (a merged or shifted cell) still belongs to the description
    if (!desc) desc = row.map(clean).filter((c, i) => c && i !== columns.qty && i !== columns.rate && i !== columns.amount && i !== columns.unit && i !== columns.item && isNaN(parseNumber(c))).join(' ');
    const qty = parseNumber(cell(row, columns.qty));
    const rate = parseNumber(cell(row, columns.rate));
    const amount = parseNumber(cell(row, columns.amount));
    const unitRaw = cell(row, columns.unit);
    const priced = (qty > 0) || (amount > 0) || (rate > 0 && !isNaN(qty));
    const label = `${itemNo} ${desc}`.trim();
    if (!label && !priced) continue;

    // Subtotals and carried-forward rows repeat amounts already counted
    if (TOTAL_RE.test(desc) || TOTAL_RE.test(itemNo)) {
      if (/^(grand total|total)\b/i.test(desc || itemNo) && amount > 0) boqTotal = amount;
      skipped.push({ line, text: label, reason: 'Subtotal or carried forward: already counted in its rows' });
      continue;
    }

    if (!priced) {
      // A short line, in capitals, numbered like 3.0, or naming a trade or room, is a heading
      const letters = desc.replace(/[^A-Za-z]/g, '');
      const caps = letters.length > 2 && letters === letters.toUpperCase();
      const numbered = /^\d+(\.0)?$|^[A-Z]$/.test(itemNo) || /^\d+(\.0)?\s/.test(desc);
      const areaHere = areaFromText(desc);
      // "KITCHEN" names a room, not the joinery trade: the trade comes from what is left
      const tradeHere = tradeFromText(areaHere ? desc.replace(AREA_RE, ' ') : desc);
      const isHeading = desc.length <= 80 && (caps || numbered || /:$/.test(desc) || (desc.split(' ').length <= 5 && (!!tradeHere || !!areaHere)));
      if (isHeading) {
        if (pending.length && out.length) out[out.length - 1].text += ` ${pending.join(' ')}`;
        pending = [];
        // a room heading starts a new room: its rows find their own trades unless it names one
        if (areaHere) { headingArea = areaHere; headingTrade = tradeHere; }
        else {
          if (tradeHere) headingTrade = tradeHere;
          // a new top level section (4.0, 4, D) that names no room leaves the last room behind
          if (numbered) headingArea = '';
        }
        pendingItem = '';
        skipped.push({ line, text: label, reason: 'Heading' });
      } else {
        if (!pending.length && itemNo) pendingItem = itemNo;
        pending.push(desc);
      }
      continue;
    }

    const text = [...pending, desc].filter(Boolean).join(' ');
    const rowItem = itemNo || pendingItem;
    pending = [];
    pendingItem = '';
    const issues: string[] = [];
    let q = qty > 0 ? qty : NaN;
    let unit = normaliseUnit(unitRaw);
    let rt = rate > 0 ? rate : NaN;
    let amt = amount > 0 ? amount : NaN;
    if (isNaN(q) && !isNaN(amt)) { q = 1; unit = unit || 'item'; }
    if (isNaN(q)) q = 0;
    if (isNaN(rt) && !isNaN(amt) && q > 0) rt = amt / q;
    if (isNaN(rt)) rt = 0;
    if (isNaN(amt)) amt = q * rt;
    if (q > 0 && rt > 0 && amount > 0 && Math.abs(q * rt - amount) > Math.max(1, amount * 0.01)) {
      issues.push(`Quantity x rate is $${(q * rt).toFixed(2)} but the BOQ says $${amount.toFixed(2)}`);
    }
    if (!unit) issues.push('No unit');

    const allowance = PC_RE.test(`${text} ${unitRaw}`) ? 'PC' : PS_RE.test(`${text} ${unitRaw}`) ? 'PS' : undefined;
    const trade = headingTrade || tradeFromText(text);
    if (!trade) issues.push('No trade found');
    out.push({
      line, itemNo: rowItem, text, trade, scope: cleanScope(text), area: headingArea,
      quantity: Math.round(q * 1000) / 1000, unit, rate: Math.round(rt * 10000) / 10000,
      amount: Math.round(amt * 100) / 100, ...(allowance ? { allowance } : {}), issues,
    });
  }
  if (pending.length && out.length) out[out.length - 1].text += ` ${pending.join(' ')}`;
  return { columns, rows: out, skipped, boqTotal };
}

/** The imported rows' total against the BOQ's own total, to the cent. */
export function reconcile(rows: BoqRow[], boqTotal: number | null): { imported: number; boqTotal: number | null; difference: number | null } {
  const imported = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  return { imported, boqTotal, difference: boqTotal == null ? null : Math.round((imported - boqTotal) * 100) / 100 };
}
