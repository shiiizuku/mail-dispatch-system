import { existsSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import type { Edge, Sheet, SheetLayout, Style } from './xlsx.js';

/**
 * Prints a sheet to PDF the way Excel would print it: its paper, orientation, margins and
 * fit-to-width or fixed scale, only the print area, the page-header picture on every page, no
 * gridlines. Drawn from `sheet.layout()`, so the PDF and the .xlsx can never disagree.
 */

/** Points (1/72 in) for Excel's paper codes. */
const PAPER: Record<number, [number, number]> = {
  1: [612, 792], // Letter
  9: [595.28, 841.89], // A4
  14: [612, 936], // Folio, 8.5 × 13 in
};

/** Excel column width (characters of Calibri 11) to points: pixels = 7w + 5, at 96 px per inch. */
const colPt = (w: number) => (Math.round(w * 7 + 5) * 72) / 96;

const CALIBRI = {
  regular: 'C:/Windows/Fonts/calibri.ttf',
  bold: 'C:/Windows/Fonts/calibrib.ttf',
  italic: 'C:/Windows/Fonts/calibrii.ttf',
  boldItalic: 'C:/Windows/Fonts/calibriz.ttf',
};

type Doc = InstanceType<typeof PDFDocument>;

function registerFonts(doc: Doc) {
  // Times is one of the PDF standard fonts; Calibri comes from Windows when it is installed.
  const calibri = Object.values(CALIBRI).every((f) => existsSync(/*turbopackIgnore: true*/ f));
  doc.registerFont('sans', calibri ? CALIBRI.regular : 'Helvetica');
  doc.registerFont('sans-b', calibri ? CALIBRI.bold : 'Helvetica-Bold');
  doc.registerFont('sans-i', calibri ? CALIBRI.italic : 'Helvetica-Oblique');
  doc.registerFont('sans-bi', calibri ? CALIBRI.boldItalic : 'Helvetica-BoldOblique');
  doc.registerFont('serif', 'Times-Roman');
  doc.registerFont('serif-b', 'Times-Bold');
  doc.registerFont('serif-i', 'Times-Italic');
  doc.registerFont('serif-bi', 'Times-BoldItalic');
}

const fontName = (style: Style) => {
  const f = style.font ?? {};
  const family = f.name === 'Times New Roman' ? 'serif' : 'sans';
  const variant = f.bold && f.italic ? '-bi' : f.bold ? '-b' : f.italic ? '-i' : '';
  return family + variant;
};

const LINE: Record<Edge, number> = { thin: 0.5, medium: 1.5 };
const PAD = 2;

export async function sheetToPdf(sheet: Sheet | SheetLayout): Promise<Uint8Array> {
  const layout = 'layout' in sheet ? sheet.layout() : sheet;
  const { page, printArea } = layout;
  const [pw, ph] = PAPER[page.paperSize] ?? PAPER[1]!;
  const [pageW, pageH] = page.orientation === 'landscape' ? [ph, pw] : [pw, ph];
  const m = page.margins;
  const left = m.left * 72;
  const right = m.right * 72;
  const top = m.top * 72;
  const bottom = m.bottom * 72;

  const lastCol = Math.min(printArea.lastCol, layout.colWidths.length - 1);
  const lastRow = Math.min(printArea.lastRow, layout.rowHeights.length);
  const widths = layout.colWidths.slice(0, lastCol + 1).map(colPt);
  const tableW = widths.reduce((a, b) => a + b, 0);
  const usable = pageW - left - right;
  const scale = page.scale ? page.scale / 100 : page.fitToWidth ? Math.min(1, usable / tableW) : 1;

  const x0 = page.centerHorizontally ? left + (usable - tableW * scale) / 2 : left;
  const colX: number[] = [];
  widths.reduce((x, w, i) => ((colX[i] = x), x + w * scale), x0);
  const colRight = (c: number) => colX[c]! + widths[c]! * scale;

  // Paginate by whole rows; rows taller than a page simply overflow it.
  const rowPage: number[] = [];
  const rowY: number[] = [];
  let pageNo = 0;
  let y = top;
  for (let r = 1; r <= lastRow; r++) {
    const h = layout.rowHeights[r - 1]! * scale;
    if (y + h > pageH - bottom && y > top) {
      pageNo++;
      y = top;
    }
    rowPage[r] = pageNo;
    rowY[r] = y;
    y += h;
  }
  const rowH = (r: number) => layout.rowHeights[r - 1]! * scale;

  const doc = new PDFDocument({ autoFirstPage: false, size: [pageW, pageH], margin: 0, info: { Title: layout.name } });
  registerFonts(doc);
  const chunks: Uint8Array[] = [];
  const done = new Promise<Uint8Array>((resolve, reject) => {
    doc.on('data', (c: Uint8Array) => chunks.push(c));
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on('error', reject);
  });

  const printed = layout.cells.filter((c) => c.row <= lastRow && c.col <= lastCol);

  const img = layout.headerImage;
  // Opened once, so every page draws the same embedded picture rather than a copy of it.
  // pdfkit has `openImage`, but its type definitions leave it out; `image()` accepts what it returns.
  const openImage = (doc as unknown as { openImage(src: Buffer): Buffer }).openImage.bind(doc);
  const picture = img ? openImage(Buffer.from(img.data)) : null;

  for (let p = 0; p <= pageNo; p++) {
    doc.addPage({ size: [pageW, pageH], margin: 0 });
    if (img && picture) {
      // Excel prints the header picture at its own size (scaleWithDoc off), centred.
      doc.image(picture, (pageW - img.widthPt) / 2, m.header * 72, {
        width: img.widthPt,
        height: img.heightPt,
      });
    }
    const onPage = printed.filter((c) => rowPage[c.row] === p);

    for (const cell of onPage) {
      const x = colX[cell.col]!;
      const w = colRight(Math.min(cell.col + cell.colSpan - 1, lastCol)) - x;
      let h = 0;
      for (let r = cell.row; r < cell.row + cell.rowSpan && r <= lastRow; r++) h += rowH(r);
      const y0 = rowY[cell.row]!;

      if (cell.style.fill) doc.rect(x, y0, w, h).fill(`#${cell.style.fill}`);
      if (!cell.text) continue;

      const a = cell.style.align ?? {};
      const size = (cell.style.font?.size ?? 11) * scale;
      doc.font(fontName(cell.style)).fontSize(size).fillColor('#000000');
      const underline = cell.style.font?.underline === true;
      const numeric = /^-?[\d,.]+$/.test(cell.text);
      const h1 = a.h ?? (numeric ? 'right' : 'left');
      const vy = (textH: number) =>
        a.v === 'top' ? y0 + PAD : a.v === 'center' ? y0 + (h - textH) / 2 : y0 + h - textH - PAD;

      if (a.wrap) {
        const opts = { width: Math.max(1, w - PAD * 2), align: h1, underline, lineGap: 0 } as const;
        doc.text(cell.text, x + PAD, Math.max(y0, vy(doc.heightOfString(cell.text, opts))), opts);
        continue;
      }
      // One line, placed by hand: pdfkit wraps whenever it is given a width. Like Excel, a line
      // too long for its cell runs on (to the right, or both ways when centred) rather than wrapping.
      const tw = doc.widthOfString(cell.text);
      const left =
        h1 === 'center'
          ? x + (w - tw) / 2
          : h1 === 'right'
            ? x + w - tw - PAD
            : x + PAD;
      doc.text(cell.text, left, Math.max(y0, vy(doc.currentLineHeight())), {
        lineBreak: false,
        underline,
      });
    }

    for (const cell of onPage) {
      const x = colX[cell.col]!;
      const x2 = colRight(Math.min(cell.col + cell.colSpan - 1, lastCol));
      let h = 0;
      for (let r = cell.row; r < cell.row + cell.rowSpan && r <= lastRow; r++) h += rowH(r);
      const y0 = rowY[cell.row]!;
      const y2 = y0 + h;
      const b = cell.border;
      const line = (e: Edge | undefined, ax: number, ay: number, bx: number, by: number) => {
        if (!e) return;
        doc.lineWidth(LINE[e]).strokeColor('#000000').moveTo(ax, ay).lineTo(bx, by).stroke();
      };
      line(b.top, x, y0, x2, y0);
      line(b.bottom, x, y2, x2, y2);
      line(b.left, x, y0, x, y2);
      line(b.right, x2, y0, x2, y2);
    }
  }

  doc.end();
  return done;
}
