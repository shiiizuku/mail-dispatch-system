import { strToU8, zipSync } from 'fflate';

/**
 * A minimal one-sheet XLSX writer: inline text, numbers, formulas, merges, borders, page setup and
 * an optional page-header picture. Raw SpreadsheetML zipped with fflate, the way the DMS writes its
 * own XLSX reports. Only what these reports need; not a general spreadsheet library.
 */

export type Edge = 'thin' | 'medium';

export interface Style {
  font?: {
    name?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  };
  /** Solid fill, as RRGGBB. */
  fill?: string;
  align?: {
    h?: 'left' | 'center' | 'right';
    v?: 'top' | 'center' | 'bottom';
    wrap?: boolean;
  };
  border?: { left?: Edge; right?: Edge; top?: Edge; bottom?: Edge };
  /** A custom number format, e.g. "#,##0.00" or "mmm d, yyyy". */
  numFmt?: string;
}

export type Value = { text: string } | { num: number } | { formula: string } | null;

export const text = (t: string): Value => ({ text: t });
export const num = (n: number): Value => ({ num: n });
export const formula = (f: string): Value => ({ formula: f });

const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const colIndex = (c: string) => COLS.indexOf(c);

/** Characters XML 1.0 does not allow at all; dropped rather than escaped. */
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
export const esc = (s: string) =>
  s
    .replace(INVALID_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const parseRange = (range: string) => {
  const [, c1, r1, c2, r2] = range.match(/^([A-Z])(\d+)(?::([A-Z])(\d+))?$/)!;
  return {
    c1: colIndex(c1!),
    r1: Number(r1),
    c2: colIndex(c2 ?? c1!),
    r2: Number(r2 ?? r1),
  };
};

export interface PageSetup {
  /** Excel paper code: 1 Letter, 9 A4, 14 Folio (8.5 × 13). */
  paperSize: number;
  orientation: 'portrait' | 'landscape';
  /** Fit all columns on one page width, as many pages down as needed. */
  fitToWidth?: boolean;
  /** Fixed zoom, when not fitting. */
  scale?: number;
  /** Inches. */
  margins: { left: number; right: number; top: number; bottom: number; header: number; footer: number };
  centerHorizontally?: boolean;
  /** Last printed row and column; the whole used area when absent. */
  printArea?: string;
}

interface Cell {
  v: Value;
  style: Style;
}

export class Sheet {
  private rows = new Map<number, { height?: number; cells: Map<number, Cell> }>();
  private merges: string[] = [];
  private widths = new Map<number, number>();
  private freeze = 0;
  private headerImage: { data: Uint8Array; widthPt: number; heightPt: number } | null = null;
  page: PageSetup = {
    paperSize: 1,
    orientation: 'portrait',
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  };

  constructor(readonly name: string) {}

  /** Column widths in Excel's character units, e.g. { A: 11.14, C: 23.86 }. */
  columns(widths: Record<string, number>) {
    for (const [c, w] of Object.entries(widths)) this.widths.set(colIndex(c), w);
  }

  height(r: number, h: number) {
    this.row(r).height = h;
  }

  freezeRows(n: number) {
    this.freeze = n;
  }

  /** A picture centred in the page header (&G), printed on every page. JPEG only. */
  setHeaderImage(data: Uint8Array, widthPt: number, heightPt: number) {
    this.headerImage = { data, widthPt, heightPt };
  }

  set(ref: string, v: Value, style: Style = {}) {
    const { c1, r1 } = parseRange(ref);
    const cell = this.cell(r1, c1);
    cell.v = v;
    cell.style = { ...cell.style, ...style, border: { ...cell.style.border, ...style.border } };
  }

  /** Merges a range: the value goes in its first cell, the style on every cell of it. */
  merge(range: string, v: Value, style: Style = {}) {
    const { c1, r1, c2, r2 } = parseRange(range);
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        this.set(`${COLS[c]}${r}`, r === r1 && c === c1 ? v : this.cell(r, c).v, style);
      }
    }
    if (c1 !== c2 || r1 !== r2) this.merges.push(range);
  }

  /** Draws a box round a range. */
  box(range: string, edge: Edge) {
    const { c1, r1, c2, r2 } = parseRange(range);
    for (let c = c1; c <= c2; c++) {
      this.edge(r1, c, 'top', edge);
      this.edge(r2, c, 'bottom', edge);
    }
    for (let r = r1; r <= r2; r++) {
      this.edge(r, c1, 'left', edge);
      this.edge(r, c2, 'right', edge);
    }
  }

  /** Lines between every cell of a range, outside edges excluded. */
  grid(range: string, edge: Edge) {
    const { c1, r1, c2, r2 } = parseRange(range);
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (c < c2) this.edge(r, c, 'right', edge);
        if (c > c1) this.edge(r, c, 'left', edge);
        if (r < r2) this.edge(r, c, 'bottom', edge);
        if (r > r1) this.edge(r, c, 'top', edge);
      }
    }
  }

  /** A vertical line after column `col`, from row r1 to r2. */
  vline(col: string, r1: number, r2: number, edge: Edge) {
    const c = colIndex(col);
    for (let r = r1; r <= r2; r++) {
      this.edge(r, c, 'right', edge);
      this.edge(r, c + 1, 'left', edge);
    }
  }

  /** A horizontal line under row `r`, from column c1 to c2. */
  hline(r: number, c1: string, c2: string, edge: Edge) {
    for (let c = colIndex(c1); c <= colIndex(c2); c++) {
      this.edge(r, c, 'bottom', edge);
      this.edge(r + 1, c, 'top', edge);
    }
  }

  get lastRow() {
    return Math.max(0, ...this.rows.keys());
  }

  private row(r: number) {
    let row = this.rows.get(r);
    if (!row) this.rows.set(r, (row = { cells: new Map() }));
    return row;
  }

  private cell(r: number, c: number): Cell {
    const row = this.row(r);
    let cell = row.cells.get(c);
    if (!cell) row.cells.set(c, (cell = { v: null, style: {} }));
    return cell;
  }

  private edge(r: number, c: number, side: 'left' | 'right' | 'top' | 'bottom', edge: Edge) {
    const cell = this.cell(r, c);
    const current = cell.style.border?.[side];
    // A medium line is never thinned by a thin one drawn over it.
    if (current === 'medium' && edge === 'thin') return;
    cell.style = { ...cell.style, border: { ...cell.style.border, [side]: edge } };
  }

  /** The finished workbook, as the bytes of an .xlsx file. */
  toXlsx(): Uint8Array {
    const styles = new StyleTable();
    const lastCol = Math.max(
      0,
      ...[...this.rows.values()].flatMap((r) => [...r.cells.keys()]),
      ...this.widths.keys(),
    );
    const lastRow = this.lastRow;
    const rowsXml = [...this.rows.entries()]
      .sort(([a], [b]) => a - b)
      .map(([r, row]) => {
        const cells = [...row.cells.entries()]
          .sort(([a], [b]) => a - b)
          .map(([c, { v, style }]) => {
            const ref = `${COLS[c]}${r}`;
            const s = styles.id(style);
            if (v === null) return `<c r="${ref}" s="${s}"/>`;
            if ('text' in v) {
              return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v.text)}</t></is></c>`;
            }
            if ('num' in v) return `<c r="${ref}" s="${s}"><v>${v.num}</v></c>`;
            return `<c r="${ref}" s="${s}"><f>${esc(v.formula)}</f></c>`;
          })
          .join('');
        const h = row.height !== undefined ? ` ht="${row.height}" customHeight="1"` : '';
        return `<row r="${r}"${h}>${cells}</row>`;
      })
      .join('');

    const p = this.page;
    const cols = [...this.widths.entries()]
      .sort(([a], [b]) => a - b)
      .map(([c, w]) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`)
      .join('');
    const pane = this.freeze
      ? `<pane ySplit="${this.freeze}" topLeftCell="A${this.freeze + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${this.freeze + 1}" sqref="A${this.freeze + 1}"/>`
      : '';
    const m = p.margins;

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr>${p.fitToWidth ? '<pageSetUpPr fitToPage="1"/>' : ''}</sheetPr>
<dimension ref="A1:${COLS[lastCol]}${Math.max(lastRow, 1)}"/>
<sheetViews><sheetView tabSelected="1" workbookViewId="0">${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${cols ? `<cols>${cols}</cols>` : ''}
<sheetData>${rowsXml}</sheetData>
${this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map((r) => `<mergeCell ref="${r}"/>`).join('')}</mergeCells>` : ''}
${p.centerHorizontally ? '<printOptions horizontalCentered="1"/>' : ''}
<pageMargins left="${m.left}" right="${m.right}" top="${m.top}" bottom="${m.bottom}" header="${m.header}" footer="${m.footer}"/>
<pageSetup paperSize="${p.paperSize}"${p.scale ? ` scale="${p.scale}"` : ''}${p.fitToWidth ? ' fitToHeight="0"' : ''} orientation="${p.orientation}"/>
${this.headerImage ? '<headerFooter scaleWithDoc="0"><oddHeader>&amp;C&amp;G</oddHeader></headerFooter>\n<legacyDrawingHF r:id="rId1"/>' : ''}
</worksheet>`;

    const area = p.printArea ?? `$A$1:$${COLS[lastCol]}$${Math.max(lastRow, 1)}`;
    const quoted = `'${this.name.replace(/'/g, "''")}'`;
    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView/></bookViews>
<sheets><sheet name="${esc(this.name)}" sheetId="1" r:id="rId1"/></sheets>
<definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">${esc(quoted)}!${area}</definedName></definedNames>
<calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`;

    const rel = (id: string, type: string, target: string) =>
      `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
    const rels = (...items: string[]) =>
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.join('')}</Relationships>`;

    const files: Record<string, Uint8Array> = {
      '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
      '_rels/.rels': strToU8(
        rels(
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`,
        ),
      ),
      'xl/workbook.xml': strToU8(workbookXml),
      'xl/_rels/workbook.xml.rels': strToU8(
        rels(rel('rId1', 'worksheet', 'worksheets/sheet1.xml'), rel('rId2', 'styles', 'styles.xml')),
      ),
      'xl/styles.xml': strToU8(styles.xml()),
      'xl/worksheets/sheet1.xml': strToU8(sheetXml),
    };
    if (this.headerImage) {
      files['xl/worksheets/_rels/sheet1.xml.rels'] = strToU8(
        rels(rel('rId1', 'vmlDrawing', '../drawings/vmlDrawing1.vml')),
      );
      files['xl/drawings/vmlDrawing1.vml'] = strToU8(
        headerVml(this.headerImage.widthPt, this.headerImage.heightPt),
      );
      files['xl/drawings/_rels/vmlDrawing1.vml.rels'] = strToU8(
        rels(rel('rId1', 'image', '../media/image1.jpeg')),
      );
      files['xl/media/image1.jpeg'] = this.headerImage.data;
    }
    return zipSync(files, { level: 6 });
  }
}

/** Collects distinct fonts, fills, borders and formats into styles.xml. */
class StyleTable {
  private fonts = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'];
  private fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  private borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  private numFmts: string[] = [];
  private xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  private byKey = new Map<string, number>([['{}', 0]]);

  id(style: Style): number {
    const key = JSON.stringify(style);
    const known = this.byKey.get(key);
    if (known !== undefined) return known;

    const f = style.font ?? {};
    const fontId = this.add(
      this.fonts,
      `<font>${f.bold ? '<b/>' : ''}${f.italic ? '<i/>' : ''}${f.underline ? '<u/>' : ''}<sz val="${f.size ?? 11}"/><name val="${esc(f.name ?? 'Calibri')}"/><family val="${f.name === 'Times New Roman' ? 1 : 2}"/></font>`,
    );
    const fillId = style.fill
      ? this.add(
          this.fills,
          `<fill><patternFill patternType="solid"><fgColor rgb="FF${style.fill}"/><bgColor indexed="64"/></patternFill></fill>`,
        )
      : 0;
    const b = style.border ?? {};
    const side = (name: string, e?: Edge) =>
      e ? `<${name} style="${e}"><color indexed="64"/></${name}>` : `<${name}/>`;
    const borderId = this.add(
      this.borders,
      `<border>${side('left', b.left)}${side('right', b.right)}${side('top', b.top)}${side('bottom', b.bottom)}<diagonal/></border>`,
    );
    const numFmtId = style.numFmt ? 164 + this.add(this.numFmts, style.numFmt) : 0;
    const a = style.align;
    const alignment = a
      ? `<alignment${a.h ? ` horizontal="${a.h}"` : ''}${a.v ? ` vertical="${a.v}"` : ''}${a.wrap ? ' wrapText="1"' : ''}/>`
      : '';
    const xf = `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"${numFmtId ? ' applyNumberFormat="1"' : ''}${fontId ? ' applyFont="1"' : ''}${fillId ? ' applyFill="1"' : ''}${borderId ? ' applyBorder="1"' : ''}${alignment ? ' applyAlignment="1"' : ''}>${alignment}</xf>`;
    const id = this.add(this.xfs, xf);
    this.byKey.set(key, id);
    return id;
  }

  private add(list: string[], item: string): number {
    const i = list.indexOf(item);
    if (i >= 0) return i;
    list.push(item);
    return list.length - 1;
  }

  xml(): string {
    const fmts = this.numFmts.length
      ? `<numFmts count="${this.numFmts.length}">${this.numFmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(f)}"/>`).join('')}</numFmts>`
      : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${fmts}
<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts>
<fills count="${this.fills.length}">${this.fills.join('')}</fills>
<borders count="${this.borders.length}">${this.borders.join('')}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  }
}

/** The page-header picture (&G) drawing, centred, at the given size. */
const headerVml = (widthPt: number, heightPt: number) => `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout>
<v:shapetype id="_x0000_t75" coordsize="21600,21600" o:spt="75" o:preferrelative="t" path="m@4@5l@4@11@9@11@9@5xe" filled="f" stroked="f">
<v:stroke joinstyle="miter"/>
<v:formulas>
<v:f eqn="if lineDrawn pixelLineWidth 0"/><v:f eqn="sum @0 1 0"/><v:f eqn="sum 0 0 @1"/><v:f eqn="prod @2 1 2"/>
<v:f eqn="prod @3 21600 pixelWidth"/><v:f eqn="prod @3 21600 pixelHeight"/><v:f eqn="sum @0 0 1"/><v:f eqn="prod @6 1 2"/>
<v:f eqn="prod @7 21600 pixelWidth"/><v:f eqn="sum @8 21600 0"/><v:f eqn="prod @7 21600 pixelHeight"/><v:f eqn="sum @10 21600 0"/>
</v:formulas>
<v:path o:extrusionok="f" gradientshapeok="t" o:connecttype="rect"/>
<o:lock v:ext="edit" aspectratio="t"/>
</v:shapetype>
<v:shape id="CH" o:spid="_x0000_s1025" type="#_x0000_t75" style="position:absolute;margin-left:0;margin-top:0;width:${widthPt}pt;height:${heightPt}pt;z-index:1">
<v:imagedata o:relid="rId1" o:title="Header"/>
<o:lock v:ext="edit" rotation="t"/>
</v:shape>
</xml>`;
