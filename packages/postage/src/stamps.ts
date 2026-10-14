export interface StampStock {
  denomination: number;
  available: number;
}

export interface StampPick {
  /** Largest denomination first; only denominations actually used. */
  stamps: { denomination: number; count: number }[];
  total: number;
  overpay: number;
  stampCount: number;
}

export interface PickOptions {
  /**
   * How many pesos over the postage the envelope may carry. The office would rather put a ₱5 stamp
   * on a ₱4 letter than four ₱1 stamps: envelope space is the scarce thing, not the peso.
   */
  maxOverpay: number;
}

/** A multiset of stamps, faces sorted largest first. */
type Combo = number[];

/** Fewer stamps wins; on a tie, the larger stamps first, so small ones are kept for topping up. */
function better(a: Combo, b: Combo): boolean {
  if (a.length !== b.length) return a.length < b.length;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i]! > b[i]!;
  }
  return false;
}

const merge = (combo: Combo, face: number, count: number): Combo =>
  [...combo, ...Array<number>(count).fill(face)].sort((x, y) => y - x);

/**
 * Chooses the stamps for one letter: the fewest stamps that reach `amount` without going more than
 * `maxOverpay` over it, using only what is in stock. Between equally few stamps, the smaller
 * overpay wins. Returns null when the stock cannot do it.
 */
export function pickStamps(
  amount: number,
  stock: StampStock[],
  { maxOverpay }: PickOptions,
): StampPick | null {
  if (!Number.isInteger(amount) || amount < 0) throw new Error(`Bad postage amount: ${amount}`);
  if (!Number.isInteger(maxOverpay) || maxOverpay < 0) {
    throw new Error(`Bad overpay limit: ${maxOverpay}`);
  }

  const ceiling = amount + maxOverpay;
  // best[v] = best combo summing to exactly v, using the denominations seen so far.
  let best: (Combo | undefined)[] = [[]];

  for (const { denomination, available } of stock) {
    if (denomination <= 0 || available <= 0) continue;
    const next = [...best];
    for (let v = 0; v <= ceiling; v++) {
      const maxCount = Math.min(available, Math.floor(v / denomination));
      for (let k = 1; k <= maxCount; k++) {
        const base = best[v - k * denomination];
        if (!base) continue;
        const candidate = merge(base, denomination, k);
        const current = next[v];
        if (!current || better(candidate, current)) next[v] = candidate;
      }
    }
    best = next;
  }

  let chosen: { combo: Combo; total: number } | undefined;
  for (let total = amount; total <= ceiling; total++) {
    const combo = best[total];
    if (combo && (!chosen || combo.length < chosen.combo.length)) chosen = { combo, total };
  }
  if (!chosen) return null;

  const counts = new Map<number, number>();
  for (const face of chosen.combo) counts.set(face, (counts.get(face) ?? 0) + 1);
  return {
    stamps: [...counts].map(([denomination, count]) => ({ denomination, count })),
    total: chosen.total,
    overpay: chosen.total - amount,
    stampCount: chosen.combo.length,
  };
}
