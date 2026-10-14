/**
 * Where everything sits on a #10 envelope (105 × 241 mm, printed landscape), in millimetres from
 * the top-left corner. Pure data, so it can be tested without opening a PDF.
 *
 * Letterhead banner across the top left with a gold rule under it, the recipient centred across
 * the envelope just under the rule, and a column on the right kept blank for stamps.
 */

export const ENVELOPE_10 = { widthMm: 241, heightMm: 105 } as const;

/** Room for up to six stamps, 2 across and 3 down. A cell fits one ordinary PHLPost stamp. */
export const STAMP_GRID = {
  columns: 2,
  rows: 3,
  cellWidthMm: 24,
  cellHeightMm: 26,
  gapMm: 1,
} as const;

const STAMP_MARGIN_MM = 3;

/** Top right, left blank for the stamps. Sized from `STAMP_GRID`. */
export const STAMP_ZONE = (() => {
  const { columns, rows, cellWidthMm, cellHeightMm, gapMm } = STAMP_GRID;
  const widthMm = columns * cellWidthMm + (columns - 1) * gapMm;
  const heightMm = rows * cellHeightMm + (rows - 1) * gapMm;
  return {
    xMm: ENVELOPE_10.widthMm - STAMP_MARGIN_MM - widthMm,
    yMm: STAMP_MARGIN_MM,
    widthMm,
    heightMm,
  } as const;
})();

export type MailService = 'REGISTERED' | 'ORDINARY';

export interface RecipientAddress {
  name: string;
  position?: string;
  company?: string;
  /** Already broken into lines as they should print: building, street, barangay, city + ZIP. */
  addressLines: string[];
}

export interface Envelope {
  controlNo: string;
  service: MailService;
  recipient: RecipientAddress;
}

export interface LineStyle {
  sizePt: number;
  bold?: boolean;
  /** Hex colour; black when absent. */
  color?: string;
}

export interface Block {
  role: 'letterhead' | 'rule' | 'recipient' | 'footer';
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  lines: string[];
  /** One style for every line, or one per line. */
  style: LineStyle | LineStyle[];
  /**
   * `'left'` (default): lines flush left at `xMm`. `'centred-block'`: lines flush left, the block
   * as wide as its longest line and centred within `xMm`…`xMm + widthMm`; see `centredBlockX`.
   */
  align?: 'left' | 'centred-block';
  /** A letterhead banner image drawn in place of the letterhead text, when one is configured. */
  imagePath?: string;
}

export interface LayoutOptions {
  /** Nudges everything to match where the printer actually puts it; from the calibration page. */
  offsetXmm?: number;
  offsetYmm?: number;
  /** A PNG/JPEG of the full letterhead banner (logos and text). Text is used when absent. */
  letterheadImage?: string;
  /** Return-address lines for the text letterhead. */
  sender?: SenderLetterhead;
}

export interface SenderLetterhead {
  government: string;
  department: string;
  bureau: string;
  office: string;
  address: string;
  contact: string;
}

export const DEFAULT_SENDER: SenderLetterhead = {
  government: 'Republic of the Philippines',
  department: 'Department of Environment and Natural Resources',
  bureau: 'MINES AND GEOSCIENCES BUREAU',
  office: 'Regional Office No. III',
  address: 'Matalino St., Diosdado Macapagal Government Center, Brgy. Maimpis, CSFP',
  contact: '( 045 ) - 404 - 1963 / region3@mgb.gov.ph',
};

const NAVY = '#2B3990';
const LINE_HEIGHT = 1.2;
const MM_PER_PT = 25.4 / 72;
const linesHeightMm = (styles: LineStyle[]) =>
  styles.reduce((sum, s) => sum + s.sizePt * LINE_HEIGHT * MM_PER_PT, 0);

// The banner is 2000 × 366 px; 160 mm wide makes it 29.3 mm tall.
const LETTERHEAD = { xMm: 20, yMm: 5, widthMm: 160, heightMm: 29.3 };
const RULE_Y_MM = 35.5;
/** As wide as it can be while centred on the envelope and clear of the stamp column. */
const RECIPIENT_WIDTH_MM = 2 * (STAMP_ZONE.xMm - 1 - ENVELOPE_10.widthMm / 2);
const RULE_HEIGHT_MM = 0.8;
/** Space between the gold rule and the first line of the recipient. */
const RECIPIENT_GAP_MM = 7.5;
const RECIPIENT_STYLE: LineStyle = { sizePt: 12 };
const FOOTER_STYLE: LineStyle = { sizePt: 7, color: '#555555' };

const SERVICE_LABEL: Record<MailService, string> = {
  REGISTERED: 'REGISTERED MAIL',
  ORDINARY: 'ORDINARY MAIL',
};

/**
 * Left edge of a block as wide as its longest line, centred in a space. A line wider than the space
 * pins the block to the space's left edge, and the renderer wraps it there. Any unit, as long as
 * all three match.
 */
export function centredBlockX(spaceX: number, spaceWidth: number, longestLine: number): number {
  return spaceX + Math.max(0, (spaceWidth - longestLine) / 2);
}

export function layoutEnvelope(envelope: Envelope, options: LayoutOptions = {}): Block[] {
  const dx = options.offsetXmm ?? 0;
  const dy = options.offsetYmm ?? 0;
  const sender = options.sender ?? DEFAULT_SENDER;
  const { recipient } = envelope;

  const letterheadStyles: LineStyle[] = [
    { sizePt: 8 },
    { sizePt: 8 },
    { sizePt: 15, bold: true, color: NAVY },
    { sizePt: 13, bold: true, color: NAVY },
    { sizePt: 7 },
    { sizePt: 7 },
  ];

  const roleLine = [recipient.position, recipient.company]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(', ');
  const recipientLines = [recipient.name.trim(), roleLine, ...recipient.addressLines]
    .map((l) => l.trim())
    .filter(Boolean);

  const footerY = ENVELOPE_10.heightMm - 10;
  const recipientHeightMm = linesHeightMm(recipientLines.map(() => RECIPIENT_STYLE));

  return [
    {
      role: 'letterhead',
      ...LETTERHEAD,
      xMm: LETTERHEAD.xMm + dx,
      yMm: LETTERHEAD.yMm + dy,
      lines: options.letterheadImage
        ? []
        : [
            sender.government,
            sender.department,
            sender.bureau,
            sender.office,
            sender.address,
            sender.contact,
          ],
      style: letterheadStyles,
      ...(options.letterheadImage ? { imagePath: options.letterheadImage } : {}),
    },
    {
      role: 'rule',
      xMm: LETTERHEAD.xMm + dx,
      yMm: RULE_Y_MM + dy,
      widthMm: LETTERHEAD.widthMm,
      heightMm: RULE_HEIGHT_MM,
      lines: [],
      style: { sizePt: 0, color: '#F2C200' },
    },
    {
      role: 'recipient',
      xMm: (ENVELOPE_10.widthMm - RECIPIENT_WIDTH_MM) / 2 + dx,
      yMm: RULE_Y_MM + RULE_HEIGHT_MM + RECIPIENT_GAP_MM + dy,
      widthMm: RECIPIENT_WIDTH_MM,
      heightMm: recipientHeightMm,
      lines: recipientLines,
      style: RECIPIENT_STYLE,
      align: 'centred-block',
    },
    {
      role: 'footer',
      xMm: LETTERHEAD.xMm + dx,
      yMm: footerY + dy,
      widthMm: 70,
      heightMm: linesHeightMm([FOOTER_STYLE]),
      lines: [`${envelope.controlNo} · ${SERVICE_LABEL[envelope.service]}`],
      style: FOOTER_STYLE,
    },
  ];
}
