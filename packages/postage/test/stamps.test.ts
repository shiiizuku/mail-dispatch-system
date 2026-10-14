import { describe, expect, it } from 'vitest';
import { pickStamps, type StampStock } from '../src/index.js';

const OFFICE_STAMPS: StampStock[] = [35, 17, 16, 12, 5, 1].map((denomination) => ({
  denomination,
  available: 100,
}));

const faces = (amount: number, stock = OFFICE_STAMPS, maxOverpay = 2) =>
  pickStamps(amount, stock, { maxOverpay })?.stamps.flatMap((s) =>
    Array<number>(s.count).fill(s.denomination),
  );

describe('pickStamps', () => {
  it('pays ₱1 over when it saves a stamp: ₱62 → 35 + 16 + 12', () => {
    const pick = pickStamps(62, OFFICE_STAMPS, { maxOverpay: 2 });
    expect(pick).toMatchObject({ total: 63, overpay: 1, stampCount: 3 });
    expect(faces(62)).toEqual([35, 16, 12]);
  });

  it('is exact when exact is already fewest: ₱67 → 35 + 16 + 16', () => {
    expect(faces(67)).toEqual([35, 16, 16]);
  });

  it('never overpays past the limit', () => {
    expect(faces(62, OFFICE_STAMPS, 0)).toEqual([35, 17, 5, 5]);
    // 35 + 35 would be two stamps, but ₱3 over.
    expect(faces(67, OFFICE_STAMPS, 2)).toHaveLength(3);
    expect(faces(67, OFFICE_STAMPS, 3)).toEqual([35, 35]);
  });

  it('puts ₱5 on a ₱4 letter rather than four ₱1 stamps', () => {
    expect(faces(4)).toEqual([5]);
  });

  it('uses only stamps in stock', () => {
    const no16 = OFFICE_STAMPS.map((s) => (s.denomination === 16 ? { ...s, available: 0 } : s));
    const pick = faces(67, no16)!;
    expect(pick).not.toContain(16);
    expect(pick.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(67);

    const one35 = OFFICE_STAMPS.map((s) => (s.denomination === 35 ? { ...s, available: 1 } : s));
    expect(faces(72, one35)!.filter((d) => d === 35)).toHaveLength(1);
  });

  it('returns null when the stock cannot cover the amount', () => {
    expect(pickStamps(62, [{ denomination: 35, available: 1 }], { maxOverpay: 2 })).toBeNull();
  });

  it('rejects nonsense input', () => {
    expect(() => pickStamps(-1, OFFICE_STAMPS, { maxOverpay: 2 })).toThrow();
    expect(() => pickStamps(62, OFFICE_STAMPS, { maxOverpay: -1 })).toThrow();
  });
});
