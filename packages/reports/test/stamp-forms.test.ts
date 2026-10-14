import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  accountabilityRows,
  buildAccountabilityReport,
  buildRequisitionSlip,
  type RisSignatories,
} from '../src/index.js';

const signatories: RisSignatories = {
  entityName: 'Mines and Geosciences Bureau Region III',
  fundCluster: '01 101 101',
  office: 'MGB, Region 3',
  division: '',
  requestedBy: { name: 'REQUESTER NAME', designation: 'Administrative Assistant II' },
  approvedBy: { name: 'APPROVER NAME', designation: 'OIC Chief, Finance and Admin. Div.' },
  issuedBy: { name: 'ISSUER NAME', designation: 'Administrative Officer III' },
  receivedBy: { name: 'REQUESTER NAME', designation: 'Administrative Assistant II' },
};

const sheetOf = (xlsx: Uint8Array) => {
  const files = unzipSync(xlsx);
  return {
    sheet: strFromU8(files['xl/worksheets/sheet1.xml']!),
    workbook: strFromU8(files['xl/workbook.xml']!),
  };
};

const cell = (sheet: string, ref: string) => {
  const m = sheet.match(new RegExp(`<c r="${ref}"[^>]*?(?:/>|>(.*?)</c>)`));
  if (!m) return undefined;
  const body = m[1] ?? '';
  return (
    body.match(/<t[^>]*>(.*?)<\/t>/)?.[1] ??
    body.match(/<f>(.*?)<\/f>/)?.[1]?.replace(/^/, '=') ??
    body.match(/<v>(.*?)<\/v>/)?.[1] ??
    ''
  );
};

describe('buildRequisitionSlip', () => {
  const { sheet, workbook } = sheetOf(
    buildRequisitionSlip({
      weekLabel: 'FOR WEEK 2 OF OCT',
      date: '2026-10-19',
      items: [
        { denomination: 35, quantity: 16 },
        { denomination: 17, quantity: 0 },
        { denomination: 16, quantity: 28 },
        { denomination: 1, quantity: 16 },
      ],
      signatories,
    }),
  );

  it('fills in the slip like the office template', () => {
    expect(cell(sheet, 'A3')).toBe('REQUISITION AND ISSUE SLIP');
    expect(cell(sheet, 'A4')).toBe('Entity Name : Mines and Geosciences Bureau Region III');
    expect(cell(sheet, 'G4')).toBe('Fund Cluster : 01 101 101');
    expect(cell(sheet, 'A7')).toBe('Office : MGB, Region 3');
    expect(cell(sheet, 'C10')).toBe('POSTAGE STAMPS');
    expect(cell(sheet, 'C11')).toBe('FOR WEEK 2 OF OCT');
  });

  it('lists each stamp with its quantity, leaving out stamps not used', () => {
    expect([cell(sheet, 'C12'), cell(sheet, 'D12')]).toEqual(['35', '16']);
    expect([cell(sheet, 'C13'), cell(sheet, 'D13')]).toEqual(['16', '28']);
    expect([cell(sheet, 'C14'), cell(sheet, 'D14')]).toEqual(['1', '16']);
    expect(cell(sheet, 'C15')).toBe('');
  });

  it('names the four signatories and dates the request', () => {
    expect(cell(sheet, 'C23')).toBe('REQUESTER NAME');
    expect(cell(sheet, 'D23')).toBe('APPROVER NAME');
    expect(cell(sheet, 'F23')).toBe('ISSUER NAME');
    expect(cell(sheet, 'H23')).toBe('REQUESTER NAME');
    expect(cell(sheet, 'D24')).toBe('OIC Chief, Finance and Admin. Div.');
    expect(cell(sheet, 'C25')).toBe('10/19/2026');
  });

  it('prints the top half of a Letter page, centred, in Times New Roman', () => {
    expect(sheet).toContain('paperSize="1"');
    expect(sheet).toContain('<printOptions horizontalCentered="1"/>');
    expect(workbook).toContain('$A$1:$H$25');
    expect(sheet).toContain('<mergeCell ref="A3:H3"/>');
    expect(sheet).toContain('<mergeCell ref="D23:E23"/>');
  });

  it('refuses a slip with nothing to request', () => {
    expect(() =>
      buildRequisitionSlip({ weekLabel: 'x', date: null, items: [], signatories }),
    ).toThrow(/no stamps/i);
  });
});

const block = {
  date: '2026-10-12',
  label: 'WEEK 2 OF OCT',
  rows: [
    { denomination: 35, beginning: 249, received: 0, issued: 16, ending: 233 },
    { denomination: 17, beginning: 0, received: 0, issued: 0, ending: 0 },
    { denomination: 16, beginning: 334, received: 100, issued: 28, ending: 406 },
  ],
};

describe('accountabilityRows', () => {
  it('gives tab-separated rows in the Google Sheet’s columns, to paste under the last entry', () => {
    expect(accountabilityRows(block).split('\n')).toEqual([
      '10-12-2026\t\t\t\t\t\t\t\t\t',
      '\t35\t249\t8715.00\t\t\t16\t560.00\t233\t8155.00',
      '\t17\t0\t0.00\t\t\t0\t0.00\t0\t0.00',
      '\t16\t334\t5344.00\t100\t1600.00\t28\t448.00\t406\t6496.00',
    ]);
  });
});

describe('buildAccountabilityReport', () => {
  const { sheet } = sheetOf(buildAccountabilityReport({ period: 'OCTOBER 2026', blocks: [block] }));

  it('has the report headings', () => {
    expect(cell(sheet, 'A1')).toBe('REPORT OF ACCOUNTABILITY FOR ACCOUNTABLE FORMS');
    expect(cell(sheet, 'A2')).toBe('DENR - MINES AND GEOSCIENCES BUREAU -REGION III');
    expect(cell(sheet, 'A3')).toBe('FOR THE MONTH OF OCTOBER 2026');
    expect(cell(sheet, 'C5')).toBe('BEGINNING BALANCE');
    expect(cell(sheet, 'E5')).toBe('RECEIPTS');
    expect(cell(sheet, 'G5')).toBe('ISSUED');
    expect(cell(sheet, 'I5')).toBe('ENDING BALANCE');
    expect(cell(sheet, 'A6')).toBe('DATE');
  });

  it('writes each week as a dated block, amounts worked out by formula', () => {
    expect(cell(sheet, 'A7')).toBe('10-12-2026');
    expect(cell(sheet, 'B7')).toBe('WEEK 2 OF OCT');
    expect(cell(sheet, 'B8')).toBe('35');
    expect(cell(sheet, 'C8')).toBe('249');
    expect(cell(sheet, 'D8')).toBe('=B8*C8');
    expect(cell(sheet, 'G8')).toBe('16');
    expect(cell(sheet, 'I8')).toBe('=C8+E8-G8');
    expect(cell(sheet, 'J8')).toBe('=B8*I8');
    expect(cell(sheet, 'E10')).toBe('100');
  });

  it('totals the amounts issued and received at the end', () => {
    expect(cell(sheet, 'A11')).toBe('TOTAL');
    expect(cell(sheet, 'H11')).toBe('=SUM(H8:H10)');
    expect(cell(sheet, 'F11')).toBe('=SUM(F8:F10)');
  });
});
