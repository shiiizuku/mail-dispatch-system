import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

/**
 * Everything lives in its own `mail` schema, so the tables can move into the DMS database later
 * without colliding with its own.
 */
export const mail = pgSchema('mail');

export const mailServiceEnum = mail.enum('mail_service', ['REGISTERED', 'ORDINARY']);

/**
 * PREPARED → PRINTED → RELEASED → DELIVERED, or RETURNED (and then remailed as a new piece).
 * CANCELLED gives its stamps back to stock.
 */
export const mailpieceStatusEnum = mail.enum('mailpiece_status', [
  'PREPARED',
  'PRINTED',
  'RELEASED',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
]);

/** The address book. Grows as letters are sent; nothing is imported from Access. */
export const recipients = mail.table(
  'recipients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 240 }).notNull(),
    position: varchar('position', { length: 240 }),
    company: varchar('company', { length: 240 }),
    /** As printed: building, street, barangay, city + ZIP. Province is kept separately for postage. */
    addressLines: text('address_lines').array().notNull(),
    province: varchar('province', { length: 80 }).notNull(),
    /** Far-flung / remote / special area: PHLPost's Last Mile, whatever the province. */
    lastMile: boolean('last_mile').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [index('recipients_name_idx').on(sql`lower(${t.name})`)],
);

/** One envelope. Address and postage are copied in, so later edits never rewrite history. */
export const mailpieces = mail.table(
  'mailpieces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    controlNo: varchar('control_no', { length: 40 }).notNull().unique(),
    controlYear: integer('control_year').notNull(),
    controlSeq: integer('control_seq').notNull(),
    mailDate: date('mail_date').notNull(),
    service: mailServiceEnum('service').notNull(),
    /** Document reference numbers in this envelope, e.g. MMD-26-946. One or more. */
    docRefs: text('doc_refs').array().notNull(),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => recipients.id),
    recipientName: varchar('recipient_name', { length: 240 }).notNull(),
    recipientPosition: varchar('recipient_position', { length: 240 }),
    recipientCompany: varchar('recipient_company', { length: 240 }),
    recipientAddressLines: text('recipient_address_lines').array().notNull(),
    province: varchar('province', { length: 80 }).notNull(),
    zone: varchar('zone', { length: 40 }).notNull(),
    weightGrams: integer('weight_grams').notNull(),
    baseRate: integer('base_rate').notNull(),
    returnCardFee: integer('return_card_fee').notNull(),
    requiredPostage: integer('required_postage').notNull(),
    /** 'card' or the override that priced it, e.g. "Desk note (₱50 group)". */
    rateSource: varchar('rate_source', { length: 120 }).notNull(),
    stamps: jsonb('stamps').$type<{ denomination: number; count: number }[]>().notNull(),
    stampsTotal: integer('stamps_total').notNull(),
    status: mailpieceStatusEnum('status').notNull().default('PREPARED'),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    remailOf: uuid('remail_of').references((): AnyPgColumn => mailpieces.id),
    remarks: text('remarks'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('mailpieces_mail_date_idx').on(t.mailDate)],
);

/** Control numbers run per year: MGB-<month>-<seq>, seq continuing across months. */
export const controlCounters = mail.table('control_counters', {
  year: integer('year').primaryKey(),
  lastSeq: integer('last_seq').notNull(),
});

export const stampStock = mail.table('stamp_stock', {
  denomination: integer('denomination').primaryKey(),
  available: integer('available').notNull().default(0),
});

/**
 * Every change to stamp stock, so the count on hand can always be explained. Reasons: OPENING
 * (balance brought forward), PURCHASE (received), CORRECTION, USED, CANCELLED (returned to stock).
 */
export const stampMovements = mail.table('stamp_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  denomination: integer('denomination').notNull(),
  /** Positive when stamps are bought or returned, negative when used. */
  change: integer('change').notNull(),
  reason: varchar('reason', { length: 40 }).notNull(),
  mailpieceId: uuid('mailpiece_id').references(() => mailpieces.id),
  /**
   * The day the movement counts for in weekly and monthly totals: a letter's mail date, or the
   * day stamps were received. `at` is only when it was typed in.
   */
  forDate: date('for_date').notNull().defaultNow(),
  note: text('note'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

/** Small office settings, one JSON value per key (e.g. the requisition slip's signatories). */
export const settings = mail.table('settings', {
  key: varchar('key', { length: 60 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
