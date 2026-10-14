import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LETTERHEAD_IMAGE,
  ENVELOPE_10,
  STAMP_GRID,
  STAMP_ZONE,
  centredBlockX,
  layoutEnvelope,
  renderCalibrationPage,
  renderEnvelopes,
  type Envelope,
} from '../src/index.js';

const letter: Envelope = {
  controlNo: 'MGB-10-681',
  service: 'REGISTERED',
  recipient: {
    name: 'ATTY. JUAN P. DELA CRUZ',
    position: 'Partner',
    company: 'Dela Cruz Law Office',
    addressLines: ['12/F Sample Building', '26th Street corner 3rd Avenue', 'Taguig City, 1634'],
  },
};

const MM_PER_PT = 25.4 / 72;
const pages = (pdf: Buffer) => pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;
const mediaBoxes = (pdf: Buffer) =>
  [...pdf.toString('latin1').matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => [
    Number(m[1]) * MM_PER_PT,
    Number(m[2]) * MM_PER_PT,
  ]);

describe('layoutEnvelope', () => {
  it('writes the recipient as name, position and company, then the address', () => {
    const block = layoutEnvelope(letter).find((b) => b.role === 'recipient')!;
    expect(block.lines).toEqual([
      'ATTY. JUAN P. DELA CRUZ',
      'Partner, Dela Cruz Law Office',
      '12/F Sample Building',
      '26th Street corner 3rd Avenue',
      'Taguig City, 1634',
    ]);
  });

  it('drops the position line when there is neither position nor company', () => {
    const plain = { ...letter, recipient: { name: 'ROLANDO HUANG', addressLines: ['Iba, Zambales'] } };
    const block = layoutEnvelope(plain).find((b) => b.role === 'recipient')!;
    expect(block.lines).toEqual(['ROLANDO HUANG', 'Iba, Zambales']);
  });

  it('prints the control number and service small at the bottom left', () => {
    const footer = layoutEnvelope(letter).find((b) => b.role === 'footer')!;
    expect(footer.lines).toEqual(['MGB-10-681 · REGISTERED MAIL']);
    expect(footer.yMm).toBeGreaterThan(ENVELOPE_10.heightMm - 15);
    expect(footer.xMm).toBeLessThan(40);
  });

  it('keeps the top-right corner clear for stamps', () => {
    for (const b of layoutEnvelope(letter)) {
      const right = b.xMm + b.widthMm;
      const bottom = b.yMm + b.heightMm;
      const overlaps =
        b.xMm < STAMP_ZONE.xMm + STAMP_ZONE.widthMm &&
        right > STAMP_ZONE.xMm &&
        b.yMm < STAMP_ZONE.yMm + STAMP_ZONE.heightMm &&
        bottom > STAMP_ZONE.yMm;
      expect(overlaps, `${b.role} overlaps the stamp zone`).toBe(false);
    }
  });

  it('centres the recipient on the envelope, below the letterhead', () => {
    const blocks = layoutEnvelope(letter);
    const block = blocks.find((b) => b.role === 'recipient')!;
    const rule = blocks.find((b) => b.role === 'rule')!;
    // Lines flush left; the block, as wide as its longest line, centred (option B).
    expect(block.align).toBe('centred-block');
    expect(block.xMm + block.widthMm / 2).toBeCloseTo(ENVELOPE_10.widthMm / 2);
    expect(block.yMm).toBeGreaterThan(rule.yMm + rule.heightMm);
  });

  it('starts the recipient 7.5 mm under the gold rule, however many lines it has', () => {
    for (const addressLines of [['Iba, Zambales'], ['a', 'b', 'c', 'd', 'e']]) {
      const blocks = layoutEnvelope({ ...letter, recipient: { name: 'X', addressLines } });
      const rule = blocks.find((b) => b.role === 'rule')!;
      const block = blocks.find((b) => b.role === 'recipient')!;
      expect(block.yMm - (rule.yMm + rule.heightMm)).toBeCloseTo(7.5);
    }
  });

  it('makes room for stamps 2 across and 3 down, inside the envelope', () => {
    const { columns, rows, cellWidthMm, cellHeightMm, gapMm } = STAMP_GRID;
    expect([columns, rows]).toEqual([2, 3]);
    expect(STAMP_ZONE.widthMm).toBeGreaterThanOrEqual(columns * cellWidthMm + (columns - 1) * gapMm);
    expect(STAMP_ZONE.heightMm).toBeGreaterThanOrEqual(rows * cellHeightMm + (rows - 1) * gapMm);
    expect(STAMP_ZONE.xMm + STAMP_ZONE.widthMm).toBeLessThanOrEqual(ENVELOPE_10.widthMm);
    expect(STAMP_ZONE.yMm + STAMP_ZONE.heightMm).toBeLessThanOrEqual(ENVELOPE_10.heightMm);
  });

  it('uses the letterhead banner image when one is given, with no letterhead text', () => {
    const head = layoutEnvelope(letter, { letterheadImage: 'banner.png' }).find(
      (b) => b.role === 'letterhead',
    )!;
    expect(head).toMatchObject({ imagePath: 'banner.png', lines: [] });
  });

  it('shifts every block by the printer offset', () => {
    const plain = layoutEnvelope(letter);
    const shifted = layoutEnvelope(letter, { offsetXmm: 2, offsetYmm: -1.5 });
    shifted.forEach((b, i) => {
      expect(b.xMm).toBeCloseTo(plain[i]!.xMm + 2);
      expect(b.yMm).toBeCloseTo(plain[i]!.yMm - 1.5);
    });
  });
});

describe('centredBlockX', () => {
  it('centres a block as wide as its longest line inside the space', () => {
    expect(centredBlockX(50, 140, 60)).toBe(90);
  });

  it('fills the space from its left edge when the longest line is wider than it', () => {
    expect(centredBlockX(50, 140, 200)).toBe(50);
  });
});

describe('renderEnvelopes', () => {
  it('makes one #10 page (241 × 105 mm, landscape) per letter', async () => {
    const pdf = await renderEnvelopes([letter, { ...letter, controlNo: 'MGB-10-682' }]);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pages(pdf)).toBe(2);
    for (const [w, h] of mediaBoxes(pdf)) {
      expect(w).toBeCloseTo(241, 0);
      expect(h).toBeCloseTo(105, 0);
    }
  });

  it('refuses an empty batch', async () => {
    await expect(renderEnvelopes([])).rejects.toThrow(/no envelopes/i);
  });
});

describe('DEFAULT_LETTERHEAD_IMAGE', () => {
  it('points at the bundled MGB Region III banner', async () => {
    const { existsSync } = await import('node:fs');
    expect(existsSync(DEFAULT_LETTERHEAD_IMAGE)).toBe(true);
  });
});

describe('renderCalibrationPage', () => {
  it('makes a single envelope-sized page', async () => {
    const pdf = await renderCalibrationPage();
    expect(pages(pdf)).toBe(1);
    expect(mediaBoxes(pdf)[0]![0]).toBeCloseTo(241, 0);
  });
});
