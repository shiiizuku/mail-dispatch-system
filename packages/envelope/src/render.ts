import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import {
  ENVELOPE_10,
  STAMP_GRID,
  STAMP_ZONE,
  centredBlockX,
  layoutEnvelope,
  type Block,
  type Envelope,
  type LayoutOptions,
  type LineStyle,
} from './layout.js';

const PT_PER_MM = 72 / 25.4;
const pt = (mm: number) => mm * PT_PER_MM;

export interface RenderOptions extends LayoutOptions {
  /** TTF files for the text. Defaults to Windows Calibri when installed, else Helvetica. */
  fonts?: { regular: string; bold: string };
}

/** The MGB Region III letterhead banner shipped with this package; used unless told otherwise. */
export const DEFAULT_LETTERHEAD_IMAGE = fileURLToPath(
  new URL('../assets/letterhead.png', import.meta.url),
);

/** Fills in the bundled banner; `letterheadImage: undefined` is still "use the default". */
const withDefaults = (options: RenderOptions): RenderOptions => ({
  ...options,
  letterheadImage: options.letterheadImage ?? DEFAULT_LETTERHEAD_IMAGE,
});

const CALIBRI = { regular: 'C:/Windows/Fonts/calibri.ttf', bold: 'C:/Windows/Fonts/calibrib.ttf' };

type Doc = InstanceType<typeof PDFDocument>;

function openDocument(options: RenderOptions): { doc: Doc; done: Promise<Buffer> } {
  const doc = new PDFDocument({ autoFirstPage: false, info: { Title: 'Envelopes' } });
  const fonts =
    options.fonts ??
    // A fixed Windows path checked at run time; nothing for the bundler to trace.
    (existsSync(/*turbopackIgnore: true*/ CALIBRI.regular) &&
    existsSync(/*turbopackIgnore: true*/ CALIBRI.bold)
      ? CALIBRI
      : undefined);
  if (fonts) {
    doc.registerFont('regular', fonts.regular);
    doc.registerFont('bold', fonts.bold);
  } else {
    doc.registerFont('regular', 'Helvetica');
    doc.registerFont('bold', 'Helvetica-Bold');
  }

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  return { doc, done };
}

/** Landscape #10, no margins: the printer's ENVELOPE preset feeds exactly this page. */
const addEnvelopePage = (doc: Doc) =>
  doc.addPage({ size: [pt(ENVELOPE_10.widthMm), pt(ENVELOPE_10.heightMm)], margin: 0 });

function drawBlock(doc: Doc, block: Block) {
  if (block.role === 'rule') {
    const style = block.style as LineStyle;
    doc
      .rect(pt(block.xMm), pt(block.yMm), pt(block.widthMm), pt(block.heightMm))
      .fill(style.color ?? '#000000');
    return;
  }
  if (block.imagePath) {
    doc.image(block.imagePath, pt(block.xMm), pt(block.yMm), {
      fit: [pt(block.widthMm), pt(block.heightMm)],
    });
    return;
  }

  const styleOf = (i: number) => (Array.isArray(block.style) ? block.style[i] : block.style);
  const useStyle = (style: LineStyle) =>
    doc
      .font(style.bold ? 'bold' : 'regular')
      .fontSize(style.sizePt)
      .fillColor(style.color ?? '#000000');

  const spaceX = pt(block.xMm);
  const spaceRight = pt(block.xMm + block.widthMm);
  let x = spaceX;
  if (block.align === 'centred-block') {
    const longest = Math.max(
      0,
      ...block.lines.map((line, i) => {
        const style = styleOf(i);
        return style ? useStyle(style).widthOfString(line) : 0;
      }),
    );
    x = centredBlockX(spaceX, spaceRight - spaceX, longest);
  }

  let y = pt(block.yMm);
  block.lines.forEach((line, i) => {
    const style = styleOf(i);
    if (!style) return;
    useStyle(style).text(line, x, y, { width: spaceRight - x, lineGap: 0, align: 'left' });
    y = doc.y;
  });
}

/** One page per envelope, in order. Print the whole file with the ENVELOPE preset. */
export async function renderEnvelopes(
  envelopes: Envelope[],
  options: RenderOptions = {},
): Promise<Buffer> {
  if (envelopes.length === 0) throw new Error('There are no envelopes to print');
  options = withDefaults(options);
  const { doc, done } = openDocument(options);
  for (const envelope of envelopes) {
    addEnvelopePage(doc);
    for (const block of layoutEnvelope(envelope, options)) drawBlock(doc, block);
  }
  doc.end();
  return done;
}

/**
 * A ruler page to print on a blank envelope. Where the printed marks land against the real edges
 * gives the offsets to put in `offsetXmm` / `offsetYmm`.
 */
export async function renderCalibrationPage(options: RenderOptions = {}): Promise<Buffer> {
  options = withDefaults(options);
  const { doc, done } = openDocument(options);
  addEnvelopePage(doc);
  const { widthMm: w, heightMm: h } = ENVELOPE_10;
  const dx = options.offsetXmm ?? 0;
  const dy = options.offsetYmm ?? 0;

  doc.lineWidth(0.5).strokeColor('#000000').fillColor('#000000').font('regular').fontSize(6);
  // Rulers along the top and left edges: a tick every 5 mm, numbered every 10 mm.
  for (let x = 0; x <= w; x += 5) {
    const len = x % 10 === 0 ? 4 : 2;
    doc.moveTo(pt(x + dx), pt(dy)).lineTo(pt(x + dx), pt(len + dy)).stroke();
    if (x % 10 === 0 && x > 0 && x < w) doc.text(String(x), pt(x + dx) - 6, pt(5 + dy), { width: 12, align: 'center' });
  }
  for (let y = 0; y <= h; y += 5) {
    const len = y % 10 === 0 ? 4 : 2;
    doc.moveTo(pt(dx), pt(y + dy)).lineTo(pt(len + dx), pt(y + dy)).stroke();
    if (y % 10 === 0 && y > 0 && y < h) doc.text(String(y), pt(5 + dx), pt(y + dy) - 3);
  }

  // Where the layout puts things, as dashed boxes.
  const sample = layoutEnvelope(
    { controlNo: 'MGB-00-000', service: 'REGISTERED', recipient: { name: 'RECIPIENT', addressLines: ['Line 2', 'Line 3', 'Line 4', 'Line 5'] } },
    options,
  );
  doc.dash(3, { space: 2 }).strokeColor('#888888');
  for (const b of sample.filter((b) => b.role !== 'rule')) {
    doc.rect(pt(b.xMm), pt(b.yMm), pt(b.widthMm), pt(Math.max(b.heightMm, 3))).stroke();
    doc.fillColor('#888888').fontSize(7).text(b.role.toUpperCase(), pt(b.xMm) + 2, pt(b.yMm) + 2);
  }
  const { columns, rows, cellWidthMm, cellHeightMm, gapMm } = STAMP_GRID;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const x = STAMP_ZONE.xMm + dx + c * (cellWidthMm + gapMm);
      const y = STAMP_ZONE.yMm + dy + r * (cellHeightMm + gapMm);
      doc.rect(pt(x), pt(y), pt(cellWidthMm), pt(cellHeightMm)).stroke();
      doc.text('STAMP', pt(x) + 2, pt(y) + 2);
    }
  }
  doc.undash();

  doc
    .fillColor('#000000')
    .fontSize(8)
    .text(
      'Calibration: print on a blank #10 envelope with the ENVELOPE preset. The 0 ticks should sit on ' +
        'the top and left edges. If the 0 tick lands 3 mm in from the left edge, set offsetXmm to -3. ' +
        'If the ruler is cut off and the edge reads 3, set offsetXmm to 3. Same for the top and offsetYmm.',
      pt(20 + dx),
      pt(h - 22 + dy),
      { width: pt(160) },
    );

  doc.end();
  return done;
}
