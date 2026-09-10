// @vitest-environment jsdom
/**
 * `text-warp-envelope-layout` tests. jsdom supplies `document`; the canvas
 * context is stubbed with a fixed per-character advance (see
 * `text-metric-tracking.test.ts` for the same pattern), since jsdom has no
 * real 2D context and the point here is the placement arithmetic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildGlyphEnvelope, resetGlyphEnvelopeMeasureCache } from './text-warp-envelope-layout';
import { edgeBandAt } from './text-warp-glyph-matrix';

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

	it('spans the box edge to edge instead of centring at the natural width', () => {
		// COM-measured 2026-09-11 (see `buildGlyphEnvelope`'s `stretch` doc
		// comment): PowerPoint spaces envelope glyphs edge to edge across the
		// box's own width rather than centring the line at its natural
		// (unstretched) advance width - `align` no longer inset the line.
		stubFixedAdvance(10);
		const placements = buildGlyphEnvelope(
			'textInflate',
			[{ text: 'AB', font: FONT, segmentIndex: 0 }],
			100,
			50,
			'center',
		);
		// line width = 20px (natural) stretched to fill the 100px box: the
		// first glyph starts at the box's own left edge, and the second
		// glyph's pitch is the natural 10px advance scaled by the stretch
		// factor (100 / 20 = 5), not the unstretched 10px.
		expect(placements[0].x).toBeCloseTo(0, 5);
		expect(placements[1].x).toBeCloseTo(50, 5);
	});

	it('keeps the natural centred placement when the line has no measurable width', () => {
		// Degenerate case (nothing to stretch): falls back to the pre-fix
		// `startX`/`align` placement rather than dividing by zero.
		stubFixedAdvance(0);
		const placements = buildGlyphEnvelope(
			'textInflate',
			[{ text: 'AB', font: FONT, segmentIndex: 0 }],
			100,
			50,
			'center',
		);
		expect(placements[0].x).toBeCloseTo(50, 5);
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
		it('leaves at least some glyphs unsliced for an ordinary caption (targeted, not blanket, cost)', () => {
			// Since the box-fill fix (see `buildGlyphEnvelope`'s `stretch` doc
			// comment) makes every glyph-envelope line span the box's own
			// width edge to edge, more of an ordinary caption's glyphs now
			// legitimately sit where a default-adj `textInflate` curve bends
			// fastest (its extremes and its centre-line inflection) and need
			// slicing - correctly: a single affine per glyph misses that
			// curvature. Some glyphs, away from those positions, still need
			// none: slicing stays a targeted cost keyed to local curvature,
			// not an unconditional one applied to every glyph regardless of
			// position.
			stubFixedAdvance(10);
			const placements = buildGlyphEnvelope(
				'textInflate',
				[{ text: 'A Warped Caption Here', font: FONT, segmentIndex: 0 }],
				230,
				80,
				'center',
			);
			const unsliced = placements.filter((p) => (p.slices?.length ?? 1) <= 1);
			const sliced = placements.filter((p) => (p.slices?.length ?? 1) > 1);
			expect(unsliced.length).toBeGreaterThan(0);
			expect(sliced.length).toBeGreaterThan(0);
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

	describe('getGlyphOutline', () => {
		it('is not consulted (and the affine transform/slices apply) when omitted', () => {
			stubFixedAdvance(20);
			const placements = buildGlyphEnvelope(
				'textInflate',
				[{ text: 'Hi', font: FONT, segmentIndex: 0 }],
				200,
				120,
				'center',
			);
			for (const p of placements) {
				expect(p.outlinePath).toBeUndefined();
				expect(p.transform).toBeTruthy();
			}
		});

		it('sets outlinePath from getGlyphOutline and skips slicing when it succeeds', () => {
			stubFixedAdvance(60);
			const getGlyphOutline = vi.fn(() => [
				{ type: 'M' as const, x: 0, y: 0 },
				{ type: 'L' as const, x: 10, y: 10 },
				{ type: 'Z' as const },
			]);
			const placements = buildGlyphEnvelope(
				'textCanUp',
				[{ text: 'MMMMMM', font: FONT, segmentIndex: 0 }],
				360,
				120,
				'center',
				66667,
				undefined,
				0,
				1,
				getGlyphOutline,
			);
			expect(getGlyphOutline).toHaveBeenCalledWith(
				'M',
				FONT,
				expect.any(Number),
				expect.any(Number),
			);
			for (const p of placements) {
				expect(p.outlinePath).toBeTruthy();
				expect(p.outlinePath!.startsWith('M')).toBeTruthy();
				// Outline warping is exact, so slicing (the affine-fit workaround)
				// never applies once an outline was obtained.
				expect(p.slices).toBeUndefined();
			}
		});

		it('falls back to the affine transform per-glyph when getGlyphOutline returns undefined', () => {
			stubFixedAdvance(20);
			const getGlyphOutline = vi.fn(() => undefined);
			const placements = buildGlyphEnvelope(
				'textInflate',
				[{ text: 'Hi', font: FONT, segmentIndex: 0 }],
				200,
				120,
				'center',
				undefined,
				undefined,
				0,
				1,
				getGlyphOutline,
			);
			expect(getGlyphOutline).toHaveBeenCalledWith(
				'H',
				FONT,
				expect.any(Number),
				expect.any(Number),
			);
			for (const p of placements) {
				expect(p.outlinePath).toBeUndefined();
				expect(p.transform).toBeTruthy();
			}
		});

		it('treats an empty-array result (whitespace) as "nothing to draw", not a failure', () => {
			stubFixedAdvance(20);
			const getGlyphOutline = vi.fn(() => []);
			const placements = buildGlyphEnvelope(
				'textInflate',
				[{ text: ' ', font: FONT, segmentIndex: 0 }],
				200,
				120,
				'center',
				undefined,
				undefined,
				0,
				1,
				getGlyphOutline,
			);
			// buildWarpedGlyphOutlinePathD returns undefined for an empty command
			// list, so the space glyph still carries its (harmless, invisible)
			// affine transform rather than a broken empty `outlinePath`.
			expect(placements[0].outlinePath).toBeUndefined();
		});
	});
});

/** Stub `measureText` to also report a fixed `actualBoundingBoxAscent`. */
function stubAscent(widthPerChar: number, actualBoundingBoxAscent: number | undefined): void {
	vi.spyOn(document, 'createElement').mockReturnValue({
		getContext: () => ({
			font: '',
			measureText(text: string) {
				return { width: [...text].length * widthPerChar, actualBoundingBoxAscent };
			},
		}),
	} as unknown as HTMLElement);
}

describe('nomTop derived from real text ascent (COM-measured regression)', () => {
	// COM-measured 2026-09-11 (see `measureLineAscent`'s doc comment): mapping
	// a glyph's nominal band from a FIXED fraction of box height, instead of
	// the line's own real ink ascent, undershot PowerPoint's real envelope by
	// ~30-40% of box height on interior columns for an Arimo Bold 44pt caption
	// in a 100pt-tall box (real cap height reaches only t~0.57 of the fixed
	// 0.15..0.85 band). These pin the fix's arithmetic directly against the
	// public `edgeBandAt`/`glyphEnvelopeMatrix` building blocks, independent
	// of any specific preset table's own numbers.
	const HEIGHT = 100;
	const PRESET = 'textInflate';

	it('narrows the nominal band to the real ascent when it is smaller than the fixed band', () => {
		// One glyph spanning the WHOLE line (u0=0, u1=1) so `d` is driven
		// entirely by the box-relative nominal span, matching
		// `glyphEnvelopeMatrix`'s own closed form.
		stubAscent(100, 40);
		const adj = 66667;
		const placements = buildGlyphEnvelope(
			PRESET,
			[{ text: 'M', font: FONT, segmentIndex: 0 }],
			100,
			HEIGHT,
			'center',
			adj,
		);
		expect(placements).toHaveLength(1);
		const { d } = parseGlyphMatrix(placements[0].transform);

		const edge0 = edgeBandAt(PRESET, 0, adj, undefined, HEIGHT, 0, 1);
		const edge1 = edgeBandAt(PRESET, 1, adj, undefined, HEIGHT, 0, 1);
		const nomBottom = HEIGHT * 0.85;
		const expectedNomTop = Math.max(HEIGHT * 0.15, nomBottom - 40); // = 45
		const expectedNominalSpan = nomBottom - expectedNomTop; // = 40
		const expectedD =
			(edge0.bottom - edge0.top + (edge1.bottom - edge1.top)) / (2 * expectedNominalSpan);
		expect(d).toBeCloseTo(expectedD, 6);

		// Must differ from the OLD fixed-band scale (nominalSpan = 70) - a test
		// that only checked `d` against a value both formulas share would pass
		// vacuously even without the fix.
		const oldNominalSpan = HEIGHT * (0.85 - 0.15);
		const oldD = (edge0.bottom - edge0.top + (edge1.bottom - edge1.top)) / (2 * oldNominalSpan);
		expect(d).not.toBeCloseTo(oldD, 3);
	});

	it('leaves the fixed band unchanged when the real ascent already fills (or exceeds) it', () => {
		stubAscent(100, 90); // 90 > the fixed band's 70px nominal span
		const placements = buildGlyphEnvelope(
			PRESET,
			[{ text: 'M', font: FONT, segmentIndex: 0 }],
			100,
			HEIGHT,
			'center',
		);
		const { d } = parseGlyphMatrix(placements[0].transform);
		const edge0 = edgeBandAt(PRESET, 0, undefined, undefined, HEIGHT, 0, 1);
		const edge1 = edgeBandAt(PRESET, 1, undefined, undefined, HEIGHT, 0, 1);
		const oldNominalSpan = HEIGHT * (0.85 - 0.15);
		const expectedD =
			(edge0.bottom - edge0.top + (edge1.bottom - edge1.top)) / (2 * oldNominalSpan);
		expect(d).toBeCloseTo(expectedD, 6);
	});

	it('leaves the fixed band unchanged when measureText reports no ascent at all', () => {
		// The stub used throughout this file's other tests (and jsdom's own
		// `measureText`): a `width` with no `actualBoundingBoxAscent` field.
		stubFixedAdvance(100);
		const placements = buildGlyphEnvelope(
			PRESET,
			[{ text: 'M', font: FONT, segmentIndex: 0 }],
			100,
			HEIGHT,
			'center',
		);
		const { d } = parseGlyphMatrix(placements[0].transform);
		const edge0 = edgeBandAt(PRESET, 0, undefined, undefined, HEIGHT, 0, 1);
		const edge1 = edgeBandAt(PRESET, 1, undefined, undefined, HEIGHT, 0, 1);
		const oldNominalSpan = HEIGHT * (0.85 - 0.15);
		const expectedD =
			(edge0.bottom - edge0.top + (edge1.bottom - edge1.top)) / (2 * oldNominalSpan);
		expect(d).toBeCloseTo(expectedD, 6);
	});
});
