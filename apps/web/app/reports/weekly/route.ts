import { buildWeeklyLog, toLogLetter } from '@mds/reports';
import { mailService } from '@/lib/mail';
import { isValidIsoDate, logWeek, today, weekOf } from '@/lib/dates';

/**
 * GET /reports/weekly?date=YYYY-MM-DD → the weekly mailing log for the week holding that date,
 * as "WEEK n.xlsx" in the Records Unit's template layout. Cancelled letters are left out.
 */
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get('date');
  const day = isValidIsoDate(date) ? date : today();
  const { from, to } = weekOf(day);
  const { month, week } = logWeek(day);

  const letters = (await mailService().listMailpieces(from, to))
    .filter((p) => p.status !== 'CANCELLED')
    .map(toLogLetter);
  const xlsx = buildWeeklyLog({ month, week, letters });

  return new Response(new Uint8Array(xlsx), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="WEEK ${week}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
