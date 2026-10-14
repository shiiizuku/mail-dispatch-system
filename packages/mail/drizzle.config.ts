import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  schemaFilter: ['mail'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://mds:mds@localhost:5434/mds',
  },
  strict: true,
});
