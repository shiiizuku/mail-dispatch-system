import { readFileSync } from 'node:fs';
import { Sheet, formula, num, text, type Style } from './xlsx.js';

/**
 * The weekly mailing log, laid out like the Records Unit's "WEEK n.xlsx" template: a registered
 * section and an ordinary section, each closed by **NOTHING FOLLOWS** with stamp totals, the
 * letterhead in the page header, Folio paper, columns A–M printed and the stamp tally beside them.
 */

export interface LogLetter {
  controlNo: string;
  service: 'REGISTERED' | 'ORDINARY';
  docRefs: string[];
  /** As it should read in the log, e.g. "MR. KENN BRAZAN - NEUTRON CONST -- remail". */
  addressee: string;
  /** City for Metro Manila, province elsewhere; see `logPlace`. */
  place: string;
  stamps: { denomination: number; count: number }[];
  /** YYYY-MM-DD, or null when not released yet. */
  releasedOn: string | null;
  status: string;
}

export interface WeeklyLogInput {
  /** Month name as it appears in the section titles, e.g. "OCTOBER". */
  month: string;
  week: number;
  /** In the order they should be listed; each section numbers its own letters from 1. */
  letters: LogLetter[];
  /** Stamp columns, left to right. */
  denominations?: number[];
}

export const DEFAULT_DENOMINATIONS = [35, 17, 16, 12, 5, 1];

/** The report letterhead, shown centred in the page header on every printed page. */
const LETTERHEAD = new URL('../assets/report-letterhead.jpeg', import.meta.url);

const CENTER = { h: 'center', v: 'center' } as const;
const BOX = { left: 'thin', right: 'thin', top: 'thin', bottom: 'thin' } as const;
const S = {
  cell: { align: CENTER, border: BOX },
  wrap: { align: { ...CENTER, wrap: true }, border: BOX },
  head: { font: { bold: true }, align: { ...CENTER, wrap: true }, border: BOX },
  banner: { font: { bold: true, size: 15 }, align: CENTER, border: BOX },
  title: { font: { bold: true, size: 12 }, align: { h: 'left', v: 'center' }, border: BOX },
  shade: { fill: 'AEAAAA', border: BOX },
  nothing: { font: { bold: true, size: 14 }, align: CENTER, border: BOX },
  total: { font: { bold: true }, align: CENTER, border: BOX },
  value: { font: { bold: true, size: 12 }, align: CENTER },
  date: { align: CENTER, border: BOX, numFmt: 'mmm d, yyyy' },
} satisfies Record<string, Style>;

/** Days since 1899-12-30, Excel's date serial, for a YYYY-MM-DD date. */
export const excelDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y!, m! - 1, d!) - Date.UTC(1899, 11, 30)) / 86_400_000);
};

/** Row heights, in points, copied from the template. */
const H = {
  top: [62.25, 14.1, 14.1, 13.5, 13.5, 14.1, 13.5, 21],
  banner: 19.5,
  title: 23.25,
  row: 24.75,
  nothing: 30.75,
};

export function weeklyLogSheet(input: WeeklyLogInput): Sheet {
  const denominations = input.denominations ?? DEFAULT_DENOMINATIONS;
  const stampCols = [...'OPQRST'].slice(0, denominations.length);
  const lastStamp = stampCols.at(-1)!;
  const sheet = new Sheet(`WEEK ${input.week}`);

  sheet.columns({ E: 9, I: 10.5703125, J: 19.85546875, M: 14.140625, N: 11.28515625, O: 10.42578125, P: 9.140625, T: 8.28515625, U: 14.7109375, V: 12.7109375 });
  sheet.freezeRows(10);
  sheet.setHeaderImage(new Uint8Array(readFileSync(LETTERHEAD)), 551.25, 95.25);

  // Rows 1–8 leave room for the letterhead printed in the page header.
  H.top.forEach((h, i) => sheet.height(i + 1, h));

  sheet.height(9, H.banner);
  sheet.merge('A9:M9', null, S.banner);
  sheet.merge(`O9:${lastStamp}9`, text('STAMPS'), S.head);
  sheet.set('U9', text('DATE RELEASED'), S.head);
  sheet.set('V9', text('STATUS'), S.head);

  const headings = (r: number, first: string) => {
    sheet.merge(`A${r}:B${r}`, text(first), S.head);
    sheet.merge(`C${r}:D${r}`, text('ID No.'), S.head);
    sheet.merge(`E${r}:G${r}`, text('DOC No.'), S.head);
    sheet.merge(`H${r}:J${r}`, text('Addressee'), S.head);
    sheet.merge(`K${r}:M${r}`, text('Address'), S.head);
  };

  headings(10, 'No. of Letter');
  stampCols.forEach((c, i) => sheet.set(`${c}10`, num(denominations[i]!), S.head));
  sheet.set('U10', null, S.cell);
  sheet.set('V10', null, S.cell);

  const section = (titleRow: number, service: LogLetter['service']): number => {
    const label = service === 'REGISTERED' ? 'REGISTERED MAIL' : 'ORDINARY MAIL';
    sheet.height(titleRow, service === 'REGISTERED' ? H.title : 21);
    sheet.merge(
      `A${titleRow}:M${titleRow}`,
      text(`${label} -- ${input.month} ( WEEK ${input.week} )`),
      S.title,
    );
    sheet.merge(`O${titleRow}:${lastStamp}${titleRow}`, null, S.shade);
    sheet.set(`U${titleRow}`, null, S.cell);
    sheet.set(`V${titleRow}`, null, S.cell);

    let r = titleRow + 1;
    if (service === 'ORDINARY') headings(r++, 'No.');

    const first = r;
    input.letters
      .filter((l) => l.service === service)
      .forEach((l, i) => {
        sheet.height(r, H.row);
        sheet.merge(`A${r}:B${r}`, num(i + 1), S.cell);
        sheet.merge(`C${r}:D${r}`, text(l.controlNo), S.cell);
        sheet.merge(`E${r}:G${r}`, text(l.docRefs.join(', ')), S.wrap);
        sheet.merge(`H${r}:J${r}`, text(l.addressee), S.wrap);
        sheet.merge(`K${r}:M${r}`, text(l.place), S.wrap);
        stampCols.forEach((c, k) => {
          const count = l.stamps.find((s) => s.denomination === denominations[k])?.count ?? 0;
          sheet.set(`${c}${r}`, count ? num(count) : null, S.cell);
        });
        sheet.set(`U${r}`, l.releasedOn ? num(excelDate(l.releasedOn)) : null, S.date);
        sheet.set(`V${r}`, text(l.status), S.cell);
        r++;
      });
    const last = r - 1;

    const totals = r;
    sheet.height(totals, H.nothing);
    sheet.merge(`A${totals}:M${totals}`, text('**NOTHING FOLLOWS**'), S.nothing);
    stampCols.forEach((c) =>
      sheet.set(
        `${c}${totals}`,
        last >= first ? formula(`SUM(${c}${first}:${c}${last})`) : num(0),
        S.total,
      ),
    );

    const value = totals + 1;
    stampCols.forEach((c) => sheet.set(`${c}${value}`, formula(`${c}10*${c}${totals}`), S.value));
    sheet.set(`U${value}`, formula(`SUM(O${value}:${lastStamp}${value})`), S.value);
    return value;
  };

  const registeredEnd = section(11, 'REGISTERED');
  const lastRow = section(registeredEnd + 2, 'ORDINARY');

  sheet.page = {
    paperSize: 14,
    orientation: 'portrait',
    fitToWidth: true,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    centerHorizontally: true,
    printArea: `$A$1:$M$${lastRow}`,
  };
  return sheet;
}

/** The weekly log as an .xlsx file. */
export const buildWeeklyLog = (input: WeeklyLogInput): Uint8Array =>
  weeklyLogSheet(input).toXlsx();

// ── From a saved letter ─────────────────────────────────────────────────────

/** The fields `toLogLetter` reads; a `Mailpiece` from @mds/mail has them all. */
export interface LogSource {
  controlNo: string;
  service: 'REGISTERED' | 'ORDINARY';
  docRefs: string[];
  recipientName: string;
  recipientCompany: string | null;
  recipientAddressLines: string[];
  province: string;
  remarks: string | null;
  /** Set when this letter is a remail of an earlier one. */
  remailOf: string | null;
  stamps: { denomination: number; count: number }[];
  releasedAt: Date | null;
  status: string;
}

const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Where the letter went, as the old log wrote it: the city for Metro Manila (TAGUIG CITY, PASIG
 * CITY), the province elsewhere (PAMPANGA). The city is the last address line without its ZIP.
 */
export function logPlace(province: string, addressLines: string[]): string {
  if (province === 'Metro Manila') {
    const city = (addressLines.at(-1) ?? '').replace(/[\s,]*\d{4}\s*$/, '').replace(/[\s,]+$/, '');
    if (city) return city.toUpperCase();
  }
  return province.toUpperCase();
}

export function toLogLetter(p: LogSource): LogLetter {
  return {
    controlNo: p.controlNo,
    service: p.service,
    docRefs: p.docRefs,
    addressee: [
      p.recipientName,
      p.recipientCompany && ` - ${p.recipientCompany}`,
      p.remailOf && ' -- remail',
      p.remarks && ` -- ${p.remarks}`,
    ]
      .filter(Boolean)
      .join(''),
    place: logPlace(p.province, p.recipientAddressLines),
    stamps: p.stamps,
    releasedOn: p.releasedAt ? localIso(p.releasedAt) : null,
    status: p.status,
  };
}
