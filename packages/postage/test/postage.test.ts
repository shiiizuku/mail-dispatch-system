import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROVINCE_ZONES,
  DEFAULT_RATE_CARD,
  quotePostage,
  zoneForProvince,
} from '../src/index.js';

const quote = (province: string, weightGrams: number, service: 'REGISTERED' | 'ORDINARY') =>
  quotePostage(DEFAULT_RATE_CARD, {
    service,
    province,
    zone: zoneForProvince(DEFAULT_PROVINCE_ZONES, province),
    weightGrams,
  });

describe('quotePostage — WEEK 2 (October 2026) registered letters', () => {
  // The log's amounts are what was stuck on the envelope; where that is ₱1 over, it is the
  // stamp-space overpay, not the rate. The rate is the log amount minus that peso.
  it.each([
    ['Pampanga', 62],
    ['Zambales', 62],
    ['Metro Manila', 67],
    ['Nueva Ecija', 67],
    ['Rizal', 72],
    ['Cavite', 72],
  ])('%s, one letter, costs ₱%i with the return card', (province, total) => {
    expect(quote(province, 20, 'REGISTERED').total).toBe(total);
  });
});

describe('quotePostage — rate card', () => {
  it('adds the ₱17 return card to registered mail', () => {
    expect(quote('Cebu', 20, 'REGISTERED')).toMatchObject({
      baseRate: 73,
      returnCardFee: 17,
      total: 90,
    });
  });

  it('charges no return card on ordinary mail', () => {
    expect(quote('Pampanga', 20, 'ORDINARY')).toMatchObject({
      baseRate: 25,
      returnCardFee: 0,
      total: 25,
    });
  });

  it('reads Last Mile 251–500 g as ₱105 (₱122 with return card)', () => {
    const q = quotePostage(DEFAULT_RATE_CARD, {
      service: 'REGISTERED',
      zone: 'LAST_MILE',
      weightGrams: 300,
    });
    expect(q.total).toBe(122);
  });

  it('puts the bracket edge in the lower bracket', () => {
    expect(quote('Pampanga', 50, 'REGISTERED').bracket).toEqual({ minGrams: 0, maxGrams: 50 });
    expect(quote('Pampanga', 51, 'REGISTERED').bracket).toEqual({ minGrams: 51, maxGrams: 100 });
    expect(quote('Pampanga', 51, 'REGISTERED').total).toBe(72);
  });

  it('refuses a weight the card does not cover', () => {
    expect(() => quote('Pampanga', 0, 'REGISTERED')).toThrow(/weight/i);
    expect(() => quote('Pampanga', 2001, 'REGISTERED')).toThrow(/2000/);
  });

  it('refuses a zone the card has no rates for', () => {
    expect(() =>
      quotePostage(DEFAULT_RATE_CARD, { service: 'REGISTERED', zone: 'MARS', weightGrams: 20 }),
    ).toThrow(/MARS/);
  });
});

describe('quotePostage — desk note for NCR and Region III (registered, 0–50 g)', () => {
  it.each([
    ['Metro Manila', 50],
    ['Bulacan', 50],
    ['Nueva Ecija', 50],
    ['Aurora', 50],
    ['Pampanga', 45],
    ['Bataan', 45],
    ['Tarlac', 45],
    ['Zambales', 45],
  ])('%s is ₱%i + ₱17 return card', (province, baseRate) => {
    const q = quote(province, 20, 'REGISTERED');
    expect(q).toMatchObject({ baseRate, total: baseRate + 17 });
    expect(q.source).toMatch(/desk note/i);
  });

  it('leaves other N. Luzon provinces on the card', () => {
    expect(quote('Pangasinan', 20, 'REGISTERED')).toMatchObject({ total: 62, source: 'card' });
  });

  it('leaves heavier letters on the card', () => {
    expect(quote('Bulacan', 80, 'REGISTERED')).toMatchObject({ total: 72, source: 'card' });
    expect(quote('Metro Manila', 80, 'REGISTERED')).toMatchObject({ total: 67, source: 'card' });
  });

  it('leaves ordinary mail on the card', () => {
    expect(quote('Metro Manila', 20, 'ORDINARY')).toMatchObject({ total: 28, source: 'card' });
    expect(quote('Bulacan', 20, 'ORDINARY')).toMatchObject({ total: 25, source: 'card' });
  });

  it('does not apply to a Last Mile address in those provinces', () => {
    const q = quotePostage(DEFAULT_RATE_CARD, {
      service: 'REGISTERED',
      province: 'Aurora',
      zone: 'LAST_MILE',
      weightGrams: 20,
    });
    expect(q).toMatchObject({ total: 107, source: 'card' });
  });
});

describe('zoneForProvince', () => {
  it('ignores case and extra spaces', () => {
    expect(zoneForProvince(DEFAULT_PROVINCE_ZONES, '  nueva   ECIJA ')).toBe('N_LUZON');
  });

  it('refuses an unknown province instead of guessing', () => {
    expect(() => zoneForProvince(DEFAULT_PROVINCE_ZONES, 'Atlantis')).toThrow(/Atlantis/);
  });
});
