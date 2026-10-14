// `npm run db:migrate`: applies the SQL in ../drizzle. Kept out of the package's main entry, so
// the web app never bundles a path to the migrations folder.
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { connect } from './db.js';

const { db, pool } = connect();
try {
  await migrate(db as never, {
    migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
  });
  console.log('mail schema is up to date');
} finally {
  await pool.end();
}
