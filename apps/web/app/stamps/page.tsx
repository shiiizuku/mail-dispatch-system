import { mailService } from '@/lib/mail';
import { today } from '@/lib/dates';
import { EmptyState, UrgentPill } from '../ui';
import {
  AccountabilityReportForm,
  AddStampsForm,
  ControlCounterForm,
  SignatoriesForm,
} from './forms';

export const dynamic = 'force-dynamic';

const OFFICE_DENOMINATIONS = [35, 17, 16, 12, 5, 1];
const LOW_STOCK = 10;
const REASONS: Record<string, string> = {
  OPENING: 'balance brought forward',
  PURCHASE: 'received',
  CORRECTION: 'correction',
  USED: 'used',
  CANCELLED: 'returned (letter cancelled)',
};

export default async function StampsPage() {
  const mail = mailService();
  const year = new Date().getFullYear();
  const [stock, movements, lastSeq, signatories] = await Promise.all([
    mail.stampStock(),
    mail.stampMovements(),
    mail.controlCounter(year),
    mail.signatories(),
  ]);
  const now = today();
  const denominations = [
    ...new Set([...OFFICE_DENOMINATIONS, ...stock.map((s) => s.denomination)]),
  ].sort((a, b) => b - a);
  const onHand = (d: number) => stock.find((s) => s.denomination === d)?.available ?? 0;
  const value = denominations.reduce((sum, d) => sum + d * onHand(d), 0);

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Stamps &amp; settings</span>
          <h1>₱{value.toLocaleString('en-PH')} in stamps</h1>
          <p>On hand now, across {denominations.length} kinds of stamp.</p>
        </div>
      </header>
      <div className="layout">
        <div className="stack">
          <AddStampsForm denominations={denominations} today={now} />
          <AccountabilityReportForm month={now.slice(0, 7)} />
          <ControlCounterForm year={year} lastSeq={lastSeq} />
          <SignatoriesForm value={signatories} />
        </div>

        <div className="stack">
          <section aria-labelledby="stock-heading">
            <h2 id="stock-heading">Stamps on hand</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Stamp</th>
                    <th className="num">On hand</th>
                    <th className="num">Value</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {denominations.map((d) => (
                    <tr key={d}>
                      <td className="tracking-number">₱{d}</td>
                      <td className="num">{onHand(d)}</td>
                      <td className="num">₱{(d * onHand(d)).toLocaleString('en-PH')}</td>
                      <td>{onHand(d) < LOW_STOCK && <UrgentPill>Low</UrgentPill>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td />
                    <td className="num">₱{value.toLocaleString('en-PH')}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section aria-labelledby="moves-heading">
            <h2 id="moves-heading">Recent stamp movements</h2>
            {movements.length === 0 ? (
              <EmptyState title="No stamp movements yet">
                Stamps received, used on letters and corrected are listed here.
              </EmptyState>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>For</th>
                      <th>Stamp</th>
                      <th className="num">Change</th>
                      <th>Reason</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.slice(0, 30).map((m) => (
                      <tr key={m.id}>
                        <td className="nowrap">{m.forDate}</td>
                        <td className="tracking-number">₱{m.denomination}</td>
                        <td className="num">{m.change > 0 ? `+${m.change}` : m.change}</td>
                        <td>{REASONS[m.reason] ?? m.reason.toLowerCase()}</td>
                        <td>{m.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
