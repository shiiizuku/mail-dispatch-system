import type { MailService, RateCard, WeightBracket, ZoneCode } from './rate-card.js';
import { normalizeProvince } from './zones.js';

export interface PostageRequest {
  service: MailService;
  zone: ZoneCode;
  weightGrams: number;
  /** Needed for the office's rate overrides; without it, the card alone prices the letter. */
  province?: string;
}

export interface PostageQuote {
  bracket: WeightBracket;
  baseRate: number;
  returnCardFee: number;
  /** What the letter must carry. The stamps put on it may be a little more; see `pickStamps`. */
  total: number;
  /** `'card'`, or the `source` of the override that set the base rate. */
  source: string;
}

export function quotePostage(card: RateCard, request: PostageRequest): PostageQuote {
  const { service, zone, weightGrams, province } = request;
  if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
    throw new Error(`Enter a weight above 0 g (got ${weightGrams})`);
  }

  const index = card.brackets.findIndex((b) => weightGrams <= b.maxGrams);
  const bracket = card.brackets[index];
  if (!bracket) {
    const heaviest = card.brackets.at(-1)?.maxGrams ?? 0;
    throw new Error(`${weightGrams} g is over the ${heaviest} g the rate card covers`);
  }

  const cardRate = card.rates[service][zone]?.[index];
  if (cardRate === undefined) {
    throw new Error(`The rate card has no ${service} rate for zone ${zone}`);
  }

  // A far-flung address is priced as Last Mile even inside a province the desk note covers.
  const wanted = province === undefined ? undefined : normalizeProvince(province);
  const override =
    wanted === undefined || zone === 'LAST_MILE'
      ? undefined
      : card.overrides.find(
          (o) =>
            o.service === service &&
            weightGrams <= o.maxGrams &&
            o.provinces.some((p) => normalizeProvince(p) === wanted),
        );

  const baseRate = override?.baseRate ?? cardRate;
  const returnCardFee = service === 'REGISTERED' ? card.returnCardFee : 0;
  return {
    bracket,
    baseRate,
    returnCardFee,
    total: baseRate + returnCardFee,
    source: override?.source ?? 'card',
  };
}
