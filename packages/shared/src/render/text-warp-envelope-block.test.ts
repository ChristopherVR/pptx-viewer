// @vitest-environment jsdom
/**
 * `text-warp-envelope-block` tests. The canvas is stubbed with a fixed
 * per-character advance and no ink metrics, so glyph ink comes from the
 * outline lookup (or the documented advance-box estimate).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LINE_PITCH_EM, layoutEnvelopeBlock } from './text-warp-envelope-block';
import { resetGlyphEnvelopeMeasureCache } from './text-warp-envelope-measure';
import type { EnvelopeSegmentInput, GlyphOutlineLookup } from './text-warp-envelope-types';

const ADVANCE = 10;

function seg(text: string, fontSizePx = 20): EnvelopeSegmentInput {
	return { text, font: { fontFamily: 'Arial', fontSizePx }, segmentIndex: 0 };
}

/** A lookup drawing every glyph as a box from `x+1..x+advance-1`, 14px tall. */
const boxLookup: GlyphOutlineLookup = (_char, _font, x, y) => [
	{ type: 'M', x: x + 1, y: y - 14 },
	{ type: 'L', x: x + ADVANCE - 1, y: y - 14 },
	{ type: 'L', x: x + ADVANCE - 1, y },
	{ type: 'L', x: x + 1, y },
	{ type: 'Z' },
];

beforeEach(() => {
	resetGlyphEnvelopeMeasureCache();
	vi.spyOn(document, 'createElement').mockReturnValue({
		getContext: () => ({
			font: '',
			measureText(text: string) {
				return { width: [...text].length * ADVANCE };
			},
		}),
	} as unknown as HTMLElement);
});

afterEach(() => {
	vi.restoreAllMocks();
	resetGlyphEnvelopeMeasureCache();
});

describe('layoutEnvelopeBlock', () => {
	it('stacks equal-size lines 1.2em apart', () => {
		const { lines } = layoutEnvelopeBlock([[seg('ab')], [seg('cd')]], 'center', boxLookup);
		expect(lines[1][0].baseline - lines[0][0].baseline).toBeCloseTo(LINE_PITCH_EM * 20, 6);
	});

	it('weights the baseline gap towards the next line for mixed sizes (COM: 62.55pt)', () => {
		const { lines } = layoutEnvelopeBlock([[seg('a', 20)], [seg('b', 60)]], 'center', boxLookup);
		expect(Math.abs(lines[1][0].baseline - lines[0][0].baseline - 62.55)).toBeLessThan(0.3);
	});

	it('aligns a short line against the widest one without stretching it', () => {
		const centred = layoutEnvelopeBlock([[seg('ab')], [seg('abcdef')]], 'center', boxLookup);
		expect(centred.lines[0].map((g) => g.x)).toStrictEqual([20, 30]);
		const right = layoutEnvelopeBlock([[seg('ab')], [seg('abcdef')]], 'right', boxLookup);
		expect(right.lines[0][0].x).toBe(40);
		const left = layoutEnvelopeBlock([[seg('ab')], [seg('abcdef')]], 'justify', boxLookup);
		expect(left.lines[0][0].x).toBe(0);
	});

	it('measures the block box from ink, widened only horizontally by whitespace', () => {
		const inked = layoutEnvelopeBlock([[seg('ab')]], 'left', boxLookup);
		expect(inked.box).toStrictEqual({ left: 1, right: 19, top: -14, bottom: 0 });
		const padded = layoutEnvelopeBlock([[seg(' ab ')]], 'left', boxLookup);
		expect(padded.box).toStrictEqual({ left: 0, right: 40, top: -14, bottom: 0 });
	});

	it('has no box when nothing has ink', () => {
		expect(layoutEnvelopeBlock([[seg('   ')]], 'left', boxLookup).box).toBeUndefined();
		expect(layoutEnvelopeBlock([], 'left', boxLookup).box).toBeUndefined();
	});

	it('estimates an ink box from the advance when no outline or ink metrics exist', () => {
		const { lines, box } = layoutEnvelopeBlock([[seg('a')]], 'left');
		expect(lines[0][0].outline).toBeUndefined();
		expect(box?.left).toBe(0);
		expect(box?.right).toBe(ADVANCE);
		expect(box?.bottom).toBe(0);
		expect(box?.top).toBeLessThan(0);
	});
});
