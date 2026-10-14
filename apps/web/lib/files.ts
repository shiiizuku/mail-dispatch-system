import 'server-only';
import { sheetToPdf, type Sheet } from '@mds/reports';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * A report as a response: Excel by default, PDF with `?format=pdf`. `?inline=1` shows a PDF in the
 * browser (the preview dialog) instead of downloading it.
 */
export async function sheetResponse(request: Request, sheet: Sheet, filename: string) {
  const params = new URL(request.url).searchParams;
  const pdf = params.get('format') === 'pdf';
  const inline = pdf && params.get('inline') === '1';
  const body = pdf ? await sheetToPdf(sheet) : sheet.toXlsx();
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': pdf ? 'application/pdf' : XLSX,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}.${pdf ? 'pdf' : 'xlsx'}"`,
      'Cache-Control': 'no-store',
    },
  });
}
