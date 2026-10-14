# Vendored typefaces

The Civic Ledger faces, copied from the DMS (`apps/web/app/fonts/`), where their provenance, subsetting
and checksums are recorded:

| File                         | Family      | Role                        |
| ---------------------------- | ----------- | --------------------------- |
| `public-sans-variable.woff2` | Public Sans | UI and body (`--font-sans`) |
| `newsreader-variable.woff2`  | Newsreader  | Display (`--font-display`)  |

Both are under the SIL Open Font License 1.1 (`LICENSE-*.txt`). They are loaded with `next/font/local`
in `app/layout.tsx`; nothing is fetched from Google at run time.
