import { Sheet, formula, num, text, type Style } from './xlsx.js';

// ── Requisition and Issue Slip ──────────────────────────────────────────────

export interface RisSignatory {
  name: string;
  designation: string;
}

/** Same shape as `Signatories` in @mds/mail. */
export interface RisSignatories {
  entityName: string;
  fundCluster: string;
  office: string;
  division: string;
  requestedBy: RisSignatory;
  approvedBy: RisSignatory;
  issuedBy: RisSignatory;
  receivedBy: RisSignatory;
}

export interface RisInput {
  /** Second description line, e.g. "FOR WEEK 2 OF OCT". */
  weekLabel: string;
  /** Stamps to request, in the order they should be listed. Zero quantities are left out. */
  items: { denomination: number; quantity: number }[];
  /** YYYY-MM-DD of the request, or null to leave it for handwriting. */
  date: string | null;
  signatories: RisSignatories;
}

type Font = NonNullable<Style['font']>;
type Align = NonNullable<Style['align']>;

const TNR = 'Times New Roman';
const usDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${y}`;
};

/**
 * One requisition and issue slip for postage stamps, laid out like the office's "RIS ICA" sheet:
 * the top half of a Letter page, medium frame, thin inner lines, Times New Roman.
 */
export function requisitionSlipSheet(input: RisInput): Sheet {
  const items = input.items.filter((i) => i.quantity > 0);
  if (items.length === 0) throw new Error('There are no stamps to request for this week');
  if (items.length > 7) throw new Error('A slip has room for seven kinds of stamp');
  const s = input.signatories;
  const sheet = new Sheet('RIS');

  sheet.columns({ A: 11.14, B: 5.86, C: 23.86, D: 12.86, E: 12.71, F: 12.86, G: 13.29, H: 27.43 });
  const heights = [3.75, 12.75, 17, 18, 4.5, 22.5, 19.5, 26, 26, 17, 15.75, 17, 17, 17, 17, 17, 17, 17, 0.75, 26, 15, 22.5, 15, 15, 20.25];
  heights.forEach((h, i) => sheet.height(i + 1, h));

  const f = (size: number, extra: Font = {}): Font => ({ name: TNR, size, ...extra });
  const left: Align = { h: 'left', v: 'bottom' };
  const center: Align = { h: 'center', v: 'center' };
  const centerBottom: Align = { h: 'center', v: 'bottom' };

  // Header.
  sheet.merge('A3:H3', text('REQUISITION AND ISSUE SLIP'), { font: f(14, { bold: true }), align: center });
  sheet.set('A4', text(`Entity Name : ${s.entityName}`), { font: f(12, { bold: true }), align: left });
  sheet.set('G4', text(`Fund Cluster : ${s.fundCluster}`), { font: f(12, { bold: true, underline: true }), align: left });
  sheet.hline(5, 'A', 'H', 'medium');
  sheet.set('A6', text(`Division : ${s.division}`), { font: f(12), align: left });
  sheet.set('F6', text('Responsibility Center Code : ______________________'), { font: f(12), align: left });
  sheet.set('A7', text(`Office : ${s.office}`), { font: f(12), align: left });
  sheet.set('F7', text('RIS No. : _____________________________________'), { font: f(12), align: left });
  sheet.box('A6:E7', 'medium');
  sheet.box('F6:H7', 'medium');

  // Table.
  const group = { font: f(14, { bold: true, italic: true }), align: center };
  sheet.merge('A8:D8', text('Requisition'), group);
  sheet.merge('E8:F8', text('Stock Available?'), group);
  sheet.merge('G8:H8', text('Issue'), group);
  ['Stock No.', 'Unit', 'Description', 'Quantity', 'Yes', 'No', 'Quantity', 'Remarks'].forEach((h, i) =>
    sheet.set(`${'ABCDEFGH'[i]}9`, text(h), { font: f(12), align: center }),
  );
  const describe = { font: f(10), align: centerBottom };
  sheet.set('C10', text('POSTAGE STAMPS'), describe);
  sheet.set('C11', text(input.weekLabel), describe);
  items.forEach((item, i) => {
    sheet.set(`C${12 + i}`, num(item.denomination), describe);
    sheet.set(`D${12 + i}`, num(item.quantity), { font: f(12), align: centerBottom });
  });
  sheet.grid('A8:H18', 'thin');
  sheet.box('A8:H18', 'medium');
  sheet.hline(8, 'A', 'H', 'medium');
  sheet.hline(9, 'A', 'H', 'medium');
  sheet.vline('D', 8, 18, 'medium');
  sheet.vline('F', 8, 18, 'medium');
  sheet.box('A19:H19', 'medium');

  // Purpose.
  sheet.set('A20', text('   Purpose:'), { font: f(12), align: left });
  sheet.merge('B20:H20', null, {});
  sheet.box('A20:H20', 'medium');

  // Signatures.
  const label = { font: f(12), align: left };
  const heading = { font: f(12, { bold: true }), align: { h: 'left', v: 'center' } } as const;
  sheet.set('C21', text('Requested by:'), heading);
  sheet.merge('D21:E21', text('Approved by:'), heading);
  sheet.merge('F21:G21', text('Issued by:'), heading);
  sheet.set('H21', text('Received by:'), heading);
  sheet.set('A22', text('Signature :'), label);
  sheet.set('A23', text('Printed Name :'), label);
  sheet.set('A24', text('Designation :'), label);
  sheet.set('A25', text('Date :'), label);
  for (const r of [22, 25]) {
    sheet.merge(`D${r}:E${r}`, null, {});
    sheet.merge(`F${r}:G${r}`, null, {});
  }
  const name = { font: f(10, { bold: true }), align: centerBottom };
  const people: [string, RisSignatory][] = [
    ['C', s.requestedBy],
    ['D', s.approvedBy],
    ['F', s.issuedBy],
    ['H', s.receivedBy],
  ];
  for (const [col, person] of people) {
    const wide = col === 'D' || col === 'F';
    const next = String.fromCharCode(col.charCodeAt(0) + 1);
    const put = (r: number, v: string, style: Style) =>
      wide ? sheet.merge(`${col}${r}:${next}${r}`, text(v), style) : sheet.set(`${col}${r}`, text(v), style);
    put(23, person.name, name);
    put(24, person.designation, {
      font: f(person.designation.length > 28 ? 9 : 10, { bold: true }),
      align: centerBottom,
    });
  }
  if (input.date) sheet.set('C25', text(usDate(input.date)), name);
  for (const r of [22, 23, 24]) sheet.hline(r, 'A', 'H', 'thin');
  sheet.vline('B', 21, 25, 'thin');
  sheet.vline('C', 21, 25, 'thin');
  sheet.vline('E', 21, 25, 'thin');
  sheet.vline('G', 21, 25, 'thin');

  sheet.box('A1:H25', 'medium');
  sheet.page = {
    paperSize: 1,
    orientation: 'portrait',
    scale: 78,
    margins: { left: 0.3, right: 0.25, top: 0.31, bottom: 0.29, header: 0.21, footer: 0.17 },
    centerHorizontally: true,
    printArea: '$A$1:$H$25',
  };
  return sheet;
}

/** The requisition and issue slip as an .xlsx file. */
export const buildRequisitionSlip = (input: RisInput): Uint8Array =>
  requisitionSlipSheet(input).toXlsx();

// ── Report of Accountability for Accountable Forms ──────────────────────────

export interface AccountabilityRow {
  denomination: number;
  beginning: number;
  received: number;
  issued: number;
  ending: number;
}

/** One dated block of the report: usually one week's requisition. */
export interface AccountabilityBlock {
  /** YYYY-MM-DD. */
  date: string;
  /** Shown beside the date, e.g. "WEEK 2 OF OCT". */
  label?: string;
  rows: AccountabilityRow[];
}

/** MM-DD-YYYY, as the office's report writes dates. */
const reportDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${m}-${d}-${y}`;
};
const peso = (n: number) => n.toFixed(2);

/**
 * One block as tab-separated rows in the report's columns (A DATE … J ENDING AMOUNT), to paste
 * into the Google Sheet under its last entry. Receipts are blank when nothing came in, as there.
 */
export function accountabilityRows(block: AccountabilityBlock): string {
  const lines = [[reportDate(block.date), '', '', '', '', '', '', '', '', ''].join('\t')];
  for (const r of block.rows) {
    const d = r.denomination;
    lines.push(
      [
        '',
        d,
        r.beginning,
        peso(d * r.beginning),
        r.received || '',
        r.received ? peso(d * r.received) : '',
        r.issued,
        peso(d * r.issued),
        r.ending,
        peso(d * r.ending),
      ].join('\t'),
    );
  }
  return lines.join('\n');
}

export interface AccountabilityInput {
  /** "OCTOBER 2026" in "FOR THE MONTH OF …". */
  period: string;
  blocks: AccountabilityBlock[];
}

/** The whole report for a period, in the Google Sheet's layout, amounts by formula. */
export function accountabilityReportSheet(input: AccountabilityInput): Sheet {
  const sheet = new Sheet('REPORT');
  sheet.columns({ A: 13, B: 17, C: 10, D: 13, E: 10, F: 13, G: 10, H: 13, I: 10, J: 13 });

  const bold = { font: { bold: true } };
  const center = { align: { h: 'center', v: 'center' } } as const;
  const money = '#,##0.00';
  sheet.merge('A1:J1', text('REPORT OF ACCOUNTABILITY FOR ACCOUNTABLE FORMS'), { ...bold, ...center });
  sheet.merge('A2:J2', text('DENR - MINES AND GEOSCIENCES BUREAU -REGION III'), { ...bold, ...center });
  sheet.merge('A3:J3', text(`FOR THE MONTH OF ${input.period}`), { ...bold, ...center });

  const head = { ...bold, ...center };
  sheet.merge('C5:D5', text('BEGINNING BALANCE'), head);
  sheet.merge('E5:F5', text('RECEIPTS'), head);
  sheet.merge('G5:H5', text('ISSUED'), head);
  sheet.merge('I5:J5', text('ENDING BALANCE'), head);
  ['DATE', 'DENOMINATIONS', 'QTY', 'AMOUNT', 'QTY', 'AMOUNT', 'QTY', 'AMOUNT', 'QTY', 'AMOUNT'].forEach(
    (h, i) => sheet.set(`${'ABCDEFGHIJ'[i]}6`, text(h), head),
  );

  let r = 7;
  for (const block of input.blocks) {
    const shade = { fill: 'C9DAF8', font: { bold: true } };
    sheet.set(`A${r}`, text(reportDate(block.date)), { ...shade, align: { h: 'center' } });
    sheet.set(`B${r}`, block.label ? text(block.label) : null, { ...shade, align: { h: 'center' } });
    for (const c of 'CDEFGHIJ') sheet.set(`${c}${r}`, null, shade);
    r++;
    for (const row of block.rows) {
      const n = { align: { h: 'center' } } as const;
      const amount = { numFmt: money, align: { h: 'right' } } as const;
      sheet.set(`B${r}`, num(row.denomination), n);
      sheet.set(`C${r}`, num(row.beginning), n);
      sheet.set(`D${r}`, formula(`B${r}*C${r}`), amount);
      sheet.set(`E${r}`, row.received ? num(row.received) : null, n);
      sheet.set(`F${r}`, formula(`B${r}*E${r}`), amount);
      sheet.set(`G${r}`, num(row.issued), n);
      sheet.set(`H${r}`, formula(`B${r}*G${r}`), amount);
      sheet.set(`I${r}`, formula(`C${r}+E${r}-G${r}`), n);
      sheet.set(`J${r}`, formula(`B${r}*I${r}`), amount);
      r++;
    }
  }
  const last = r - 1;
  sheet.set(`A${r}`, text('TOTAL'), bold);
  for (const c of 'FH') {
    sheet.set(`${c}${r}`, last >= 7 ? formula(`SUM(${c}8:${c}${last})`) : num(0), {
      ...bold,
      numFmt: money,
      align: { h: 'right' },
    });
  }
  sheet.grid(`A5:J${r}`, 'thin');
  sheet.box(`A5:J${r}`, 'thin');

  sheet.page = {
    paperSize: 1,
    orientation: 'portrait',
    fitToWidth: true,
    margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    centerHorizontally: true,
  };
  return sheet;
}

/** The accountability report as an .xlsx file. */
export const buildAccountabilityReport = (input: AccountabilityInput): Uint8Array =>
  accountabilityReportSheet(input).toXlsx();
