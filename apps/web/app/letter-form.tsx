'use client';

import { useActionState, useEffect, useId, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DEFAULT_PROVINCE_ZONES } from '@mds/postage';
import type { MailpieceStatus, PostagePreview, Recipient } from '@mds/mail';
import { createLetter, previewPostage, searchRecipients, type FormState } from './actions';

const ZONE_LABELS: Record<string, string> = {
  NCR: 'NCR',
  N_LUZON: 'North Luzon',
  S_LUZON: 'South Luzon',
  VISAYAS: 'Visayas',
  MINDANAO: 'Mindanao',
};

const PROVINCES_BY_ZONE = Object.entries(
  Object.entries(DEFAULT_PROVINCE_ZONES).reduce<Record<string, string[]>>((acc, [p, z]) => {
    (acc[z] ??= []).push(p);
    return acc;
  }, {}),
).map(([zone, list]) => [zone, list.sort()] as const);

interface RecipientFields {
  id: string;
  name: string;
  position: string;
  company: string;
  address: string;
  province: string;
  lastMile: boolean;
}

const EMPTY_RECIPIENT: RecipientFields = {
  id: '',
  name: '',
  position: '',
  company: '',
  address: '',
  province: '',
  lastMile: false,
};

/** A letter being sent again: the form starts from it. */
export interface RemailDraft {
  id: string;
  controlNo: string;
  status: MailpieceStatus;
  docRefs: string[];
  service: 'REGISTERED' | 'ORDINARY';
  weightGrams: number;
  recipient: Pick<
    Recipient,
    'id' | 'name' | 'position' | 'company' | 'addressLines' | 'province' | 'lastMile'
  >;
}

const fromRecipient = (r: RemailDraft['recipient']): RecipientFields => ({
  id: r.id,
  name: r.name,
  position: r.position ?? '',
  company: r.company ?? '',
  address: r.addressLines.join('\n'),
  province: r.province,
  lastMile: r.lastMile,
});

export function LetterForm({
  defaultDate,
  remail,
}: {
  defaultDate: string;
  remail: RemailDraft | null;
}) {
  const [state, formAction, saving] = useActionState<FormState, FormData>(createLetter, null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const [mailDate, setMailDate] = useState(defaultDate);
  const [service, setService] = useState<'REGISTERED' | 'ORDINARY'>(remail?.service ?? 'REGISTERED');
  const [weight, setWeight] = useState(String(remail?.weightGrams ?? 20));
  const [docRefs, setDocRefs] = useState(remail?.docRefs.join('\n') ?? '');
  const [remarks, setRemarks] = useState('');
  const [recipient, setRecipient] = useState<RecipientFields>(
    remail ? fromRecipient(remail.recipient) : EMPTY_RECIPIENT,
  );
  const docRefsRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMailDate(defaultDate), [defaultDate]);

  // Clicking Remail on another letter loads it into the form already on screen.
  const remailId = remail?.id;
  useEffect(() => {
    if (!remail) return;
    setService(remail.service);
    setWeight(String(remail.weightGrams));
    setDocRefs(remail.docRefs.join('\n'));
    setRemarks('');
    setRecipient(fromRecipient(remail.recipient));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when a different letter is chosen
  }, [remailId]);

  // After a successful save: clear the letter, keep date / service / weight for the next one.
  useEffect(() => {
    if (state?.ok) {
      setDocRefs('');
      setRemarks('');
      setRecipient(EMPTY_RECIPIENT);
      docRefsRef.current?.focus();
      // A saved remail is done: drop ?remail= so the next letter starts blank.
      if (remail) router.replace('/', { scroll: false });
    }
  }, [state, remail, router]);

  const set = <K extends keyof RecipientFields>(key: K, value: RecipientFields[K]) =>
    setRecipient((r) => ({ ...r, [key]: value }));

  return (
    <form
      className="card"
      aria-labelledby="new-letter"
      onSubmit={(e) => {
        // Submitting through a transition keeps the fields if the server says no.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <h2 id="new-letter">{remail ? `Remail ${remail.controlNo}` : 'New letter'}</h2>

      {remail && (
        <p className="picked">
          <span>
            Sending {remail.controlNo} again as a new letter, with new stamps and a new control
            number.
            {remail.status === 'RELEASED' && ` ${remail.controlNo} will be marked returned.`} Fix the
            address below if that is why it came back.
          </span>
          <Link href="/" scroll={false}>
            Cancel
          </Link>
        </p>
      )}
      <input type="hidden" name="remailOf" value={remail?.id ?? ''} />

      {state && (
        <p className={`notice ${state.ok ? 'ok' : 'err'}`} role="status" aria-live="polite">
          {state.message}
        </p>
      )}

      <fieldset>
        <legend>Letter</legend>
        <div className="field">
          <label htmlFor="docRefs" className="req">
            Document number(s)
          </label>
          <textarea
            id="docRefs"
            name="docRefs"
            ref={docRefsRef}
            rows={2}
            required
            value={docRefs}
            onChange={(e) => setDocRefs(e.target.value)}
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby="docRefs-hint"
          />
          <span id="docRefs-hint" className="hint">
            e.g. MMD-26-946. Several in one envelope: one per line or separated by commas.
          </span>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="mailDate" className="req">
              Mail date
            </label>
            <input
              type="date"
              id="mailDate"
              name="mailDate"
              required
              value={mailDate}
              onChange={(e) => setMailDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="weightGrams" className="req">
              Weight (g)
            </label>
            <input
              type="text"
              id="weightGrams"
              name="weightGrams"
              inputMode="numeric"
              pattern="[1-9][0-9]{0,3}"
              required
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              aria-describedby="weight-hint"
            />
            <span id="weight-hint" className="hint">
              A single letter is up to 50 g.
            </span>
          </div>
        </div>
        <div className="field" role="radiogroup" aria-labelledby="service-label">
          <span className="label" id="service-label">
            Service
          </span>
          <div className="choices">
            {(['REGISTERED', 'ORDINARY'] as const).map((s) => (
              <label key={s}>
                <input
                  type="radio"
                  name="service"
                  value={s}
                  checked={service === s}
                  onChange={() => setService(s)}
                />
                {s === 'REGISTERED' ? 'Registered (with return card)' : 'Ordinary'}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Recipient</legend>
        <RecipientSearch onPick={(r) => setRecipient(fromRecipient(r))} />

        {recipient.id && (
          <p className="picked">
            <span>Editing a saved recipient. Changes here update the address book.</span>
            <button type="button" className="link" onClick={() => setRecipient(EMPTY_RECIPIENT)}>
              Clear
            </button>
          </p>
        )}
        <input type="hidden" name="recipientId" value={recipient.id} />

        <div className="field">
          <label htmlFor="name" className="req">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            maxLength={240}
            autoComplete="off"
            value={recipient.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="position">Position</label>
            <input
              type="text"
              id="position"
              name="position"
              maxLength={240}
              autoComplete="off"
              value={recipient.position}
              onChange={(e) => set('position', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="company">Company / office</label>
            <input
              type="text"
              id="company"
              name="company"
              maxLength={240}
              autoComplete="off"
              value={recipient.company}
              onChange={(e) => set('company', e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="address" className="req">
            Address
          </label>
          <textarea
            id="address"
            name="address"
            rows={4}
            required
            autoComplete="off"
            value={recipient.address}
            onChange={(e) => set('address', e.target.value)}
            aria-describedby="address-hint"
          />
          <span id="address-hint" className="hint">
            One line per printed line, as it should appear on the envelope.
          </span>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="province" className="req">
              Province
            </label>
            <select
              id="province"
              name="province"
              required
              value={recipient.province}
              onChange={(e) => set('province', e.target.value)}
              aria-describedby="province-hint"
            >
              <option value="">Choose…</option>
              {PROVINCES_BY_ZONE.map(([zone, list]) => (
                <optgroup key={zone} label={ZONE_LABELS[zone] ?? zone}>
                  {list.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span id="province-hint" className="hint">
              Sets the postage zone.
            </span>
          </div>
          <div className="field">
            <span className="label">Area</span>
            <label className="check">
              <input
                type="checkbox"
                name="lastMile"
                checked={recipient.lastMile}
                onChange={(e) => set('lastMile', e.target.checked)}
              />
              Far-flung (Last Mile)
            </label>
          </div>
        </div>
        <div className="field">
          <label htmlFor="remarks">Remarks</label>
          <input
            type="text"
            id="remarks"
            name="remarks"
            maxLength={500}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </fieldset>

      <PostageBox
        service={service}
        province={recipient.province}
        lastMile={recipient.lastMile}
        weight={weight}
        refreshKey={state?.at ?? 0}
      />

      <button type="submit" className="primary" disabled={saving}>
        {saving ? 'Saving…' : remail ? 'Save remail' : 'Save letter'}
      </button>
    </form>
  );
}

function RecipientSearch({ onPick }: { onPick: (r: Recipient) => void }) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recipient[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let stale = false;
    const t = setTimeout(async () => {
      const found = await searchRecipients(query);
      if (!stale) {
        setResults(found);
        setActive(found.length ? 0 : -1);
        setOpen(true);
      }
    }, 200);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [query]);

  const pick = (r: Recipient) => {
    onPick(r);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const expanded = open && query.trim().length >= 2;

  return (
    <div className="field combo">
      <label htmlFor={`${id}-input`}>Find a saved recipient</label>
      <input
        id={`${id}-input`}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && expanded && results[active]) {
            e.preventDefault();
            pick(results[active]!);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        aria-describedby={`${id}-hint`}
      />
      <span id={`${id}-hint`} className="hint">
        Type part of a name or company. Leave empty for a new recipient.
      </span>
      {expanded && (
        <ul role="listbox" id={listId} aria-label="Saved recipients">
          {results.length === 0 ? (
            <li role="option" aria-selected={false} aria-disabled>
              No saved recipient matches. Fill in the fields below to add one.
            </li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.id}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
                onMouseEnter={() => setActive(i)}
              >
                {r.name}
                <span className="sub">
                  {[r.company, r.addressLines.at(-1)].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function PostageBox(props: {
  service: 'REGISTERED' | 'ORDINARY';
  province: string;
  lastMile: boolean;
  weight: string;
  refreshKey: number;
}) {
  const { service, province, lastMile, weight, refreshKey } = props;
  const [result, setResult] = useState<
    { ok: true; preview: PostagePreview } | { ok: false; message: string } | null
  >(null);

  useEffect(() => {
    const weightGrams = Number(weight);
    if (!province || !Number.isInteger(weightGrams) || weightGrams <= 0) {
      setResult(null);
      return;
    }
    let stale = false;
    const t = setTimeout(async () => {
      const r = await previewPostage({ service, province, lastMile, weightGrams });
      if (!stale) setResult(r);
    }, 150);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [service, province, lastMile, weight, refreshKey]);

  return (
    <section className="postage" aria-live="polite" aria-label="Postage">
      {!result && <span className="hint">Choose a province and weight to see the postage.</span>}
      {result && !result.ok && <span className="notice err">{result.message}</span>}
      {result?.ok && (
        <>
          <div>
            <span className="amount">₱{result.preview.quote.total}</span>{' '}
            <span className="hint">
              ₱{result.preview.quote.baseRate}
              {result.preview.quote.returnCardFee > 0 &&
                ` + ₱${result.preview.quote.returnCardFee} return card`}{' '}
              · {result.preview.quote.source === 'card' ? 'PHLPost rate card' : result.preview.quote.source}
            </span>
          </div>
          {result.preview.stamps ? (
            <>
              <div className="stamp-chips" aria-label="Stamps to use">
                {result.preview.stamps.stamps.map((s) => (
                  <span className="chip" key={s.denomination}>
                    {s.count} × ₱{s.denomination}
                  </span>
                ))}
              </div>
              <div className="hint">
                {result.preview.stamps.stampCount} stamp(s), ₱{result.preview.stamps.total}
                {result.preview.stamps.overpay > 0 && ` (₱${result.preview.stamps.overpay} over)`}
              </div>
            </>
          ) : (
            <div className="notice err">Not enough stamps in stock. Add stamps first.</div>
          )}
        </>
      )}
    </section>
  );
}
