import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import * as schema from './schema.js';

/** Any Drizzle Postgres database with this schema: node-postgres in the app, PGlite in tests. */
export type MailDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export const DEFAULT_DATABASE_URL = 'postgresql://mds:mds@localhost:5434/mds';

export function connect(url = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL) {
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  return { db: drizzle(pool, { schema }) as unknown as MailDb, pool };
}
