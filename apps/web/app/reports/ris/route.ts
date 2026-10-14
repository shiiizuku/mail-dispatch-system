import { buildRequisitionSlip } from '@mds/reports';
import { mailService } from '@/lib/mail';
import { isValidIsoDate, today, weekOf, weekOfMonthLabel } from '@/lib/dates';

/**
 * GET /reports/ris?date=YYYY-MM-DD[&on=YYYY-MM-DD] → the requisition and issue slip for the stamps
 * issued in the week holding `date` (used on letters, less cancelled), dated `on` (default today).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const date = params.get('date');
  const on = params.get('on');
  const day = isValidIsoDate(date) ? date : today();
  const { from, to } = weekOf(day);
  const mail = mailService();
  const [ledger, signatories] = await Promise.all([mail.stampLedger(from, to), mail.signatories()]);
  const label = weekOfMonthLabel(day);

  try {
    const xlsx = buildRequisitionSlip({
      weekLabel: `FOR ${label}`,
      items: ledger.map((r) => ({ denomination: r.denomination, quantity: r.issued })),
      date: isValidIsoDate(on) ? on : today(),
      signatories,
    });
    return new Response(new Uint8Array(xlsx), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="RIS - ${label}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'Cannot make the slip', { status: 422 });
  }
}
