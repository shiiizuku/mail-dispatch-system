'use server';

import { revalidatePath } from 'next/cache';
import type { MailpieceStatus, PostagePreview, Recipient } from '@mds/mail';
import { mailService } from '@/lib/mail';
import { isValidIsoDate } from '@/lib/dates';

export type FormState =
  | { ok: true; message: string; at: number }
  | { ok: false; message: string; at: number }
  | null;

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const failure = (e: unknown): FormState => ({
  ok: false,
  message: e instanceof Error ? e.message : 'Something went wrong',
  at: Date.now(),
});

/** Document numbers typed one per line or separated by commas. */
const splitRefs = (s: string) => s.split(/[\n,;]+/).map((r) => r.trim()).filter(Boolean);
const splitLines = (s: string) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

export async function createLetter(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const mailDate = text(form, 'mailDate');
    if (!isValidIsoDate(mailDate)) throw new Error('Enter the mail date');
    const weightGrams = Number(text(form, 'weightGrams'));
    if (!Number.isInteger(weightGrams) || weightGrams <= 0) {
      throw new Error('Enter the weight in whole grams');
    }
    const service = text(form, 'service') === 'ORDINARY' ? 'ORDINARY' : 'REGISTERED';
    const recipientId = text(form, 'recipientId');

    const piece = await mailService().createMailpiece({
      mailDate,
      service,
      docRefs: splitRefs(text(form, 'docRefs')),
      weightGrams,
      remarks: text(form, 'remarks') || null,
      remailOf: text(form, 'remailOf') || null,
      recipient: {
        ...(recipientId ? { id: recipientId } : {}),
        name: text(form, 'name'),
        position: text(form, 'position') || null,
        company: text(form, 'company') || null,
        addressLines: splitLines(text(form, 'address')),
        province: text(form, 'province'),
        lastMile: form.get('lastMile') === 'on',
      },
    });
    revalidatePath('/');
    revalidatePath('/stamps');
    return {
      ok: true,
      message: `${piece.controlNo} saved${piece.remailOf ? ' as a remail' : ''}: ₱${piece.requiredPostage} postage, ₱${piece.stampsTotal} in stamps.`,
      at: Date.now(),
    };
  } catch (e) {
    return failure(e);
  }
}

export async function searchRecipients(query: string): Promise<Recipient[]> {
  if (query.trim().length < 2) return [];
  return mailService().searchRecipients(query, 8);
}

export async function previewPostage(input: {
  service: 'REGISTERED' | 'ORDINARY';
  province: string;
  lastMile: boolean;
  weightGrams: number;
}): Promise<{ ok: true; preview: PostagePreview } | { ok: false; message: string }> {
  try {
    return { ok: true, preview: await mailService().previewPostage(input) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Cannot price this letter' };
  }
}

export async function setLetterStatus(id: string, status: MailpieceStatus): Promise<FormState> {
  try {
    const piece = await mailService().setStatus(id, status);
    revalidatePath('/');
    revalidatePath('/stamps');
    return { ok: true, message: `${piece.controlNo} is now ${status.toLowerCase()}.`, at: Date.now() };
  } catch (e) {
    return failure(e);
  }
}

export async function markPrinted(ids: string[]): Promise<FormState> {
  try {
    await mailService().markPrinted(ids);
    revalidatePath('/');
    return { ok: true, message: `Marked ${ids.length} envelope(s) as printed.`, at: Date.now() };
  } catch (e) {
    return failure(e);
  }
}

export async function addStamps(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const denomination = Number(text(form, 'denomination'));
    const quantity = Number(text(form, 'quantity'));
    const reason = text(form, 'reason') === 'CORRECTION' ? 'CORRECTION' : 'PURCHASE';
    const forDate = text(form, 'forDate');
    if (!isValidIsoDate(forDate)) throw new Error('Enter the date');
    if (reason === 'PURCHASE' && quantity < 0) throw new Error('Use Count correction to remove stamps');
    await mailService().addStamps(denomination, quantity, {
      reason,
      forDate,
      note: text(form, 'note') || null,
    });
    revalidatePath('/');
    revalidatePath('/stamps');
    return {
      ok: true,
      message: `${quantity > 0 ? 'Added' : 'Removed'} ${Math.abs(quantity)} × ₱${denomination}.`,
      at: Date.now(),
    };
  } catch (e) {
    return failure(e);
  }
}

export async function setControlCounter(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const year = Number(text(form, 'year'));
    const lastSeq = Number(text(form, 'lastSeq'));
    if (!Number.isInteger(year) || year < 2000) throw new Error('Enter the year');
    await mailService().setControlCounter(year, lastSeq);
    revalidatePath('/stamps');
    return {
      ok: true,
      message: `The next ${year} letter will be number ${lastSeq + 1}.`,
      at: Date.now(),
    };
  } catch (e) {
    return failure(e);
  }
}

export async function saveSignatories(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const person = (key: string) => ({
      name: text(form, `${key}.name`),
      designation: text(form, `${key}.designation`),
    });
    const value = {
      entityName: text(form, 'entityName'),
      fundCluster: text(form, 'fundCluster'),
      office: text(form, 'office'),
      division: text(form, 'division'),
      requestedBy: person('requestedBy'),
      approvedBy: person('approvedBy'),
      issuedBy: person('issuedBy'),
      receivedBy: person('receivedBy'),
    };
    if (!value.requestedBy.name || !value.approvedBy.name || !value.issuedBy.name) {
      throw new Error('Enter the names of who requests, approves and issues');
    }
    await mailService().saveSignatories(value);
    revalidatePath('/stamps');
    return { ok: true, message: 'Saved. New requisition slips will use these names.', at: Date.now() };
  } catch (e) {
    return failure(e);
  }
}
