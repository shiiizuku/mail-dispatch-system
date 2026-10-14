'use client';

import { useActionState, useState } from 'react';
import type { Signatories } from '@mds/mail';
import { addStamps, saveSignatories, setControlCounter, type FormState } from '../actions';
import { PreviewDialog } from '../preview-dialog';

function Notice({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p className={`notice ${state.ok ? 'ok' : 'err'}`} role="status" aria-live="polite">
      {state.message}
    </p>
  );
}

export function AddStampsForm({
  denominations,
  today,
}: {
  denominations: number[];
  today: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addStamps, null);
  return (
    <form className="card" action={action} aria-labelledby="add-heading">
      <h2 id="add-heading">Add stamps</h2>
      <Notice state={state} />
      <div className="row">
        <div className="field">
          <label htmlFor="denomination" className="req">
            Stamp
          </label>
          <div className="select-wrap">
            <select id="denomination" name="denomination" required defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {denominations.map((d) => (
                <option key={d} value={d}>
                  ₱{d}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="quantity" className="req">
            How many
          </label>
          <input
            type="text"
            id="quantity"
            name="quantity"
            inputMode="numeric"
            pattern="-?[1-9][0-9]*"
            required
            aria-describedby="quantity-hint"
          />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="forDate" className="req">
            Date received
          </label>
          <div className="date-wrap">
            <input type="date" id="forDate" name="forDate" required defaultValue={today} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="note">Note</label>
          <input
            type="text"
            id="note"
            name="note"
            maxLength={200}
            placeholder="e.g. Additional 3rd qtr"
          />
        </div>
      </div>
      <span id="quantity-hint" className="hint">
        For a correction, choose “Count correction” and enter a negative number to remove stamps.
      </span>
      <div
        className="field"
        role="radiogroup"
        aria-labelledby="reason-label"
        style={{ marginTop: '0.5rem' }}
      >
        <span className="label" id="reason-label">
          Reason
        </span>
        <div className="choices">
          <label>
            <input type="radio" name="reason" value="PURCHASE" defaultChecked /> Received
          </label>
          <label>
            <input type="radio" name="reason" value="CORRECTION" /> Count correction
          </label>
        </div>
      </div>
      <button type="submit" className="primary" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}

export function ControlCounterForm({ year, lastSeq }: { year: number; lastSeq: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setControlCounter, null);
  return (
    <form className="card" action={action} aria-labelledby="counter-heading">
      <h2 id="counter-heading">Control numbers</h2>
      <Notice state={state} />
      <p className="hint" style={{ marginTop: 0 }}>
        The next letter in {year} will be number <strong>{lastSeq + 1}</strong>. To continue from
        the old Access numbering, enter the last number Access used (e.g. 696 for MGB-10-696).
      </p>
      <input type="hidden" name="year" value={year} />
      <div className="field">
        <label htmlFor="lastSeq" className="req">
          Last number used in {year}
        </label>
        <input
          type="text"
          id="lastSeq"
          name="lastSeq"
          inputMode="numeric"
          pattern="[0-9]+"
          required
          defaultValue={lastSeq}
        />
      </div>
      <button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Set'}
      </button>
    </form>
  );
}

export function AccountabilityReportForm({ month: initial }: { month: string }) {
  const [month, setMonth] = useState(initial);
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const url = `/reports/accountability?month=${month}`;
  const period = valid
    ? new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1).toLocaleString('en-PH', {
        month: 'long',
        year: 'numeric',
      })
    : '';
  return (
    <section className="card" aria-labelledby="raaf-heading">
      <h2 id="raaf-heading">Accountability report</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Report of Accountability for Accountable Forms for one month: one block per week, with
        beginning balance, receipts, stamps issued and ending balance. Excel or PDF.
      </p>
      <div className="field">
        <label htmlFor="month" className="req">
          Month
        </label>
        <div className="date-wrap">
          <input
            type="month"
            id="month"
            name="month"
            required
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>
      <PreviewDialog
        primary
        disabled={!valid}
        label="Preview report"
        eyebrow="Report of Accountability for Accountable Forms"
        title={period}
        previewUrl={`${url}&format=pdf&inline=1`}
        downloads={[
          { label: 'Download Excel', href: url },
          { label: 'Download PDF', href: `${url}&format=pdf` },
        ]}
      />
    </section>
  );
}

const PEOPLE = [
  ['requestedBy', 'Requested by'],
  ['approvedBy', 'Approved by'],
  ['issuedBy', 'Issued by'],
  ['receivedBy', 'Received by'],
] as const;

export function SignatoriesForm({ value }: { value: Signatories }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSignatories, null);
  return (
    <form className="card" action={action} aria-labelledby="sig-heading">
      <h2 id="sig-heading">Requisition slip details</h2>
      <Notice state={state} />
      <div className="row">
        <div className="field">
          <label htmlFor="entityName">Entity name</label>
          <input type="text" id="entityName" name="entityName" defaultValue={value.entityName} />
        </div>
        <div className="field">
          <label htmlFor="fundCluster">Fund cluster</label>
          <input type="text" id="fundCluster" name="fundCluster" defaultValue={value.fundCluster} />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="office">Office</label>
          <input type="text" id="office" name="office" defaultValue={value.office} />
        </div>
        <div className="field">
          <label htmlFor="division">Division</label>
          <input type="text" id="division" name="division" defaultValue={value.division} />
        </div>
      </div>
      {PEOPLE.map(([key, label]) => (
        <fieldset key={key} style={{ marginBottom: '0.25rem' }}>
          <legend style={{ fontSize: '1.0625rem' }}>{label}</legend>
          <div className="row">
            <div className="field">
              <label htmlFor={`${key}.name`}>Printed name</label>
              <input
                type="text"
                id={`${key}.name`}
                name={`${key}.name`}
                defaultValue={value[key].name}
              />
            </div>
            <div className="field">
              <label htmlFor={`${key}.designation`}>Designation</label>
              <input
                type="text"
                id={`${key}.designation`}
                name={`${key}.designation`}
                defaultValue={value[key].designation}
              />
            </div>
          </div>
        </fieldset>
      ))}
      <button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
