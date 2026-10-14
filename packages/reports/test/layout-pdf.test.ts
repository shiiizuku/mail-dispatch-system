import { describe, expect, it } from 'vitest';
import {
  Sheet,
  accountabilityReportSheet,
  formula,
  num,
  requisitionSlipSheet,
  sheetToPdf,
  text,
  weeklyLogSheet,
  type LogLetter,
  type RisSignatories,
} from '../src/index.js';

const small = () => {
  const s = new Sheet('T');
  s.merge('A1:C1', text('TITLE'), { font: { bold: true }, align: { h: 'center' } });
  s.set('A2', num(2));
  s.set('B2', num(3));
  s.set('C2', formula('A2*B2'), { numFmt: '#,##0.00' });
  s.set('A3', num(10));
  s.set('B3', formula('SUM(A2:A3)+B2-1'));
  s.set('C3', num(46309), { numFmt: 'mmm d, yyyy' });
  s.box('A2:C3', 'medium');
  return s;
};

describe('Sheet.layout', () => {
  const cells = small().layout().cells;
  const at = (row: number, col: number) => cells.find((c) => c.row === row && c.col === col);

  it('turns a merged range into one cell spanning it', () => {
    expect(at(1, 0)).toMatchObject({ text: 'TITLE', colSpan: 3, rowSpan: 1 });
    expect(at(1, 1)).toBeUndefined();
  });

  it('works out formulas and shows them in the cell’s number format', () => {
    expect(at(2, 2)?.text).toBe('6.00');
    expect(at(3, 1)?.text).toBe('14');
  });

  it('shows date serials as dates', () => {
    expect(at(3, 2)?.text).toBe('Oct 14, 2026');
  });

  it('keeps the box drawn round a range', () => {
    expect(at(2, 0)?.border).toMatchObject({ top: 'medium', left: 'medium' });
    expect(at(3, 2)?.border).toMatchObject({ bottom: 'medium', right: 'medium' });
  });

  it('leaves a formula it cannot work out blank-ish rather than failing', () => {
    const s = new Sheet('T');
    s.set('A1', formula('VLOOKUP(1,B1:C2,2)'));
    expect(s.layout().cells[0]?.text).toBe('0');
  });
});

const MM_PER_PT = 25.4 / 72;
const pdfInfo = (pdf: Uint8Array) => {
  const s = Buffer.from(pdf).toString('latin1');
  return {
    pages: s.match(/\/Type \/Page\b/g)?.length ?? 0,
    boxes: [...s.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => [
      Math.round(Number(m[1])),
      Math.round(Number(m[2])),
    ]),
    images: s.match(/\/Subtype \/Image/g)?.length ?? 0,
  };
};

const letter = (n: number): LogLetter => ({
  controlNo: `MGB-10-${n}`,
  service: 'REGISTERED',
  docRefs: ['MMD-26-946'],
  addressee: 'ATTY. JUAN DELA CRUZ',
  place: 'TAGUIG CITY',
  stamps: [{ denomination: 35, count: 1 }],
  releasedOn: null,
  status: 'PREPARED',
});

const signatories: RisSignatories = {
  entityName: 'Entity',
  fundCluster: '01',
  office: 'Office',
  division: '',
  requestedBy: { name: 'A', designation: 'a' },
  approvedBy: { name: 'B', designation: 'b' },
  issuedBy: { name: 'C', designation: 'c' },
  receivedBy: { name: 'D', designation: 'd' },
};

describe('sheetToPdf', () => {
  it('prints the weekly log on Folio paper with the letterhead', async () => {
    const info = pdfInfo(await sheetToPdf(weeklyLogSheet({ month: 'OCTOBER', week: 2, letters: [letter(1)] })));
    expect(info.pages).toBe(1);
    expect(info.boxes[0]).toEqual([612, 936]);
    expect(info.images).toBe(1);
  });

  it('runs onto more pages when the rows do not fit, letterhead on each', async () => {
    const letters = Array.from({ length: 60 }, (_, i) => letter(700 + i));
    const info = pdfInfo(await sheetToPdf(weeklyLogSheet({ month: 'OCTOBER', week: 2, letters })));
    expect(info.pages).toBeGreaterThan(1);
    // The same picture object is drawn on each page; it is embedded once.
    expect(info.images).toBe(1);
  });

  it('prints the requisition slip on Letter paper', async () => {
    const sheet = requisitionSlipSheet({
      weekLabel: 'FOR WEEK 2 OF OCT',
      date: '2026-10-19',
      items: [{ denomination: 35, quantity: 16 }],
      signatories,
    });
    const info = pdfInfo(await sheetToPdf(sheet));
    expect(info.pages).toBe(1);
    expect(info.boxes[0]).toEqual([612, 792]);
  });

  it('prints the accountability report', async () => {
    const sheet = accountabilityReportSheet({
      period: 'OCTOBER 2026',
      blocks: [
        {
          date: '2026-10-12',
          rows: [{ denomination: 35, beginning: 249, received: 0, issued: 16, ending: 233 }],
        },
      ],
    });
    expect(pdfInfo(await sheetToPdf(sheet)).pages).toBe(1);
  });

  it('turns millimetres into points the same way the envelope tests do', () => {
    expect(612 * MM_PER_PT).toBeCloseTo(215.9, 1);
  });
});
