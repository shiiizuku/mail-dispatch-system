# Mail Dispatch System

Replaces the Records Unit's MS Access envelope workflow: enter the document number, pick the
recipient, print #10 envelopes, and get the postage and the stamps to put on each letter.

Built separately for now, in the same stack as `C:\document-management-tracking-system` (TypeScript,
Drizzle + PostgreSQL, Next.js), so it can later become that system's mail module: a DMS release by
**Mailed → Postal** will open a draft letter here.

## Running it

Needs Docker Desktop (already used by the DMS) and Node 22+.

```bash
npm install
npm run db:up
npm run build
npm run db:migrate
npm run dev
```

Then open http://localhost:3010. The database runs on port **5434**, separate from the DMS (5433).

First time only, on **Stamps & settings**:

1. Enter the stamps on hand (one entry per denomination).
2. Under **Control numbers**, enter the last number Access used this year (e.g. 696), so the next
   letter continues as MGB-10-697.

## Packages

| Package                                   | Role                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| [`@mds/postage`](packages/postage/src)    | Rate card, desk-note overrides, province → zone, postage quote, stamp picker.      |
| [`@mds/envelope`](packages/envelope/src)  | #10 envelope PDF (241 × 105 mm) and the calibration page.                          |
| [`@mds/reports`](packages/reports/src)    | Weekly log, requisition slip, accountability report: Excel and PDF from one sheet. |
| [`@mds/mail`](packages/mail/src)          | Database schema and `MailService`: recipients, letters, control numbers, stamps.   |
| [`@mds/web`](apps/web/app)                | The Mail Desk screens (Next.js).                                                   |

`@mds/mail` has no web framework in it; the DMS's NestJS API can wrap `MailService` directly.

## Postage rules

- Rates are PHLPost domestic, origin Luzon ([rate-card.ts](packages/postage/src/rate-card.ts)).
- **Registered** = zone rate + ₱17 return card (every registered letter has one). **Ordinary** = zone rate.
- Desk note, registered letters up to 50 g: NCR, Bulacan, Nueva Ecija, Aurora ₱50; Pampanga,
  Bataan, Tarlac, Zambales ₱45.
- Stamps: fewest stamps, allowing up to ₱2 over to save envelope space, using only stamps in stock
  ([stamps.ts](packages/postage/src/stamps.ts)). Stamps leave stock when a letter is saved and come
  back if it is cancelled.

## Previews, Excel and PDF

Every file opens first in a preview dialog showing it as it will print (the browser's own PDF
viewer, which can print it), with its download buttons: envelopes as PDF; the weekly log,
requisition slip and accountability report as **Excel or PDF**. The PDF is drawn from the same sheet
as the .xlsx (`@mds/reports` `sheetToPdf`): Excel's paper, margins, scaling, print area and
page-header letterhead, so the two always agree. Report URLs take `?format=pdf`, and `&inline=1` to
show rather than download.

## Weekly log

**Weekly log** on the Letters page gives `WEEK n` (Excel or PDF) for the week shown, laid
out like the old template: registered and ordinary sections, **NOTHING FOLLOWS**, stamp totals and
their peso value, letterhead in the page header, Folio paper, columns A–M printed. Cancelled letters
are left out. The *Address* column is the city for Metro Manila and the province elsewhere.

## Stamps: requisition slip and accountability report

Stamp stock is a ledger: every stamp in or out is a dated movement (balance brought forward,
received, correction, used on a letter, returned by a cancelled letter). A letter's stamps count for
its **mail date**, so each week's totals are exact.

- **Letters page → Stamps this week**: beginning, received, issued and ending for each stamp.
  - **Requisition slip** (Excel or PDF): the Requisition and Issue Slip for the week ("FOR WEEK 2 OF
    OCT"), with the signatories set on the Stamps page.
  - **Copy rows for the accountability report**: the week's rows in the Google Sheet's columns
    (DATE … ENDING AMOUNT), to paste under its last entry.
- **Stamps page → Accountability report**: the Report of Accountability for Accountable Forms for a
  month, Excel or PDF, one block per week.

Opening stock was brought forward from the report's 09-24-2026 balances, and the WEEK 2 (October)
Excel log's stamps (MGB-10-681 to 696) were recorded as used that week.

## Letter statuses

Prepared → Printed → Released → Delivered or Returned. Prepared or printed letters can be
cancelled; their stamps go back to stock.

## Commands

```bash
npm test            # all packages (database tests use an in-memory Postgres, no Docker needed)
npm run typecheck
npm run db:generate -w @mds/mail   # after changing packages/mail/src/schema.ts
```
