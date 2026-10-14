import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or, sql } from 'drizzle-orm';
import {
  DEFAULT_PROVINCE_ZONES,
  DEFAULT_RATE_CARD,
  pickStamps,
  quotePostage,
  zoneForProvince,
  type MailService as Service,
  type PostageQuote,
  type StampPick,
} from '@mds/postage';
import type { MailDb } from './db.js';
import {
  controlCounters,
  mailpieces,
  recipients,
  settings,
  stampMovements,
  stampStock,
} from './schema.js';

export type Recipient = typeof recipients.$inferSelect;
export type Mailpiece = typeof mailpieces.$inferSelect;
export type MailpieceStatus = Mailpiece['status'];
export type StampMovement = typeof stampMovements.$inferSelect;

export interface NewRecipient {
  /** Present when the recipient is already in the address book; their entry is updated. */
  id?: string;
  name: string;
  position?: string | null;
  company?: string | null;
  addressLines: string[];
  province: string;
  lastMile: boolean;
}

export interface NewMailpiece {
  /** YYYY-MM-DD. Sets the month in the control number. */
  mailDate: string;
  service: Service;
  docRefs: string[];
  recipient: NewRecipient;
  weightGrams: number;
  remarks?: string | null;
  remailOf?: string | null;
}

export interface PostagePreview {
  zone: string;
  quote: PostageQuote;
  /** Null when the stock on hand cannot make up the postage. */
  stamps: StampPick | null;
}

export interface LedgerRow {
  denomination: number;
  beginning: number;
  received: number;
  issued: number;
  ending: number;
}

export interface Signatory {
  name: string;
  designation: string;
}

/** Who signs the requisition and issue slip, and the slip's fixed header lines. */
export interface Signatories {
  entityName: string;
  fundCluster: string;
  office: string;
  division: string;
  requestedBy: Signatory;
  approvedBy: Signatory;
  issuedBy: Signatory;
  receivedBy: Signatory;
}

/** From the office's last requisition and issue slip (week 3 of September 2026). */
export const DEFAULT_SIGNATORIES: Signatories = {
  entityName: 'Mines and Geosciences Bureau Region III',
  fundCluster: '01 101 101',
  office: 'MGB, Region 3',
  division: '',
  requestedBy: { name: 'JOSEPH ANGELO I. NUNAG', designation: 'Administrative Assistant II' },
  approvedBy: { name: 'ALMA E. GATCHALIAN', designation: 'OIC Chief, Finance and Admin. Div.' },
  issuedBy: { name: 'JESICA L. LEGASPI', designation: 'Administrative Officer III' },
  receivedBy: { name: 'JOSEPH ANGELO I. NUNAG', designation: 'Administrative Assistant II' },
};

export interface MailSettings {
  controlPrefix: string;
  /** Pesos over the postage a letter may carry to save stamps. */
  maxOverpay: number;
}

const DEFAULT_SETTINGS: MailSettings = { controlPrefix: 'MGB', maxOverpay: 2 };

/** Statuses a letter may move to from each status. */
const NEXT: Record<MailpieceStatus, MailpieceStatus[]> = {
  PREPARED: ['PRINTED', 'RELEASED', 'CANCELLED'],
  PRINTED: ['PREPARED', 'RELEASED', 'CANCELLED'],
  RELEASED: ['DELIVERED', 'RETURNED'],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const clean = (s: string | null | undefined) => {
  const t = s?.trim().replace(/\s+/g, ' ');
  return t ? t : null;
};
const cleanLines = (lines: string[]) => lines.map(clean).filter((l): l is string => l !== null);

/** Escapes LIKE wildcards so the search text is matched literally. */
const likeLiteral = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * The mail desk's operations. Framework-free: the web app calls it today, and a NestJS module in
 * the DMS can wrap it later.
 */
export class MailService {
  private readonly settings: MailSettings;

  constructor(
    private readonly db: MailDb,
    settings: Partial<MailSettings> = {},
  ) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  // ── Recipients ────────────────────────────────────────────────────────────

  async searchRecipients(query: string, limit = 10): Promise<Recipient[]> {
    const q = query.trim();
    if (!q) return [];
    const pattern = `%${likeLiteral(q)}%`;
    return this.db
      .select()
      .from(recipients)
      .where(or(ilike(recipients.name, pattern), ilike(recipients.company, pattern)))
      .orderBy(sql`${recipients.lastUsedAt} desc nulls last`, asc(recipients.name))
      .limit(limit);
  }

  async saveRecipient(input: NewRecipient, db: MailDb = this.db): Promise<Recipient> {
    const name = clean(input.name);
    if (!name) throw new Error('Enter the recipient’s name');
    const addressLines = cleanLines(input.addressLines);
    if (addressLines.length === 0) throw new Error('Enter the recipient’s address');
    const province = clean(input.province);
    if (!province) throw new Error('Choose the province');
    // Fails early on a province with no postage zone, before anything is saved.
    zoneForProvince(DEFAULT_PROVINCE_ZONES, province);

    const values = {
      name,
      position: clean(input.position),
      company: clean(input.company),
      addressLines,
      province,
      lastMile: input.lastMile,
    };
    if (input.id) {
      const [row] = await db
        .update(recipients)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(recipients.id, input.id))
        .returning();
      if (!row) throw new Error('That recipient no longer exists');
      return row;
    }
    const [row] = await db.insert(recipients).values(values).returning();
    return row!;
  }

  // ── Postage ───────────────────────────────────────────────────────────────

  /** What a letter would cost and which stamps it would take, without saving anything. */
  async previewPostage(input: {
    service: Service;
    province: string;
    lastMile: boolean;
    weightGrams: number;
  }): Promise<PostagePreview> {
    const zone = input.lastMile ? 'LAST_MILE' : zoneForProvince(DEFAULT_PROVINCE_ZONES, input.province);
    const quote = quotePostage(DEFAULT_RATE_CARD, {
      service: input.service,
      zone,
      province: input.province,
      weightGrams: input.weightGrams,
    });
    const stock = await this.stampStock();
    return {
      zone,
      quote,
      stamps: pickStamps(quote.total, stock, { maxOverpay: this.settings.maxOverpay }),
    };
  }

  // ── Mailpieces ────────────────────────────────────────────────────────────

  async createMailpiece(input: NewMailpiece): Promise<Mailpiece> {
    const docRefs = cleanLines(input.docRefs);
    if (docRefs.length === 0) throw new Error('Enter at least one document number');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.mailDate)) throw new Error('Enter the mail date');

    return this.db.transaction(async (tx) => {
      const db = tx as unknown as MailDb;
      if (input.remailOf) await this.claimForRemail(db, input.remailOf);
      const recipient = await this.saveRecipient(input.recipient, db);
      const zone = recipient.lastMile
        ? 'LAST_MILE'
        : zoneForProvince(DEFAULT_PROVINCE_ZONES, recipient.province);
      const quote = quotePostage(DEFAULT_RATE_CARD, {
        service: input.service,
        zone,
        province: recipient.province,
        weightGrams: input.weightGrams,
      });

      // Lock the stock rows so two desks cannot spend the same stamps.
      const stock = await db
        .select()
        .from(stampStock)
        .orderBy(desc(stampStock.denomination))
        .for('update');
      const pick = pickStamps(quote.total, stock, { maxOverpay: this.settings.maxOverpay });
      if (!pick) {
        throw new Error(
          `Not enough stamps in stock for ₱${quote.total}. Add stamps on the Stamps page.`,
        );
      }

      const year = Number(input.mailDate.slice(0, 4));
      const month = input.mailDate.slice(5, 7);
      const [counter] = await db
        .insert(controlCounters)
        .values({ year, lastSeq: 1 })
        .onConflictDoUpdate({
          target: controlCounters.year,
          set: { lastSeq: sql`${controlCounters.lastSeq} + 1` },
        })
        .returning();
      const seq = counter!.lastSeq;

      const [piece] = await db
        .insert(mailpieces)
        .values({
          controlNo: `${this.settings.controlPrefix}-${month}-${seq}`,
          controlYear: year,
          controlSeq: seq,
          mailDate: input.mailDate,
          service: input.service,
          docRefs,
          recipientId: recipient.id,
          recipientName: recipient.name,
          recipientPosition: recipient.position,
          recipientCompany: recipient.company,
          recipientAddressLines: recipient.addressLines,
          province: recipient.province,
          zone,
          weightGrams: input.weightGrams,
          baseRate: quote.baseRate,
          returnCardFee: quote.returnCardFee,
          requiredPostage: quote.total,
          rateSource: quote.source,
          stamps: pick.stamps,
          stampsTotal: pick.total,
          remailOf: input.remailOf ?? null,
          remarks: clean(input.remarks),
        })
        .returning();

      await this.moveStamps(db, pick.stamps, -1, 'USED', piece!.id, input.mailDate);
      await db
        .update(recipients)
        .set({ lastUsedAt: new Date() })
        .where(eq(recipients.id, recipient.id));
      return piece!;
    });
  }

  /**
   * Checks a letter can be sent again and marks it returned if it was still out. Locks the
   * original, so two desks cannot remail it at once.
   */
  private async claimForRemail(db: MailDb, originalId: string): Promise<void> {
    const [original] = await db
      .select()
      .from(mailpieces)
      .where(eq(mailpieces.id, originalId))
      .for('update');
    if (!original) throw new Error('The letter being remailed no longer exists');
    if (original.status !== 'RELEASED' && original.status !== 'RETURNED') {
      throw new Error(
        `${original.controlNo} is ${original.status.toLowerCase()}; only released or returned letters can be remailed`,
      );
    }
    const [earlier] = await db
      .select({ controlNo: mailpieces.controlNo })
      .from(mailpieces)
      .where(and(eq(mailpieces.remailOf, originalId), ne(mailpieces.status, 'CANCELLED')));
    if (earlier) {
      throw new Error(`${original.controlNo} was already remailed as ${earlier.controlNo}`);
    }
    if (original.status === 'RELEASED') {
      await db.update(mailpieces).set({ status: 'RETURNED' }).where(eq(mailpieces.id, originalId));
    }
  }

  /**
   * For each given letter, the control number it is a remail of and the one it was remailed as
   * (cancelled remails ignored). Letters with neither are left out.
   */
  async remailLinks(ids: string[]): Promise<Map<string, { remailOf?: string; remailedAs?: string }>> {
    const links = new Map<string, { remailOf?: string; remailedAs?: string }>();
    if (ids.length === 0) return links;
    const add = (id: string, link: { remailOf?: string; remailedAs?: string }) =>
      links.set(id, { ...links.get(id), ...link });

    const pieces = await this.getMailpieces(ids);
    const originals = await this.getMailpieces(
      pieces.map((p) => p.remailOf).filter((id): id is string => id !== null),
    );
    for (const p of pieces) {
      const of = originals.find((o) => o.id === p.remailOf);
      if (of) add(p.id, { remailOf: of.controlNo });
    }
    const remails = await this.db
      .select({ remailOf: mailpieces.remailOf, controlNo: mailpieces.controlNo })
      .from(mailpieces)
      .where(and(inArray(mailpieces.remailOf, ids), ne(mailpieces.status, 'CANCELLED')));
    for (const r of remails) if (r.remailOf) add(r.remailOf, { remailedAs: r.controlNo });
    return links;
  }

  async getRecipient(id: string): Promise<Recipient | null> {
    const [row] = await this.db.select().from(recipients).where(eq(recipients.id, id));
    return row ?? null;
  }

  /** Letters by mail date, inclusive, in control-number order. */
  async listMailpieces(from: string, to: string): Promise<Mailpiece[]> {
    return this.db
      .select()
      .from(mailpieces)
      .where(and(gte(mailpieces.mailDate, from), lte(mailpieces.mailDate, to)))
      .orderBy(asc(mailpieces.controlYear), asc(mailpieces.controlSeq));
  }

  async getMailpieces(ids: string[]): Promise<Mailpiece[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(mailpieces)
      .where(inArray(mailpieces.id, ids))
      .orderBy(asc(mailpieces.controlYear), asc(mailpieces.controlSeq));
  }

  async setStatus(id: string, status: MailpieceStatus): Promise<Mailpiece> {
    return this.db.transaction(async (tx) => {
      const db = tx as unknown as MailDb;
      const [piece] = await db.select().from(mailpieces).where(eq(mailpieces.id, id)).for('update');
      if (!piece) throw new Error('That letter no longer exists');
      if (piece.status === status) return piece;
      if (!NEXT[piece.status].includes(status)) {
        throw new Error(`A ${piece.status.toLowerCase()} letter cannot be marked ${status.toLowerCase()}`);
      }
      if (status === 'CANCELLED') {
        await this.moveStamps(db, piece.stamps, +1, 'CANCELLED', piece.id, piece.mailDate);
      }
      const [updated] = await db
        .update(mailpieces)
        .set({ status, ...(status === 'RELEASED' ? { releasedAt: new Date() } : {}) })
        .where(eq(mailpieces.id, id))
        .returning();
      return updated!;
    });
  }

  /** After the envelopes come out of the printer. Only letters still being prepared move. */
  async markPrinted(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(mailpieces)
      .set({ status: 'PRINTED' })
      .where(and(inArray(mailpieces.id, ids), eq(mailpieces.status, 'PREPARED')));
  }

  /** Continues numbering from an earlier system: the next letter gets `lastSeq + 1`. */
  async setControlCounter(year: number, lastSeq: number): Promise<void> {
    if (!Number.isInteger(lastSeq) || lastSeq < 0) throw new Error('Enter a whole number');
    await this.db
      .insert(controlCounters)
      .values({ year, lastSeq })
      .onConflictDoUpdate({ target: controlCounters.year, set: { lastSeq } });
  }

  async controlCounter(year: number): Promise<number> {
    const [row] = await this.db
      .select()
      .from(controlCounters)
      .where(eq(controlCounters.year, year));
    return row?.lastSeq ?? 0;
  }

  // ── Stamps ────────────────────────────────────────────────────────────────

  async stampStock() {
    return this.db.select().from(stampStock).orderBy(desc(stampStock.denomination));
  }

  /** Stamps received (positive) or a count corrected (either sign). */
  async addStamps(
    denomination: number,
    quantity: number,
    options: { reason?: 'PURCHASE' | 'CORRECTION'; forDate?: string; note?: string | null } = {},
  ): Promise<void> {
    if (!Number.isInteger(denomination) || denomination <= 0) throw new Error('Bad denomination');
    if (!Number.isInteger(quantity) || quantity === 0) throw new Error('Enter a quantity');
    const forDate = options.forDate ?? isoToday();
    if (!ISO_DATE.test(forDate)) throw new Error('Enter the date');
    await this.db.transaction(async (tx) => {
      const db = tx as unknown as MailDb;
      await db.insert(stampStock).values({ denomination, available: 0 }).onConflictDoNothing();
      await this.changeStock(db, denomination, quantity);
      await db.insert(stampMovements).values({
        denomination,
        change: quantity,
        reason: options.reason ?? 'PURCHASE',
        forDate,
        note: clean(options.note),
      });
    });
  }

  /**
   * The stock brought forward from the accountability report, once, before anything else is
   * recorded. A zero balance still makes the stamp show (₱17 when it has run out).
   */
  async setOpeningBalance(
    balances: { denomination: number; quantity: number }[],
    forDate: string,
  ): Promise<void> {
    if (!ISO_DATE.test(forDate)) throw new Error('Enter the date of the balance');
    await this.db.transaction(async (tx) => {
      const db = tx as unknown as MailDb;
      const [any] = await db.select({ id: stampMovements.id }).from(stampMovements).limit(1);
      if (any) throw new Error('Stamp stock already has entries; use Add stamps or a correction');
      for (const { denomination, quantity } of balances) {
        if (
          !Number.isInteger(denomination) ||
          denomination <= 0 ||
          !Number.isInteger(quantity) ||
          quantity < 0
        ) {
          throw new Error(`Bad opening balance for ₱${denomination}`);
        }
        await db.insert(stampStock).values({ denomination, available: quantity });
        if (quantity > 0) {
          await db.insert(stampMovements).values({
            denomination,
            change: quantity,
            reason: 'OPENING',
            forDate,
            note: `Balance brought forward, ${forDate}`,
          });
        }
      }
    });
  }

  /** Stamps used outside this app (e.g. letters logged only in Excel), counted for `forDate`. */
  async recordUsage(
    stamps: { denomination: number; count: number }[],
    forDate: string,
    note: string,
  ): Promise<void> {
    if (!ISO_DATE.test(forDate)) throw new Error('Enter the date');
    await this.db.transaction(async (tx) => {
      const db = tx as unknown as MailDb;
      for (const { denomination, count } of stamps) {
        if (!count) continue;
        await this.changeStock(db, denomination, -count);
        await db
          .insert(stampMovements)
          .values({ denomination, change: -count, reason: 'USED', forDate, note: clean(note) });
      }
    });
  }

  /**
   * Per stamp, for `from`..`to` inclusive: the balance before, stamps received (and corrections),
   * stamps issued (used on letters, less any given back by cancelling) and the balance after.
   * The rows of the accountability report and the quantities of the requisition slip.
   */
  async stampLedger(from: string, to: string): Promise<LedgerRow[]> {
    const denoms = await this.db
      .select({ denomination: stampStock.denomination })
      .from(stampStock)
      .orderBy(desc(stampStock.denomination));
    const m = stampMovements;
    const inRange = sql`${m.forDate} between ${from} and ${to}`;
    const sums = await this.db
      .select({
        denomination: m.denomination,
        before: sql<number>`coalesce(sum(${m.change}) filter (where ${m.forDate} < ${from}), 0)::int`,
        received: sql<number>`coalesce(sum(${m.change}) filter (where ${inRange} and ${m.reason} not in ('USED', 'CANCELLED')), 0)::int`,
        used: sql<number>`coalesce(sum(${m.change}) filter (where ${inRange} and ${m.reason} in ('USED', 'CANCELLED')), 0)::int`,
      })
      .from(m)
      .groupBy(m.denomination);
    return denoms.map(({ denomination }) => {
      const row = sums.find((x) => x.denomination === denomination);
      const beginning = Number(row?.before ?? 0);
      const received = Number(row?.received ?? 0);
      const issued = 0 - Number(row?.used ?? 0); // not -x, which gives -0 for nothing used
      return { denomination, beginning, received, issued, ending: beginning + received - issued };
    });
  }

  // -- Settings ---------------------------------------------------------------

  async signatories(): Promise<Signatories> {
    const [row] = await this.db.select().from(settings).where(eq(settings.key, 'signatories'));
    return { ...DEFAULT_SIGNATORIES, ...(row?.value as Partial<Signatories> | undefined) };
  }

  async saveSignatories(value: Signatories): Promise<void> {
    await this.db
      .insert(settings)
      .values({ key: 'signatories', value })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  }

  async stampMovements(mailpieceId?: string): Promise<StampMovement[]> {
    const q = this.db.select().from(stampMovements);
    return (mailpieceId ? q.where(eq(stampMovements.mailpieceId, mailpieceId)) : q).orderBy(
      desc(stampMovements.forDate),
      desc(stampMovements.at),
    );
  }

  /** Adds `change` to a stamp's count on hand, refusing to go below zero. */
  private async changeStock(db: MailDb, denomination: number, change: number) {
    const [row] = await db
      .update(stampStock)
      .set({ available: sql`${stampStock.available} + ${change}` })
      .where(eq(stampStock.denomination, denomination))
      .returning();
    if (!row) throw new Error(`No ₱${denomination} stamps in stock`);
    if (row.available < 0) {
      throw new Error(`Only ${row.available - change} ₱${denomination} stamps on hand`);
    }
  }

  private async moveStamps(
    db: MailDb,
    stamps: { denomination: number; count: number }[],
    sign: 1 | -1,
    reason: string,
    mailpieceId: string,
    forDate: string,
  ) {
    for (const { denomination, count } of stamps) {
      const change = sign * count;
      await db
        .update(stampStock)
        .set({ available: sql`${stampStock.available} + ${change}` })
        .where(eq(stampStock.denomination, denomination));
      await db.insert(stampMovements).values({ denomination, change, reason, mailpieceId, forDate });
    }
  }
}
