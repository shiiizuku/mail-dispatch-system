'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { Mailpiece, MailpieceStatus } from '@mds/mail';
import { markPrinted, setLetterStatus, type FormState } from './actions';

const DENOMINATIONS = [35, 17, 16, 12, 5, 1];

/** The buttons each status offers. Mirrors the service's rules; the service has the final say. */
const ACTIONS: Partial<Record<MailpieceStatus, { to: MailpieceStatus; label: string }[]>> = {
  PREPARED: [
    { to: 'RELEASED', label: 'Released' },
    { to: 'CANCELLED', label: 'Cancel' },
  ],
  PRINTED: [
    { to: 'RELEASED', label: 'Released' },
    { to: 'CANCELLED', label: 'Cancel' },
  ],
  RELEASED: [
    { to: 'DELIVERED', label: 'Delivered' },
    { to: 'RETURNED', label: 'Returned' },
  ],
};

const stampCount = (p: Mailpiece, d: number) =>
  p.stamps.find((s) => s.denomination === d)?.count ?? 0;

type Links = Record<string, { remailOf?: string; remailedAs?: string }>;

/** A letter that went out and was not already sent again can be remailed. */
const canRemail = (l: Mailpiece, links: Links) =>
  (l.status === 'RELEASED' || l.status === 'RETURNED') && !links[l.id]?.remailedAs;

export function LettersTable({ letters, links }: { letters: Mailpiece[]; links: Links }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<FormState>(null);
  const [pending, startTransition] = useTransition();

  const printable = letters.filter((l) => l.status !== 'CANCELLED');
  const chosen = printable.filter((l) => selected.has(l.id));
  const allChosen = printable.length > 0 && chosen.length === printable.length;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = (fn: () => Promise<FormState>) =>
    startTransition(async () => setNotice(await fn()));

  const printIds = (chosen.length ? chosen : printable.filter((l) => l.status === 'PREPARED')).map(
    (l) => l.id,
  );

  return (
    <section className="card" aria-labelledby="letters-heading">
      <div className="toolbar">
        <h2 id="letters-heading" style={{ margin: 0 }}>
          Letters
        </h2>
        <span className="spacer" />
        <a
          className="button primary"
          href={printIds.length ? `/envelopes?ids=${printIds.join(',')}` : undefined}
          target="_blank"
          rel="noopener"
          aria-disabled={printIds.length === 0}
          onClick={(e) => printIds.length === 0 && e.preventDefault()}
        >
          Print envelopes ({printIds.length}
          {chosen.length ? ' selected' : ' not yet printed'})
        </a>
        <button
          type="button"
          disabled={pending || printIds.length === 0}
          onClick={() => run(() => markPrinted(printIds))}
        >
          Mark as printed
        </button>
      </div>

      {notice && (
        <p className={`notice ${notice.ok ? 'ok' : 'err'}`} role="status" aria-live="polite">
          {notice.message}
        </p>
      )}

      {letters.length === 0 ? (
        <p className="empty">No letters this week yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <label className="visually-hidden" htmlFor="select-all">
                    Select all letters
                  </label>
                  <input
                    id="select-all"
                    type="checkbox"
                    checked={allChosen}
                    onChange={() =>
                      setSelected(allChosen ? new Set() : new Set(printable.map((l) => l.id)))
                    }
                  />
                </th>
                <th>No.</th>
                <th>ID No.</th>
                <th>Doc No.</th>
                <th>Addressee</th>
                <th>Province</th>
                <th className="num">g</th>
                <th className="num">Postage</th>
                {DENOMINATIONS.map((d) => (
                  <th key={d} className="num" title={`₱${d} stamps`}>
                    ₱{d}
                  </th>
                ))}
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {letters.map((l, i) => (
                <tr key={l.id} className={l.status === 'CANCELLED' ? 'cancelled' : undefined}>
                  <td>
                    {l.status !== 'CANCELLED' && (
                      <>
                        <label className="visually-hidden" htmlFor={`sel-${l.id}`}>
                          Select {l.controlNo}
                        </label>
                        <input
                          id={`sel-${l.id}`}
                          type="checkbox"
                          checked={selected.has(l.id)}
                          onChange={() => toggle(l.id)}
                        />
                      </>
                    )}
                  </td>
                  <td className="num">{i + 1}</td>
                  <td className="nowrap">
                    {l.controlNo}
                    {links[l.id]?.remailOf && (
                      <div className="hint">Remail of {links[l.id]!.remailOf}</div>
                    )}
                    {links[l.id]?.remailedAs && (
                      <div className="hint">Remailed as {links[l.id]!.remailedAs}</div>
                    )}
                  </td>
                  <td className="nowrap">
                    {l.docRefs.map((r) => (
                      <div key={r}>{r}</div>
                    ))}
                  </td>
                  <td>
                    {l.recipientName}
                    {l.recipientCompany && <div className="hint">{l.recipientCompany}</div>}
                    {l.remarks && <div className="hint">{l.remarks}</div>}
                  </td>
                  <td>
                    {l.province}
                    {l.zone === 'LAST_MILE' && <div className="hint">Last Mile</div>}
                  </td>
                  <td className="num">{l.weightGrams}</td>
                  <td className="num" title={l.rateSource}>
                    ₱{l.requiredPostage}
                    {l.stampsTotal > l.requiredPostage && (
                      <div className="hint">₱{l.stampsTotal} in stamps</div>
                    )}
                  </td>
                  {DENOMINATIONS.map((d) => (
                    <td key={d} className="num">
                      {stampCount(l, d) || ''}
                    </td>
                  ))}
                  <td>
                    <span className={`status ${l.status}`}>{l.status.toLowerCase()}</span>
                  </td>
                  <td>
                    <div className="actions">
                      {(ACTIONS[l.status] ?? []).map((a) => (
                        <button
                          key={a.to}
                          type="button"
                          className="small"
                          disabled={pending}
                          onClick={() => {
                            if (
                              a.to === 'CANCELLED' &&
                              !window.confirm(`Cancel ${l.controlNo}? Its stamps go back to stock.`)
                            ) {
                              return;
                            }
                            run(() => setLetterStatus(l.id, a.to));
                          }}
                        >
                          {a.label}
                        </button>
                      ))}
                      {canRemail(l, links) && (
                        <Link className="button small" href={`/?remail=${l.id}`} scroll={false}>
                          Remail
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td />
                <td colSpan={5}>{printable.length} letter(s)</td>
                <td />
                <td className="num">₱{printable.reduce((s, l) => s + l.requiredPostage, 0)}</td>
                {DENOMINATIONS.map((d) => (
                  <td key={d} className="num">
                    {printable.reduce((s, l) => s + stampCount(l, d), 0) || ''}
                  </td>
                ))}
                <td colSpan={2}>₱{printable.reduce((s, l) => s + l.stampsTotal, 0)} in stamps</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
