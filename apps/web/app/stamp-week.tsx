'use client';

import { useId, useState } from 'react';
import type { LedgerRow } from '@mds/mail';

/**
 * This week's stamps: what the requisition slip will ask for and what the accountability report
 * records. The slip downloads as Excel; the report rows copy for pasting into the Google Sheet.
 */
export function StampWeek(props: {
  from: string;
  label: string;
  rows: LedgerRow[];
  tsv: string;
  today: string;
}) {
  const { from, label, rows, tsv, today } = props;
  const id = useId();
  const [slipDate, setSlipDate] = useState(today);
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);
  const issued = rows.reduce((sum, r) => sum + r.issued * r.denomination, 0);
  const anything = rows.some((r) => r.issued > 0);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied('ok');
      return;
    } catch {
      // Some browsers refuse the clipboard API; the older copy command often still works.
    }
    const area = document.createElement('textarea');
    area.value = tsv;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    setCopied(ok ? 'ok' : 'failed');
  };

  return (
    <section className="card" aria-labelledby={`${id}-h`} style={{ marginTop: '1.25rem' }}>
      <h2 id={`${id}-h`}>Stamps this week ({label})</h2>
      {rows.length === 0 ? (
        <p className="empty">No stamps on record yet. Add them on the Stamps page.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Stamp</th>
                <th className="num">Beginning</th>
                <th className="num">Received</th>
                <th className="num">Issued this week</th>
                <th className="num">Ending</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.denomination}>
                  <td>₱{r.denomination}</td>
                  <td className="num">{r.beginning}</td>
                  <td className="num">{r.received || ''}</td>
                  <td className="num">{r.issued}</td>
                  <td className="num">{r.ending}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Issued this week</td>
                <td className="num">₱{issued.toLocaleString('en-PH')}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="toolbar" style={{ marginTop: '0.75rem', alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`${id}-date`}>Slip date</label>
          <input
            id={`${id}-date`}
            type="date"
            value={slipDate}
            onChange={(e) => setSlipDate(e.target.value)}
          />
        </div>
        <a
          className="button primary"
          href={anything ? `/reports/ris?date=${from}&on=${slipDate}` : undefined}
          aria-disabled={!anything}
          onClick={(e) => !anything && e.preventDefault()}
          download
        >
          Requisition slip (Excel)
        </a>
        <button type="button" onClick={copy} disabled={rows.length === 0}>
          Copy rows for the accountability report
        </button>
      </div>
      {copied === 'ok' && (
        <p className="notice ok" role="status">
          Copied {rows.length + 1} rows. In the Google Sheet, click column A of the first empty row
          under the last entry and paste (Ctrl+V).
        </p>
      )}
      {copied === 'failed' && (
        <div role="status">
          <p className="notice err">
            The browser would not copy. Select the rows below and copy them yourself.
          </p>
          <textarea readOnly rows={rows.length + 1} value={tsv} onFocus={(e) => e.target.select()} />
        </div>
      )}
    </section>
  );
}
