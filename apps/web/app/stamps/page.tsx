import { mailService } from '@/lib/mail';
import { today } from '@/lib/dates';
import { AccountabilityReportForm, AddStampsForm, ControlCounterForm, SignatoriesForm } from './forms';

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
      <h1>Stamps &amp; settings</h1>
      <div className="layout" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <AddStampsForm denominations={denominations} today={now} />
          <AccountabilityReportForm month={now.slice(0, 7)} />
          <ControlCounterForm year={year} lastSeq={lastSeq} />
          <SignatoriesForm value={signatories} />
        </div>

        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <section className="card" aria-labelledby="stock-heading">
            <h2 id="stock-heading">Stamps on hand</h2>
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
                    <td>₱{d}</td>
                    <td className="num">{onHand(d)}</td>
                    <td className="num">₱{d * onHand(d)}</td>
                    <td>{onHand(d) < LOW_STOCK && <span className="status RETURNED">low</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td />
                  <td className="num">₱{value}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="card" aria-labelledby="moves-heading">
            <h2 id="moves-heading">Recent stamp movements</h2>
            {movements.length === 0 ? (
              <p className="empty">No movements yet.</p>
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
                        <td>₱{m.denomination}</td>
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
