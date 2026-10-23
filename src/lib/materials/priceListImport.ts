/**
 * Supplier price list import: read a supplier's CSV (Bunnings Trade, Reece, Tradelink,
 * timber yards...), work out which column is which, and compare against the estimator's
 * materials library so a new price list updates prices instead of adding duplicates.
 */
import type { MaterialEntry } from './types';

/** CSV with quotes, embedded commas and newlines; comma, semicolon or tab separated. */
export function parseCSV(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  // A title line ("Reece price list March") has no separators: judge by the first lines
  const head = src.split(/\r?\n/, 12);
  const score = (d: string) => head.reduce((s, l) => s + (l.split(d).length - 1), 0);
  const delim = [',', ';', '\t'].sort((a, b) => score(b) - score(a))[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some(c => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(c => c !== '')) rows.push(row);
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const unitKey = (u: string) => { const n = norm(u).replace(/^(m2|sqm|square metres?)$/, 'm2').replace(/^(lm|m|lin m|metres?|lineal)$/, 'lm').replace(/^(ea|each|no|item|pce|pc|piece)$/, 'ea'); return n; };

export type PriceField = 'name' | 'code' | 'unit' | 'price' | 'trade' | 'notes';

const SYNONYMS: Record<PriceField, RegExp[]> = {
  // A bare "No." is a row number, not a product code
  code: [/^(item|product|stock|part|supplier|article)\s*(code|no\.?|number|#)$/i, /^(code|sku)$/i, /^article/i],
  name: [/^(item\s*)?desc(ription)?$/i, /^(product|item|material)\s*(name|description)?$/i, /^name$/i, /^title$/i],
  unit: [/^(uom|unit|units|unit of measure|pack|per|sell unit)$/i],
  // The estimator's buying price beats retail: try trade/nett prices before RRP
  price: [/your\s*price|trade\s*price|nett?\s*price|^nett?$|contract|account\s*price/i, /price\s*(ex|excl|inc)/i, /unit\s*(cost|price)|^cost$|^price$|sell\s*price/i, /\b(price|cost|amount)\b/i, /rrp|retail|list/i],
  trade: [/^(trade|category|group|department|range)$/i],
  notes: [/^(notes?|comments?|size|spec(ification)?)$/i],
};

/** Best guess of which column holds what (each column used once). */
export function detectColumns(headers: string[]): Partial<Record<PriceField, number>> {
  const out: Partial<Record<PriceField, number>> = {};
  const used = new Set<number>();
  for (const field of ['price', 'code', 'name', 'unit', 'trade', 'notes'] as PriceField[]) {
    for (const re of SYNONYMS[field]) {
      // "Price Unit", "Price Break Qty", "Price per" describe a price, they are not one
      const notPrice = (h: string) => field === 'price' && /qty|break|unit$|\bper\b|uom|centre|date/i.test(h);
      const idx = headers.findIndex((h, i) => !used.has(i) && re.test(h.trim()) && !notPrice(h));
      if (idx !== -1) { out[field] = idx; used.add(idx); break; }
    }
  }
  return out;
}

/** "$1,234.50", "12.5 ea", "(3.20)", European "2,30" or "1.234,50" -> number; anything else NaN */
export function parsePrice(raw: string): number {
  let s = String(raw ?? '').replace(/[$\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (/^-?\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s) || /^-?\d+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const m = s.match(/^-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

/** The header is the first row (of the top 15) where a price and a description or code column show up. */
export function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const m = detectColumns(rows[i]);
    if (m.price !== undefined && (m.name !== undefined || m.code !== undefined)) return i;
  }
  return 0;
}

export interface ImportOptions {
  supplier: string;
  /** prices in the file include GST: store them ex GST like the rest of the app */
  pricesIncludeGst: boolean;
  defaultTrade: string;
}

export interface PriceListItem {
  name: string;
  productCode: string;
  unit: string;
  unitCost: number;
  trade: string;
  notes: string;
}

export function readPriceList(rows: string[][], map: Partial<Record<PriceField, number>>, opts: ImportOptions): { items: PriceListItem[]; skipped: number } {
  const items: PriceListItem[] = [];
  let skipped = 0;
  const cell = (r: string[], f: PriceField) => (map[f] !== undefined ? (r[map[f]!] ?? '').trim() : '');
  const seen = new Map<string, number>();
  for (const r of rows.slice(1)) {
    const name = cell(r, 'name') || cell(r, 'code');
    const price = parsePrice(cell(r, 'price'));
    if (!name || !Number.isFinite(price) || price <= 0 || /^(sub\s*)?total|^gst\b|^freight|^delivery charge/i.test(name)) { skipped++; continue; }
    const exGst = opts.pricesIncludeGst ? price / 1.1 : price;
    const item = {
      name,
      productCode: cell(r, 'code'),
      unit: cell(r, 'unit') || 'ea',
      unitCost: Math.round(exGst * 100) / 100,
      trade: cell(r, 'trade') || opts.defaultTrade,
      notes: cell(r, 'notes'),
    };
    // The same product twice in one file: the later line wins, one material
    const key = item.productCode ? `c:${norm(item.productCode)}` : `n:${norm(name)}|${norm(item.unit)}`;
    if (seen.has(key)) { items[seen.get(key)!] = item; skipped++; continue; }
    seen.set(key, items.length);
    items.push(item);
  }
  return { items, skipped };
}

export interface PriceChange { existing: MaterialEntry; item: PriceListItem; from: number; to: number }
export interface LibraryDiff { added: PriceListItem[]; changed: PriceChange[]; unchanged: number }

/** Same supplier and product code, or else the same name, is the same material. */
export function diffAgainstLibrary(items: PriceListItem[], library: MaterialEntry[], supplier: string): LibraryDiff {
  const sup = norm(supplier);
  const byCode = new Map<string, MaterialEntry>();
  const byName = new Map<string, MaterialEntry>();
  for (const m of library) {
    // Another supplier's item with the same name keeps its own price
    if (norm(m.supplierName) !== sup) continue;
    if (m.productCode) byCode.set(norm(m.productCode), m);
    byName.set(`${norm(m.name)}|${unitKey(m.unit)}`, m);
  }
  const added: PriceListItem[] = [];
  const changed: PriceChange[] = [];
  let unchanged = 0;
  for (const it of items) {
    const byItsName = byName.get(`${norm(it.name)}|${unitKey(it.unit)}`);
    const existing = (it.productCode && byCode.get(norm(it.productCode)))
      // a name match only when the codes don't contradict each other
      || (byItsName && !(it.productCode && byItsName.productCode && norm(it.productCode) !== norm(byItsName.productCode)) ? byItsName : undefined);
    if (!existing) { added.push(it); continue; }
    if (Math.abs(existing.unitCost - it.unitCost) < 0.005) unchanged++;
    else changed.push({ existing, item: it, from: existing.unitCost, to: it.unitCost });
  }
  return { added, changed, unchanged };
}

export interface EstimateLineChange { projectId: string; projectName: string; lineId: string; label: string; from: number; to: number; qty: number }

/** Estimate lines priced from a material whose price just changed (matched on name or code). */
export function estimateLinesToReprice(
  projects: { id: string; name?: string; quoteStatus?: string; approved_quote?: unknown; estimate_items?: any[] }[],
  changes: PriceChange[],
): { lines: EstimateLineChange[]; lockedProjects: string[] } {
  const byName = new Map<string, PriceChange>();
  const codes: { code: string; c: PriceChange }[] = [];
  for (const c of changes) {
    byName.set(norm(c.existing.name), c);
    const code = c.existing.productCode ? norm(c.existing.productCode) : '';
    if (code.replace(/ /g, '').length >= 4) codes.push({ code, c });
  }
  const lines: EstimateLineChange[] = [];
  const locked = new Set<string>();
  for (const p of projects) {
    for (const line of p.estimate_items ?? []) {
      const mat = norm(line.material_type ?? '');
      const scope = norm(line.scope_of_work ?? '');
      let hit = byName.get(mat) ?? byName.get(scope);
      if (!hit && codes.length) {
        const text = ` ${mat} ${scope} `;
        hit = codes.find(k => text.includes(` ${k.code} `))?.c;
      }
      if (!hit || Math.abs((Number(line.unit_price) || 0) - hit.from) > 0.005) continue;
      // A price per length must not reprice a line counted per sheet
      if (line.unit && hit.existing.unit && unitKey(line.unit) !== unitKey(hit.existing.unit)) continue;
      // An approved quote is a contract: its lines are never repriced
      if (p.approved_quote || p.quoteStatus === 'won') { locked.add(p.name || p.id); continue; }
      lines.push({ projectId: p.id, projectName: p.name || 'Project', lineId: line.id, label: line.scope_of_work || line.material_type, from: hit.from, to: hit.to, qty: Number(line.quantity) || 0 });
    }
  }
  return { lines, lockedProjects: [...locked] };
}
