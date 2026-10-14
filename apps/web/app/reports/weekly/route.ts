import { toLogLetter, weeklyLogSheet } from '@mds/reports';
import { sheetResponse } from '@/lib/files';
import { mailService } from '@/lib/mail';
import { isValidIsoDate, logWeek, today, weekOf } from '@/lib/dates';

/**
 * GET /reports/weekly?date=YYYY-MM-DD → the weekly mailing log for the week holding that date,
 * as "WEEK n" in the Records Unit's template layout (Excel, or PDF with ?format=pdf). Cancelled
 * letters are left out.
 */
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get('date');
  const day = isValidIsoDate(date) ? date : today();
  const { from, to } = weekOf(day);
  const { month, week } = logWeek(day);

  const letters = (await mailService().listMailpieces(from, to))
    .filter((p) => p.status !== 'CANCELLED')
    .map(toLogLetter);
  return sheetResponse(request, weeklyLogSheet({ month, week, letters }), `WEEK ${week}`);
}
