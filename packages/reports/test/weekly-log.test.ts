import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildWeeklyLog, logPlace, toLogLetter, type LogLetter } from '../src/index.js';

const letter = (over: Partial<LogLetter> = {}): LogLetter => ({
  controlNo: 'MGB-10-681',
  service: 'REGISTERED',
  docRefs: ['MMD-26-946'],
  addressee: 'ATTY. JUAN DELA CRUZ',
  place: 'TAGUIG CITY',
  stamps: [
    { denomination: 35, count: 1 },
    { denomination: 16, count: 2 },
  ],
  releasedOn: '2026-10-14',
  status: 'RELEASED',
  ...over,
});

const open = (letters: LogLetter[]) => {
  const files = unzipSync(buildWeeklyLog({ month: 'OCTOBER', week: 2, letters }));
  const text = (name: string) => strFromU8(files[name]!);
  return { files, text, sheet: text('xl/worksheets/sheet1.xml') };
};

/** The text or formula written to one cell, e.g. cell(sheet, 'A11'). */
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

describe('buildWeeklyLog', () => {
  it('lays out the registered section like the WEEK 2 template', () => {
    const { sheet } = open([letter(), letter({ controlNo: 'MGB-10-682', docRefs: ['A', 'B'] })]);
    expect(cell(sheet, 'O9')).toBe('STAMPS');
    expect(cell(sheet, 'U9')).toBe('DATE RELEASED');
    expect(cell(sheet, 'V9')).toBe('STATUS');
    expect(cell(sheet, 'A10')).toBe('No. of Letter');
    expect(cell(sheet, 'C10')).toBe('ID No.');
    expect(cell(sheet, 'E10')).toBe('DOC No.');
    expect(cell(sheet, 'H10')).toBe('Addressee');
    expect(['O10', 'P10', 'Q10', 'R10', 'S10', 'T10'].map((r) => cell(sheet, r))).toEqual([
      '35',
      '17',
      '16',
      '12',
      '5',
      '1',
    ]);
    expect(cell(sheet, 'A11')).toBe('REGISTERED MAIL -- OCTOBER ( WEEK 2 )');
    expect(cell(sheet, 'A12')).toBe('1');
    expect(cell(sheet, 'C12')).toBe('MGB-10-681');
    expect(cell(sheet, 'E12')).toBe('MMD-26-946');
    expect(cell(sheet, 'H12')).toBe('ATTY. JUAN DELA CRUZ');
    expect(cell(sheet, 'K12')).toBe('TAGUIG CITY');
    expect(cell(sheet, 'O12')).toBe('1');
    expect(cell(sheet, 'Q12')).toBe('2');
    expect(cell(sheet, 'P12')).toBe('');
    expect(cell(sheet, 'E13')).toBe('A, B');
    for (const range of ['A11:M11', 'O9:T9', 'O11:T11', 'A12:B12', 'C12:D12', 'E12:G12', 'H12:J12', 'K12:M12']) {
      expect(sheet).toContain(`<mergeCell ref="${range}"/>`);
    }
  });

  it('closes each section with NOTHING FOLLOWS, stamp totals and their peso value', () => {
    const { sheet } = open([letter(), letter({ controlNo: 'MGB-10-682' })]);
    expect(cell(sheet, 'A14')).toBe('**NOTHING FOLLOWS**');
    expect(cell(sheet, 'O14')).toBe('=SUM(O12:O13)');
    expect(cell(sheet, 'T14')).toBe('=SUM(T12:T13)');
    expect(cell(sheet, 'O15')).toBe('=O10*O14');
    // The template forgot R; every stamp gets its value here.
    expect(cell(sheet, 'R15')).toBe('=R10*R14');
    expect(cell(sheet, 'U15')).toBe('=SUM(O15:T15)');
  });

  it('puts ordinary mail in its own section after the registered one', () => {
    const { sheet } = open([letter(), letter({ controlNo: 'MGB-10-690', service: 'ORDINARY' })]);
    // Registered: title 11, row 12, totals 13–14, gap 15; ordinary title 16, headings 17, row 18.
    expect(cell(sheet, 'A16')).toBe('ORDINARY MAIL -- OCTOBER ( WEEK 2 )');
    expect(cell(sheet, 'A17')).toBe('No.');
    expect(cell(sheet, 'K17')).toBe('Address');
    expect(cell(sheet, 'C18')).toBe('MGB-10-690');
    expect(cell(sheet, 'A18')).toBe('1');
    expect(cell(sheet, 'O19')).toBe('=SUM(O18:O18)');
  });

  it('still closes an empty section, with zero totals', () => {
    const { sheet } = open([]);
    expect(cell(sheet, 'A12')).toBe('**NOTHING FOLLOWS**');
    expect(cell(sheet, 'O12')).toBe('0');
  });

  it('writes the release date as a real date, blank when not yet released', () => {
    const { sheet } = open([letter(), letter({ controlNo: 'MGB-10-682', releasedOn: null })]);
    // 2026-10-14 is Excel serial 46309.
    expect(cell(sheet, 'U12')).toBe('46309');
    expect(cell(sheet, 'U13')).toBe('');
  });

  it('keeps text as text, so an addressee starting with = is never a formula', () => {
    const { sheet } = open([letter({ addressee: '=HYPERLINK("x") & <Co>' })]);
    expect(sheet).toContain('&lt;Co&gt;');
    expect(sheet).not.toContain('<f>HYPERLINK');
  });

  it('prints like the template: Folio, portrait, fit to width, centred, letterhead in the header', () => {
    const { files, text, sheet } = open([letter()]);
    expect(sheet).toContain('paperSize="14"');
    expect(sheet).toContain('orientation="portrait"');
    expect(sheet).toContain('fitToHeight="0"');
    expect(sheet).toContain('<printOptions horizontalCentered="1"/>');
    expect(sheet).toContain('<oddHeader>&amp;C&amp;G</oddHeader>');
    expect(sheet).toContain('ySplit="10"');
    // Both sections always print, an empty ordinary one included: rows 16–19 here.
    expect(text('xl/workbook.xml')).toContain("'WEEK 2'!$A$1:$M$19");
    expect(text('xl/workbook.xml')).toContain('name="WEEK 2"');
    expect(files['xl/media/image1.jpeg']?.length).toBeGreaterThan(10_000);
  });
});

describe('toLogLetter', () => {
  const piece = {
    controlNo: 'MGB-10-697',
    service: 'REGISTERED' as const,
    docRefs: ['MMD-26-946'],
    recipientName: 'MR. KENN BRAZAN',
    recipientCompany: 'NEUTRON CONST',
    recipientAddressLines: ['Quezon City, 1100'],
    province: 'Metro Manila',
    remarks: null as string | null,
    remailOf: 'some-id' as string | null,
    stamps: [{ denomination: 35, count: 1 }],
    releasedAt: new Date(2026, 9, 14, 15, 30),
    status: 'RELEASED' as const,
  };

  it('writes the addressee as on the old log: name - company -- remail -- remarks', () => {
    expect(toLogLetter(piece).addressee).toBe('MR. KENN BRAZAN - NEUTRON CONST -- remail');
    expect(toLogLetter({ ...piece, remarks: 'new address' }).addressee).toBe(
      'MR. KENN BRAZAN - NEUTRON CONST -- remail -- new address',
    );
    expect(
      toLogLetter({ ...piece, recipientCompany: null, remailOf: null }).addressee,
    ).toBe('MR. KENN BRAZAN');
  });

  it('uses the local release date', () => {
    expect(toLogLetter(piece).releasedOn).toBe('2026-10-14');
  });
});

describe('logPlace', () => {
  it('uses the city for Metro Manila and the province elsewhere, in capitals', () => {
    expect(logPlace('Metro Manila', ['12/F Building', 'Taguig City, 1634'])).toBe('TAGUIG CITY');
    expect(logPlace('Metro Manila', ['Pasig City 1600'])).toBe('PASIG CITY');
    expect(logPlace('Pampanga', ['Brgy. Sample', 'City of San Fernando, 2000'])).toBe('PAMPANGA');
  });
});
