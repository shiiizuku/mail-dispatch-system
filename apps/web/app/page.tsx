import Link from 'next/link';
import { mailService } from '@/lib/mail';
import { accountabilityRows } from '@mds/reports';
import { isValidIsoDate, shiftDays, today, weekLabel, weekOf, weekOfMonthLabel } from '@/lib/dates';
import { LetterForm, type RemailDraft } from './letter-form';
import { LettersTable } from './letters-table';
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
      <div className="week-nav">
        <h1>{weekLabel(day)}</h1>
        <span className="range">
          {from} to {to}
        </span>
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
        <a className="button" href={`/reports/weekly?date=${from}`} download>
          Download weekly log (Excel)
        </a>
      </div>
      <div className="layout">
        <LetterForm defaultDate={defaultDate} remail={remail} />
        <div>
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

const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

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
