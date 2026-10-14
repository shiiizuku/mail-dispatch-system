import { buildAccountabilityReport } from '@mds/reports';
import { mailService } from '@/lib/mail';
import { isValidMonth, today, weekOfMonthLabel, weeksOfMonth } from '@/lib/dates';

/**
 * GET /reports/accountability?month=YYYY-MM → the Report of Accountability for Accountable Forms
 * for that month: one block per week (Monday in the month) in which stamps came in or went out.
 */
export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get('month');
  const ym = isValidMonth(month) ? month : today().slice(0, 7);
  const mail = mailService();

  const blocks = [];
  for (const week of weeksOfMonth(ym)) {
    const rows = await mail.stampLedger(week.from, week.to);
    if (rows.some((r) => r.issued || r.received)) {
      blocks.push({ date: week.from, label: weekOfMonthLabel(week.from), rows });
    }
  }
  const [y, m] = ym.split('-').map(Number);
  const period = new Date(y!, m! - 1, 1)
    .toLocaleString('en-PH', { month: 'long', year: 'numeric' })
    .toUpperCase();

  const xlsx = buildAccountabilityReport({ period, blocks });
  return new Response(new Uint8Array(xlsx), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ACCOUNTABILITY - ${period}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
