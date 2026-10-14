import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './test-db.js';
import { MailService, type NewRecipient } from '../src/index.js';

let mail: MailService;

beforeEach(async () => {
  mail = new MailService(await createTestDb());
  for (const [denomination, qty] of [
    [35, 50],
    [17, 50],
    [16, 50],
    [12, 50],
    [5, 50],
    [1, 50],
  ] as const) {
    await mail.addStamps(denomination, qty);
  }
});

const pampanga: NewRecipient = {
  name: 'MS. MARIA SANTOS',
  position: 'Manager',
  company: 'Sample Quarry Corp.',
  addressLines: ['Brgy. Sample', 'City of San Fernando, Pampanga 2000'],
  province: 'Pampanga',
  lastMile: false,
};

const letterTo = (recipient: NewRecipient, extra: Partial<Parameters<MailService['createMailpiece']>[0]> = {}) => ({
  mailDate: '2026-10-14',
  service: 'REGISTERED' as const,
  docRefs: ['MMD-26-946'],
  recipient,
  weightGrams: 20,
  ...extra,
});

const stockOf = async (denomination: number) =>
  (await mail.stampStock()).find((s) => s.denomination === denomination)?.available;

describe('createMailpiece', () => {
  it('prices the letter, picks stamps and numbers it', async () => {
    const piece = await mail.createMailpiece(letterTo(pampanga));
    expect(piece).toMatchObject({
      controlNo: 'MGB-10-1',
      requiredPostage: 62,
      rateSource: 'Desk note (₱45 group)',
      stampsTotal: 63,
      stamps: [
        { denomination: 35, count: 1 },
        { denomination: 16, count: 1 },
        { denomination: 12, count: 1 },
      ],
      status: 'PREPARED',
      zone: 'N_LUZON',
    });
  });

  it('takes the stamps out of stock and records why', async () => {
    const piece = await mail.createMailpiece(letterTo(pampanga));
    expect(await stockOf(35)).toBe(49);
    expect(await stockOf(16)).toBe(49);
    expect(await stockOf(12)).toBe(49);
    expect(await stockOf(17)).toBe(50);
    const moves = await mail.stampMovements(piece.id);
    expect(moves.map((m) => [m.denomination, m.change, m.reason]).sort()).toEqual(
      [
        [12, -1, 'USED'],
        [16, -1, 'USED'],
        [35, -1, 'USED'],
      ].sort(),
    );
  });

  it('continues the control number from where Access left off', async () => {
    await mail.setControlCounter(2026, 696);
    expect((await mail.createMailpiece(letterTo(pampanga))).controlNo).toBe('MGB-10-697');
    expect((await mail.createMailpiece(letterTo(pampanga))).controlNo).toBe('MGB-10-698');
  });

  it('starts the count again in a new year, with the month of the mail date', async () => {
    await mail.setControlCounter(2026, 900);
    const piece = await mail.createMailpiece(letterTo(pampanga, { mailDate: '2027-01-05' }));
    expect(piece.controlNo).toBe('MGB-01-1');
  });

  it('prices a far-flung address as Last Mile', async () => {
    const piece = await mail.createMailpiece(letterTo({ ...pampanga, lastMile: true }));
    expect(piece).toMatchObject({ zone: 'LAST_MILE', requiredPostage: 107, rateSource: 'card' });
  });

  it('keeps several document numbers on one envelope', async () => {
    const piece = await mail.createMailpiece(
      letterTo(pampanga, { docRefs: [' MMD-26-1506 ', 'MMD-26-1509', ''] }),
    );
    expect(piece.docRefs).toEqual(['MMD-26-1506', 'MMD-26-1509']);
  });

  it('refuses a letter with no document number', async () => {
    await expect(mail.createMailpiece(letterTo(pampanga, { docRefs: [' '] }))).rejects.toThrow(
      /document/i,
    );
  });

  it('refuses when stock cannot cover the postage, and changes nothing', async () => {
    const empty = new MailService(await createTestDb());
    await empty.addStamps(1, 3);
    await expect(empty.createMailpiece(letterTo(pampanga))).rejects.toThrow(/not enough stamps/i);
    expect(await empty.listMailpieces('2026-10-01', '2026-10-31')).toEqual([]);
    expect((await empty.stampStock())[0]?.available).toBe(3);
    await empty.addStamps(35, 5);
    await empty.addStamps(17, 5);
    await empty.addStamps(5, 5);
    // The failed attempt did not use up a control number.
    expect((await empty.createMailpiece(letterTo(pampanga))).controlNo).toBe('MGB-10-1');
  });

  it('keeps the address as printed when the recipient is edited later', async () => {
    const piece = await mail.createMailpiece(letterTo(pampanga));
    await mail.saveRecipient({ ...pampanga, id: piece.recipientId, addressLines: ['New address'] });
    const [saved] = await mail.listMailpieces('2026-10-14', '2026-10-14');
    expect(saved?.recipientAddressLines).toEqual(pampanga.addressLines);
  });

  it('reuses and updates an existing recipient instead of duplicating it', async () => {
    const first = await mail.createMailpiece(letterTo(pampanga));
    await mail.createMailpiece(
      letterTo({ ...pampanga, id: first.recipientId, position: 'General Manager' }),
    );
    const found = await mail.searchRecipients('santos');
    expect(found).toHaveLength(1);
    expect(found[0]?.position).toBe('General Manager');
  });
});

describe('searchRecipients', () => {
  it('finds by part of the name or company, ignoring case', async () => {
    await mail.saveRecipient(pampanga);
    await mail.saveRecipient({ ...pampanga, name: 'ENGR. JUAN REYES', company: 'Other Co.' });
    expect((await mail.searchRecipients('quarry')).map((r) => r.name)).toEqual([
      'MS. MARIA SANTOS',
    ]);
    expect((await mail.searchRecipients('ReYeS')).map((r) => r.name)).toEqual([
      'ENGR. JUAN REYES',
    ]);
  });

  it('treats % and _ in the search text literally', async () => {
    await mail.saveRecipient(pampanga);
    expect(await mail.searchRecipients('%')).toEqual([]);
  });
});

describe('status changes', () => {
  it('records the release time', async () => {
    const piece = await mail.createMailpiece(letterTo(pampanga));
    const released = await mail.setStatus(piece.id, 'RELEASED');
    expect(released.status).toBe('RELEASED');
    expect(released.releasedAt).toBeInstanceOf(Date);
  });

  it('gives the stamps back when a letter is cancelled', async () => {
    const piece = await mail.createMailpiece(letterTo(pampanga));
    await mail.setStatus(piece.id, 'CANCELLED');
    expect(await stockOf(35)).toBe(50);
    expect(await stockOf(16)).toBe(50);
  });

  it('will not cancel a letter that has already gone out', async () => {
    const piece = await mail.createMailpiece(letterTo(pampanga));
    await mail.setStatus(piece.id, 'RELEASED');
    await expect(mail.setStatus(piece.id, 'CANCELLED')).rejects.toThrow(/released/i);
  });

  it('marks a batch as printed', async () => {
    const a = await mail.createMailpiece(letterTo(pampanga));
    const b = await mail.createMailpiece(letterTo(pampanga));
    await mail.markPrinted([a.id, b.id]);
    const list = await mail.listMailpieces('2026-10-14', '2026-10-14');
    expect(list.map((p) => p.status)).toEqual(['PRINTED', 'PRINTED']);
  });
});

describe('remail', () => {
  const sendAndRelease = async () => {
    const original = await mail.createMailpiece(letterTo(pampanga, { mailDate: '2026-10-05' }));
    return mail.setStatus(original.id, 'RELEASED');
  };

  it('sends a returned letter again as a new letter, linked to the first', async () => {
    const original = await sendAndRelease();
    await mail.setStatus(original.id, 'RETURNED');
    const again = await mail.createMailpiece(
      letterTo({ ...pampanga, id: original.recipientId }, { remailOf: original.id }),
    );
    expect(again).toMatchObject({ controlNo: 'MGB-10-2', remailOf: original.id, status: 'PREPARED' });
    expect(again.docRefs).toEqual(original.docRefs);
    expect(await stockOf(35)).toBe(48);
  });

  it('marks a released letter returned when it is remailed', async () => {
    const original = await sendAndRelease();
    await mail.createMailpiece(letterTo(pampanga, { remailOf: original.id }));
    const [after] = await mail.getMailpieces([original.id]);
    expect(after?.status).toBe('RETURNED');
  });

  it('only remails a letter that went out', async () => {
    const prepared = await mail.createMailpiece(letterTo(pampanga));
    await expect(
      mail.createMailpiece(letterTo(pampanga, { remailOf: prepared.id })),
    ).rejects.toThrow(/only.*released or returned/i);
  });

  it('will not remail the same letter twice, unless the first remail was cancelled', async () => {
    const original = await sendAndRelease();
    const first = await mail.createMailpiece(letterTo(pampanga, { remailOf: original.id }));
    await expect(
      mail.createMailpiece(letterTo(pampanga, { remailOf: original.id })),
    ).rejects.toThrow(/already remailed as MGB-10-2/i);

    await mail.setStatus(first.id, 'CANCELLED');
    const second = await mail.createMailpiece(letterTo(pampanga, { remailOf: original.id }));
    expect(second.remailOf).toBe(original.id);
  });

  it('refuses a remail of a letter that does not exist, and saves nothing', async () => {
    await expect(
      mail.createMailpiece(
        letterTo(pampanga, { remailOf: '00000000-0000-0000-0000-000000000000' }),
      ),
    ).rejects.toThrow(/no longer exists/i);
    expect(await mail.searchRecipients('santos')).toEqual([]);
  });

  it('reports both ends of each link by control number', async () => {
    const original = await sendAndRelease();
    const again = await mail.createMailpiece(letterTo(pampanga, { remailOf: original.id }));
    const links = await mail.remailLinks([original.id, again.id]);
    expect(links.get(original.id)).toEqual({ remailedAs: 'MGB-10-2' });
    expect(links.get(again.id)).toEqual({ remailOf: 'MGB-10-1' });
  });

  it('looks up the saved recipient to prefill the form', async () => {
    const original = await sendAndRelease();
    expect((await mail.getRecipient(original.recipientId))?.name).toBe('MS. MARIA SANTOS');
    expect(await mail.getRecipient('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});

describe('stamp ledger', () => {
  // A fresh book with only an opening balance, like the 09-24 accountability report.
  const fresh = async () => {
    const svc = new MailService(await createTestDb());
    await svc.setOpeningBalance(
      [
        { denomination: 35, quantity: 249 },
        { denomination: 17, quantity: 0 },
        { denomination: 16, quantity: 334 },
        { denomination: 12, quantity: 369 },
        { denomination: 5, quantity: 464 },
        { denomination: 1, quantity: 702 },
      ],
      '2026-09-24',
    );
    return svc;
  };
  const row = (ledger: Awaited<ReturnType<MailService['stampLedger']>>, d: number) =>
    ledger.find((r) => r.denomination === d);

  it('starts from the opening balance, ₱17 included at zero', async () => {
    const svc = await fresh();
    expect((await svc.stampStock()).map((s) => [s.denomination, s.available])).toEqual([
      [35, 249],
      [17, 0],
      [16, 334],
      [12, 369],
      [5, 464],
      [1, 702],
    ]);
  });

  it('refuses a second opening balance once the book has entries', async () => {
    const svc = await fresh();
    await expect(svc.setOpeningBalance([{ denomination: 35, quantity: 1 }], '2026-10-01')).rejects.toThrow(
      /already/i,
    );
  });

  it('counts a week: beginning, received, issued (used, less cancelled) and ending', async () => {
    const svc = await fresh();
    await svc.recordUsage(
      [
        { denomination: 35, count: 16 },
        { denomination: 16, count: 28 },
      ],
      '2026-10-12',
      'WEEK 2 OCT (Excel log)',
    );
    const kept = await svc.createMailpiece(letterTo(pampanga, { mailDate: '2026-10-14' }));
    const cancelled = await svc.createMailpiece(letterTo(pampanga, { mailDate: '2026-10-15' }));
    await svc.setStatus(cancelled.id, 'CANCELLED');
    await svc.addStamps(35, 100, { forDate: '2026-10-13' });
    // Outside the week: must not count.
    await svc.createMailpiece(letterTo(pampanga, { mailDate: '2026-10-19' }));

    const week = await svc.stampLedger('2026-10-12', '2026-10-18');
    expect(row(week, 35)).toEqual({ denomination: 35, beginning: 249, received: 100, issued: 17, ending: 332 });
    expect(row(week, 16)).toEqual({ denomination: 16, beginning: 334, received: 0, issued: 29, ending: 305 });
    expect(row(week, 17)).toEqual({ denomination: 17, beginning: 0, received: 0, issued: 0, ending: 0 });
    expect(kept.stamps).toEqual([
      { denomination: 35, count: 1 },
      { denomination: 16, count: 1 },
      { denomination: 12, count: 1 },
    ]);
  });

  it('dates a letter’s stamps by its mail date, not when it was typed in', async () => {
    const svc = await fresh();
    await svc.createMailpiece(letterTo(pampanga, { mailDate: '2026-10-02' }));
    expect(row(await svc.stampLedger('2026-09-28', '2026-10-04'), 35)?.issued).toBe(1);
    expect(row(await svc.stampLedger('2026-10-12', '2026-10-18'), 35)?.issued).toBe(0);
  });

  it('will not record usage the stock does not have', async () => {
    const svc = await fresh();
    await expect(svc.recordUsage([{ denomination: 17, count: 1 }], '2026-10-12', 'x')).rejects.toThrow(
      /only 0/i,
    );
  });
});

describe('signatories', () => {
  it('starts from the slip the office used last and can be changed', async () => {
    expect((await mail.signatories()).approvedBy.name).toBe('ALMA E. GATCHALIAN');
    const s = await mail.signatories();
    await mail.saveSignatories({ ...s, issuedBy: { name: 'JUAN CRUZ', designation: 'Supply Officer' } });
    expect((await mail.signatories()).issuedBy).toEqual({ name: 'JUAN CRUZ', designation: 'Supply Officer' });
  });
});
