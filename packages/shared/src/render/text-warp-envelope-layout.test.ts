// @vitest-environment jsdom
/**
 * `text-warp-envelope-layout` tests. jsdom supplies `document`; the canvas
 * context is stubbed with a fixed per-character advance (see
 * `text-metric-tracking.test.ts` for the same pattern), since jsdom has no
 * real 2D context and the point here is the placement arithmetic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	buildGlyphEnvelope,
	measureGlyphAdvances,
	resetGlyphEnvelopeMeasureCache,
} from './text-warp-envelope-layout';

const FONT = { fontFamily: 'Arial', fontSizePx: 20 };

/** Parse a glyph's `matrix(1 b 0 d 0 f)` transform into its `{ b, d, f }` terms. */
function parseGlyphMatrix(transform: string): { b: number; d: number; f: number } {
	const match =
		/matrix\(\s*1\s+(-?[\d.eE+-]+)\s+0\s+(-?[\d.eE+-]+)\s+0\s+(-?[\d.eE+-]+)\s*\)/u.exec(
			transform,
		)!;
	return { b: Number(match[1]), d: Number(match[2]), f: Number(match[3]) };
}

function stubFixedAdvance(px: number): void {
	vi.spyOn(document, 'createElement').mockReturnValue({
		getContext: () => ({
			font: '',
			measureText(text: string) {
				return { width: [...text].length * px };
			},
		}),
	} as unknown as HTMLElement);
}

beforeEach(() => {
	resetGlyphEnvelopeMeasureCache();
});

afterEach(() => {
	vi.restoreAllMocks();
	resetGlyphEnvelopeMeasureCache();
});

describe('measureGlyphAdvances', () => {
	it('measures each character at the stubbed advance', () => {
		stubFixedAdvance(10);
		expect(measureGlyphAdvances('abc', FONT)).toStrictEqual([10, 10, 10]);
	});

	it('falls back to a font-size estimate with no DOM canvas context', () => {
		vi.spyOn(document, 'createElement').mockReturnValue({
			getContext: () => null,
		} as unknown as HTMLElement);
		const advances = measureGlyphAdvances('ab', FONT);
		expect(advances).toStrictEqual([FONT.fontSizePx * 0.55, FONT.fontSizePx * 0.55]);
	});
});

describe('buildGlyphEnvelope', () => {
	it('returns one placement per character across every segment', () => {
		stubFixedAdvance(10);
		const placements = buildGlyphEnvelope(
			'textInflate',
			[
				{ text: 'AB', font: FONT, segmentIndex: 0 },
				{ text: 'CD', font: FONT, segmentIndex: 1 },
			],
			200,
			100,
			'left',
		);
		expect(placements.map((p) => p.char)).toStrictEqual(['A', 'B', 'C', 'D']);
		expect(placements.map((p) => p.segmentIndex)).toStrictEqual([0, 0, 1, 1]);
	});

	it('is empty for a non-envelope preset (path family handled elsewhere)', () => {
		stubFixedAdvance(10);
		expect(
			buildGlyphEnvelope(
				'textArchUp',
				[{ text: 'A', font: FONT, segmentIndex: 0 }],
				200,
				100,
				'center',
			),
		).toStrictEqual([]);
	});

	it('places glyphs left-to-right with monotonically increasing x', () => {
		stubFixedAdvance(10);
		const placements = buildGlyphEnvelope(
			'textDeflate',
			[{ text: 'HELLO', font: FONT, segmentIndex: 0 }],
			300,
			100,
			'center',
		);
		for (let i = 1; i < placements.length; i++) {
			expect(placements[i].x).toBeGreaterThan(placements[i - 1].x);
		}
	});

	it('centres the line: the first glyph is inset by half the leftover width', () => {
		stubFixedAdvance(10);
		const placements = buildGlyphEnvelope(
			'textInflate',
			[{ text: 'AB', font: FONT, segmentIndex: 0 }],
			100,
			50,
			'center',
		);
		// line width = 20px in a 100px box -> 40px inset on each side.
		expect(placements[0].x).toBeCloseTo(40, 5);
	});

	it('varies scaleY across the line for an inflate preset (the fixed residual)', () => {
		stubFixedAdvance(6);
		// A box only slightly wider than the (measured) line width so the
		// glyphs' normalised horizontal positions span most of [0, 1] - the
		// same as a WordArt box sized to fit its text in PowerPoint.
		const placements = buildGlyphEnvelope(
			'textInflate',
			[{ text: 'INFLATED TEXT HERE', font: FONT, segmentIndex: 0 }],
			120,
			60,
			'center',
			4 * 18750,
		);
		const scales = placements.map((p) => parseGlyphMatrix(p.transform).d);
		const min = Math.min(...scales);
		const max = Math.max(...scales);
		// A true two-curve envelope must vary glyph height across the line;
		// a single shared baseline curve (the old approximation) would not.
		expect(max - min).toBeGreaterThan(0.1);
		// The middle glyph (tallest for Inflate) scales up; the edge glyphs
		// scale down relative to the nominal (undeformed) band.
		const middleIndex = Math.floor(placements.length / 2);
		expect(scales[middleIndex]).toBeGreaterThan(scales[0]);
		expect(scales[middleIndex]).toBeGreaterThan(scales[scales.length - 1]);
	});

	describe('multi-paragraph banding (lineIndex/lineCount)', () => {
		// `matrix(1 b 0 d 0 f)`: the glyph's own drawn point `(x, y)` maps to
		// `(x, b*x + d*y + f)` in the parent coordinate system.
		function centreY(transform: string, x: number, y: number): number {
			const { b, d, f } = parseGlyphMatrix(transform);
			return b * x + d * y + f;
		}

		it('defaults to lineIndex=0/lineCount=1 (unchanged single-line behaviour)', () => {
			stubFixedAdvance(10);
			const explicit = buildGlyphEnvelope(
				'textInflate',
				[{ text: 'AB', font: FONT, segmentIndex: 0 }],
				100,
				50,
				'center',
				undefined,
				undefined,
				0,
				1,
			);
			const implicit = buildGlyphEnvelope(
				'textInflate',
				[{ text: 'AB', font: FONT, segmentIndex: 0 }],
				100,
				50,
				'center',
			);
			expect(implicit).toStrictEqual(explicit);
		});

		it('places line 0 of 2 strictly above line 1 of 2 (top/bottom band slices)', () => {
			stubFixedAdvance(10);
			const segs = [{ text: 'AB', font: FONT, segmentIndex: 0 }];
			const line0 = buildGlyphEnvelope(
				'textInflate',
				segs,
				100,
				100,
				'center',
				undefined,
				undefined,
				0,
				2,
			);
			const line1 = buildGlyphEnvelope(
				'textInflate',
				segs,
				100,
				100,
				'center',
				undefined,
				undefined,
				1,
				2,
			);
			expect(line0).toHaveLength(2);
			expect(line1).toHaveLength(2);
			for (let i = 0; i < line0.length; i++) {
				const y0 = centreY(line0[i].transform, line0[i].x, line0[i].y);
				const y1 = centreY(line1[i].transform, line1[i].x, line1[i].y);
				expect(y0).toBeLessThan(y1);
			}
		});

		it('clamps an out-of-range lineIndex into [0, lineCount)', () => {
			stubFixedAdvance(10);
			const segs = [{ text: 'A', font: FONT, segmentIndex: 0 }];
			const clamped = buildGlyphEnvelope(
				'textInflate',
				segs,
				100,
				100,
				'center',
				undefined,
				undefined,
				5,
				2,
			);
			const last = buildGlyphEnvelope(
				'textInflate',
				segs,
				100,
				100,
				'center',
				undefined,
				undefined,
				1,
				2,
			);
			expect(clamped).toStrictEqual(last);
		});

		it('returns [] for lineCount < 1', () => {
			stubFixedAdvance(10);
			const segs = [{ text: 'A', font: FONT, segmentIndex: 0 }];
			expect(
				buildGlyphEnvelope('textInflate', segs, 100, 100, 'center', undefined, undefined, 0, 0),
			).toStrictEqual([]);
		});
	});

	describe('per-glyph slicing (short, wide-glyph captions)', () => {
		it('leaves `slices` undefined for an ordinary caption (no extra cost)', () => {
			stubFixedAdvance(10);
			const placements = buildGlyphEnvelope(
				'textInflate',
				[{ text: 'Warped', font: FONT, segmentIndex: 0 }],
				300,
				80,
				'center',
			);
			for (const p of placements) {
				expect(p.slices).toBeUndefined();
			}
		});

		it('adds slices for a short caption of very wide glyphs on a steep curve', () => {
			// A handful of very wide glyphs filling the whole box, on `textCanUp`
			// at an extreme `adj` (the steepest `arcTo` sweep): exactly the
			// residual documented in limitations.md.
			stubFixedAdvance(60);
			const placements = buildGlyphEnvelope(
				'textCanUp',
				[{ text: 'MMMMMM', font: FONT, segmentIndex: 0 }],
				360,
				120,
				'center',
				66667,
			);
			expect(placements.some((p) => (p.slices?.length ?? 1) > 1)).toBeTruthy();
		});

		it('every glyph slice set tiles [x0, x1] with clipX0 < clipX1 in order', () => {
			stubFixedAdvance(60);
			const placements = buildGlyphEnvelope(
				'textCanUp',
				[{ text: 'MMMMMM', font: FONT, segmentIndex: 0 }],
				360,
				120,
				'center',
				66667,
			);
			for (const p of placements) {
				if (!p.slices || p.slices.length <= 1) {
					continue;
				}
				for (let i = 0; i < p.slices.length; i++) {
					expect(p.slices[i].clipX0).toBeLessThan(p.slices[i].clipX1);
				}
				for (let i = 1; i < p.slices.length; i++) {
					expect(p.slices[i].clipX0).toBeLessThanOrEqual(p.slices[i - 1].clipX1);
				}
			}
		});
	});
});
