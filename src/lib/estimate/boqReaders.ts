/**
 * A BOQ file as rows of cells, ready for parseBoq: Excel (.xlsx) sheet by sheet, CSV, or a
 * PDF with a text layer (QS and estimating software exports). Scanned PDFs have no text to read.
 */
import { parseCSV } from '@/lib/materials/priceListImport';

export interface BoqSheet { name: string; rows: string[][] }

export async function readBoqFile(file: File): Promise<BoqSheet[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) return [{ name: file.name, rows: parseCSV(await file.text()) }];
  if (name.endsWith('.xlsx')) return readXlsx(file);
  if (name.endsWith('.pdf')) return readPdf(file);
  if (name.endsWith('.xls')) throw new Error('Old Excel files (.xls) cannot be read: open it in Excel and save as .xlsx or .csv');
  throw new Error('Choose an Excel (.xlsx), CSV or PDF file');
}

async function readXlsx(file: File): Promise<BoqSheet[]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const sheets: BoqSheet[] = [];
  wb.eachSheet(ws => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, row => {
      const cells: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) {
        const cell = row.getCell(c);
        // a merged block's text belongs to its first cell only, or it reads as repeated columns
        if (cell.isMerged && cell.master && cell.master.address !== cell.address) { cells.push(''); continue; }
        let text = '';
        try { text = cell.text ?? ''; } catch { text = String(cell.value ?? ''); }
        cells.push(text);
      }
      rows.push(cells);
    });
    if (rows.length) sheets.push({ name: ws.name, rows });
  });
  // the sheet with the most rows first: that is usually the BOQ, not the cover page
  return sheets.sort((a, b) => b.rows.length - a.rows.length);
}

interface Word { text: string; x: number; y: number; page: number; w: number }

async function readPdf(file: File): Promise<BoqSheet[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines: Word[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const words: Word[] = (tc.items as any[]).filter(i => i.str && i.str.trim())
      .map(i => ({ text: i.str.trim(), x: i.transform[4], y: i.transform[5], page: p, w: i.width || 0 }));
    // words on the same baseline (within 3 points) make a line, top of the page first
    words.sort((a, b) => b.y - a.y || a.x - b.x);
    for (const wd of words) {
      const last = lines[lines.length - 1];
      if (last && last[0].page === p && Math.abs(last[0].y - wd.y) <= 3) last.push(wd);
      else lines.push([wd]);
    }
  }
  if (!lines.length) throw new Error('No text in this PDF: it looks scanned. Ask for the Excel version of the BOQ.');
  lines.forEach(l => l.sort((a, b) => a.x - b.x));

  // Columns from the header line ("Description ... Qty ... Unit ... Rate ... Amount"): every
  // word then goes to the column whose header starts nearest to its left
  const header = lines.find(l => /desc/i.test(l.map(w => w.text).join(' ')) && /qty|quant/i.test(l.map(w => w.text).join(' ')));
  if (header) {
    const starts = header.map(w => w.x);
    const centres = header.map(w => w.x + w.w / 2);
    const rows = lines.map(l => {
      const cells = starts.map(() => '');
      for (const wd of l) {
        let col = 0;
        if (/^[$(]?[\d,.]+\)?$/.test(wd.text)) {
          // numbers sit right aligned under their header: the nearest header centre wins
          const mid = wd.x + wd.w / 2;
          col = centres.reduce((best, c, i) => Math.abs(c - mid) < Math.abs(centres[best] - mid) ? i : best, 0);
        } else {
          for (let i = 0; i < starts.length; i++) if (wd.x >= starts[i] - 6) col = i;
        }
        cells[col] = cells[col] ? `${cells[col]} ${wd.text}` : wd.text;
      }
      return cells;
    });
    return [{ name: file.name, rows }];
  }
  // No header: split each line where the gap between words is wide
  const rows = lines.map(l => {
    const cells: string[] = [];
    let prevEnd = -Infinity;
    for (const wd of l) {
      if (wd.x - prevEnd > 14 || !cells.length) cells.push(wd.text);
      else cells[cells.length - 1] += ` ${wd.text}`;
      prevEnd = wd.x + wd.w;
    }
    return cells;
  });
  return [{ name: file.name, rows }];
}
