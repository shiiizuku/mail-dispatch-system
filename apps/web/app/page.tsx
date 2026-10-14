import Link from 'next/link';
import { mailService } from '@/lib/mail';
import { accountabilityRows } from '@mds/reports';
import { isValidIsoDate, shiftDays, today, weekLabel, weekOf, weekOfMonthLabel } from '@/lib/dates';
import { LetterForm, type RemailDraft } from './letter-form';
import { LettersTable } from './letters-table';
import { PreviewDialog } from './preview-dialog';
import { StampWeek } from './stamp-week';

export const dynamic = 'force-dynamic';

export default async function LettersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; remail?: string }>;
}) {
  const { date, remail: remailId } = await searchParams;
  const now = today();
  const day = isValidIsoDate(date) ? date : now;
  const { from, to } = weekOf(day);
  const mail = mailService();
  const letters = await mail.listMailpieces(from, to);
  const links = Object.fromEntries(await mail.remailLinks(letters.map((l) => l.id)));
  const remail = isUuid(remailId) ? await loadRemail(remailId) : null;
  const ledger = await mail.stampLedger(from, to);
  const label = weekOfMonthLabel(day);
  // New letters default to today when looking at this week, else to that week's Monday.
  const defaultDate = now >= from && now <= to ? now : from;

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Letters · {weekRange(from, to)}</span>
          <h1>{weekLabel(day)}</h1>
        </div>
        <nav className="header-actions" aria-label="Weeks">
          <Link className="button" href={`/?date=${shiftDays(from, -7)}`}>
            ← Previous week
          </Link>
          {(now < from || now > to) && (
            <Link className="button" href="/">
              This week
            </Link>
          )}
          <Link className="button" href={`/?date=${shiftDays(from, 7)}`}>
            Next week →
          </Link>
          <PreviewDialog
            label="Weekly log"
            eyebrow={weekRange(from, to)}
            title={`Weekly log · ${weekLabel(day)}`}
            previewUrl={`/reports/weekly?date=${from}&format=pdf&inline=1`}
            downloads={[
              { label: 'Download Excel', href: `/reports/weekly?date=${from}` },
              { label: 'Download PDF', href: `/reports/weekly?date=${from}&format=pdf` },
            ]}
          />
        </nav>
      </header>
      <div className="layout">
        <LetterForm defaultDate={defaultDate} remail={remail} />
        <div className="stack">
          <LettersTable letters={letters} links={links} />
          <StampWeek
            from={from}
            label={label}
            rows={ledger}
            tsv={accountabilityRows({ date: from, label, rows: ledger })}
            today={now}
          />
        </div>
      </div>
    </>
  );
}

/** "12–18 Oct 2026", or "28 Sep – 4 Oct 2026" across a month end. */
function weekRange(from: string, to: string): string {
  const d = (iso: string) => new Date(`${iso}T00:00:00`);
  const a = d(from);
  const b = d(to);
  const month = (x: Date) => x.toLocaleString('en-PH', { month: 'short' });
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${month(b)} ${b.getFullYear()}`
    : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)} ${b.getFullYear()}`;
}

const isUuid = (s: unknown): s is string =>
  typeof s === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** The letter to send again, with its recipient as the address book has them now. */
async function loadRemail(id: string): Promise<RemailDraft | null> {
  const mail = mailService();
  const [piece] = await mail.getMailpieces([id]);
  if (!piece) return null;
  const recipient = await mail.getRecipient(piece.recipientId);
  return {
    id: piece.id,
    controlNo: piece.controlNo,
    status: piece.status,
    docRefs: piece.docRefs,
    service: piece.service,
    weightGrams: piece.weightGrams,
    recipient: recipient ?? {
      id: '',
      name: piece.recipientName,
      position: piece.recipientPosition,
      company: piece.recipientCompany,
      addressLines: piece.recipientAddressLines,
      province: piece.province,
      lastMile: piece.zone === 'LAST_MILE',
    },
  };
}
