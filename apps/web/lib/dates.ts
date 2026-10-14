/** Local-calendar dates as YYYY-MM-DD, without time-zone surprises. */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const today = () => isoDate(new Date());

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};

/** Monday to Sunday of the week containing `iso`. */
export function weekOf(iso: string): { from: string; to: string } {
  const d = parse(iso);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: isoDate(monday), to: isoDate(sunday) };
}

export const shiftDays = (iso: string, days: number) => {
  const d = parse(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
};

/** "October 2026 · Week 2": the week of the month that holds the week's Monday. */
export function weekLabel(iso: string): string {
  const monday = parse(weekOf(iso).from);
  const month = monday.toLocaleString('en-PH', { month: 'long', year: 'numeric' });
  return `${month} · Week ${Math.ceil(monday.getDate() / 7)}`;
}

export const isValidIsoDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s).getTime());

/** Month (in capitals) and week-of-month for the weekly log: OCTOBER, 2 for 12–18 Oct 2026. */
export function logWeek(iso: string): { month: string; week: number } {
  const monday = parse(weekOf(iso).from);
  return {
    month: monday.toLocaleString('en-PH', { month: 'long' }).toUpperCase(),
    week: Math.ceil(monday.getDate() / 7),
  };
}

/** "WEEK 2 OF OCT", as written on the requisition slip and beside the report's dates. */
export function weekOfMonthLabel(iso: string): string {
  const { week } = logWeek(iso);
  const monday = parse(weekOf(iso).from);
  return `WEEK ${week} OF ${monday.toLocaleString('en-PH', { month: 'short' }).toUpperCase()}`;
}

/** The weeks (Monday to Sunday) whose Monday falls in month `ym` (YYYY-MM). */
export function weeksOfMonth(ym: string): { from: string; to: string }[] {
  const [y, m] = ym.split('-').map(Number);
  const weeks: { from: string; to: string }[] = [];
  for (let d = 1; d <= 31; d++) {
    const day = new Date(y!, m! - 1, d);
    if (day.getMonth() !== m! - 1) break;
    if (day.getDay() === 1) weeks.push(weekOf(isoDate(day)));
  }
  return weeks;
}

export const isValidMonth = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
