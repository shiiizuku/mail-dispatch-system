/**
 * PHLPost domestic rates, origin Luzon, as printed on the card the Records Unit keeps at the desk.
 *
 * Only base rates are stored. The handwritten "w/RC" figures on the card are always base + ₱17, so
 * the return card is one fee rather than a second copy of the table that could drift from the first.
 *
 * This is seed data. Once the database exists it owns the live card, and this file is what a fresh
 * install starts from.
 */

export type MailService = 'REGISTERED' | 'ORDINARY';

/** A zone code. Zones are configurable, so this is any upper snake case string, not a fixed union. */
export type ZoneCode = string;

export interface WeightBracket {
  minGrams: number;
  maxGrams: number;
}

/**
 * A price the office actually pays that differs from the card, for some provinces. Applies to
 * letters up to `maxGrams`; heavier ones fall back to the card.
 */
export interface RateOverride {
  /** Shown beside the price so staff can see where it came from. */
  source: string;
  service: MailService;
  provinces: string[];
  maxGrams: number;
  baseRate: number;
}

export interface RateCard {
  /** Contiguous, ascending, starting at 0. A rate row lines up with the bracket at the same index. */
  brackets: WeightBracket[];
  rates: Record<MailService, Record<ZoneCode, number[]>>;
  /** Added to every registered letter: all registered mail goes with a return card. */
  returnCardFee: number;
  /** Checked before the card. The first one that matches wins. */
  overrides: RateOverride[];
}

export const DEFAULT_RATE_CARD: RateCard = {
  brackets: [
    { minGrams: 0, maxGrams: 50 },
    { minGrams: 51, maxGrams: 100 },
    { minGrams: 101, maxGrams: 250 },
    { minGrams: 251, maxGrams: 500 },
    { minGrams: 501, maxGrams: 1000 },
    { minGrams: 1001, maxGrams: 1500 },
    { minGrams: 1501, maxGrams: 2000 },
  ],
  rates: {
    REGISTERED: {
      N_LUZON: [45, 55, 65, 75, 95, 115, 140],
      NCR: [45, 50, 55, 60, 70, 85, 100],
      S_LUZON: [55, 65, 75, 85, 105, 125, 150],
      VISAYAS: [73, 78, 83, 88, 98, 113, 128],
      MINDANAO: [78, 83, 88, 93, 103, 118, 133],
      // 251–500 g reads 108 in the photo; confirmed as 105 (122 w/RC − 17).
      LAST_MILE: [90, 95, 100, 105, 115, 130, 145],
    },
    ORDINARY: {
      N_LUZON: [25, 30, 35, 40, 50, 65, 80],
      NCR: [28, 33, 38, 43, 53, 68, 83],
      S_LUZON: [33, 38, 43, 48, 58, 73, 88],
      // UNCONFIRMED: 0–50 g for Visayas and Mindanao read as 34 and 41 in the photo; every other row
      // steps +5 per column, which gives the 38 and 43 used here. Check against the card.
      VISAYAS: [38, 43, 48, 53, 63, 78, 93],
      MINDANAO: [43, 48, 53, 58, 68, 83, 98],
      LAST_MILE: [55, 60, 65, 70, 80, 95, 110],
    },
  },
  returnCardFee: 17,
  // The Records Unit's desk note for registered letters to NCR and Region III. It gives one price
  // per group and no weights, so it is read as the ordinary single-letter (0–50 g) price.
  overrides: [
    {
      source: 'Desk note (₱50 group)',
      service: 'REGISTERED',
      provinces: ['Metro Manila', 'Bulacan', 'Nueva Ecija', 'Aurora'],
      maxGrams: 50,
      baseRate: 50,
    },
    {
      source: 'Desk note (₱45 group)',
      service: 'REGISTERED',
      provinces: ['Pampanga', 'Bataan', 'Tarlac', 'Zambales'],
      maxGrams: 50,
      baseRate: 45,
    },
  ],
};
