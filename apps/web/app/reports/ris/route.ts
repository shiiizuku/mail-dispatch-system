import { requisitionSlipSheet } from '@mds/reports';
import { sheetResponse } from '@/lib/files';
import { mailService } from '@/lib/mail';
import { isValidIsoDate, today, weekOf, weekOfMonthLabel } from '@/lib/dates';

/**
 * GET /reports/ris?date=YYYY-MM-DD[&on=YYYY-MM-DD] → the requisition and issue slip for the stamps
 * issued in the week holding `date` (used on letters, less cancelled), dated `on` (default today).
 * Excel, or PDF with ?format=pdf.
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
    const sheet = requisitionSlipSheet({
      weekLabel: `FOR ${label}`,
      items: ledger.map((r) => ({ denomination: r.denomination, quantity: r.issued })),
      date: isValidIsoDate(on) ? on : today(),
      signatories,
    });
    return await sheetResponse(request, sheet, `RIS - ${label}`);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'Cannot make the slip', { status: 422 });
  }
}
