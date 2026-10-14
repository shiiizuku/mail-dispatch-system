import { renderEnvelopes } from '@mds/envelope';
import { mailService } from '@/lib/mail';

/**
 * GET /envelopes?ids=a,b,c → one PDF, one #10 envelope per page, in control-number order.
 * Read-only: marking the letters printed is a separate step, after the printout is checked.
 */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s));
  const pieces = (await mailService().getMailpieces(ids)).filter((p) => p.status !== 'CANCELLED');
  if (pieces.length === 0) return new Response('No envelopes to print', { status: 404 });

  const pdf = await renderEnvelopes(
    pieces.map((p) => ({
      controlNo: p.controlNo,
      service: p.service,
      recipient: {
        name: p.recipientName,
        ...(p.recipientPosition ? { position: p.recipientPosition } : {}),
        ...(p.recipientCompany ? { company: p.recipientCompany } : {}),
        addressLines: p.recipientAddressLines,
      },
    })),
  );
  const first = pieces[0]!.controlNo;
  const last = pieces.at(-1)!.controlNo;
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="envelopes ${first}${first === last ? '' : ` to ${last}`}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
