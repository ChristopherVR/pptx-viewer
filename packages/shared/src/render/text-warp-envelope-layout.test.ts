// @vitest-environment jsdom
/**
 * `text-warp-envelope-layout` tests. The canvas is stubbed with a fixed
 * per-character advance (jsdom has no real 2D context), so these pin the
 * placement pipeline, not real font shaping.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	buildGlyphEnvelope,
	buildGlyphEnvelopeBlock,
	resetGlyphEnvelopeMeasureCache,
} from './text-warp-envelope-layout';
import type { EnvelopeSegmentInput, GlyphOutlineLookup } from './text-warp-envelope-types';

const FONT = { fontFamily: 'Arial', fontSizePx: 20 };
const ADVANCE = 12;

function seg(text: string, segmentIndex = 0): EnvelopeSegmentInput {
	return { text, font: FONT, segmentIndex };
}

/** Every glyph drawn as a box inset 1px inside its advance, 14px tall. */
const boxLookup: GlyphOutlineLookup = (_char, _font, x, y) => [
	{ type: 'M', x: x + 1, y: y - 14 },
	{ type: 'L', x: x + ADVANCE - 1, y: y - 14 },
	{ type: 'L', x: x + ADVANCE - 1, y },
	{ type: 'L', x: x + 1, y },
	{ type: 'Z' },
];

function pathPoints(d: string): { x: number; y: number }[] {
	return [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/gu)].map((m) => ({
		x: Number(m[1]),
		y: Number(m[2]),
	}));
}

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

describe('buildGlyphEnvelopeBlock', () => {
	it('returns one placement per character per paragraph, in order', () => {
		const lines = buildGlyphEnvelopeBlock(
			'textInflate',
			[[seg('ab'), seg('c', 1)], [seg('de')]],
			300,
			100,
			'center',
		);
		expect(lines.map((l) => l.map((g) => g.char).join(''))).toStrictEqual(['abc', 'de']);
		expect(lines[0][2].segmentIndex).toBe(1);
	});

	it('is empty per paragraph for a non-envelope preset or a degenerate box', () => {
		expect(buildGlyphEnvelopeBlock('textArchUp', [[seg('ab')]], 300, 100, 'center')).toStrictEqual([
			[],
		]);
		expect(buildGlyphEnvelopeBlock('textInflate', [[seg('ab')]], 0, 100, 'center')).toStrictEqual([
			[],
		]);
	});

	it('warps outlines edge to edge across the whole box', () => {
		const [line] = buildGlyphEnvelopeBlock(
			'textInflate',
			[[seg('abc')]],
			300,
			100,
			'center',
			0,
			undefined,
			boxLookup,
		);
		const points = line.flatMap((g) => pathPoints(g.outlinePath!));
		expect(Math.min(...points.map((p) => p.x))).toBeCloseTo(0, 1);
		expect(Math.max(...points.map((p) => p.x))).toBeCloseTo(300, 1);
		expect(Math.min(...points.map((p) => p.y))).toBeCloseTo(0, 1);
		expect(Math.max(...points.map((p) => p.y))).toBeCloseTo(100, 1);
	});

	it('keeps rows apart for a short, heavily stretched paragraph (no crossing)', () => {
		const lines = buildGlyphEnvelopeBlock(
			'textInflate',
			[[seg('Top')], [seg('Bottom')]],
			200,
			160,
			'center',
			undefined,
			undefined,
			boxLookup,
		);
		const rowTop = lines[0].flatMap((g) => pathPoints(g.outlinePath!));
		const rowBottom = lines[1].flatMap((g) => pathPoints(g.outlinePath!));
		for (const p of rowTop) {
			const below = rowBottom.filter((q) => Math.abs(q.x - p.x) < 4);
			for (const q of below) {
				expect(p.y).toBeLessThan(q.y);
			}
		}
	});

	it('falls back to an affine transform (full matrix) when no outline is obtainable', () => {
		const [line] = buildGlyphEnvelopeBlock('textCanUp', [[seg('ab')]], 300, 100, 'center');
		for (const glyph of line) {
			expect(glyph.outlinePath).toBeUndefined();
			expect(glyph.transform).toMatch(/^matrix\((-?[\d.e-]+ ){5}-?[\d.e-]+\)$/u);
		}
	});

	it('treats whitespace as nothing to draw without failing the lookup', () => {
		const [line] = buildGlyphEnvelopeBlock(
			'textInflate',
			[[seg('a b')]],
			300,
			100,
			'center',
			undefined,
			undefined,
			boxLookup,
		);
		expect(line[1].outlinePath).toBeUndefined();
		expect(line[0].outlinePath).toBeDefined();
		expect(line[2].outlinePath).toBeDefined();
	});
});

describe('buildGlyphEnvelope', () => {
	it('is the single-paragraph case of buildGlyphEnvelopeBlock', () => {
		const single = buildGlyphEnvelope('textCanDown', [seg('abc')], 300, 100, 'center', 20000);
		const block = buildGlyphEnvelopeBlock('textCanDown', [[seg('abc')]], 300, 100, 'center', 20000);
		expect(single).toStrictEqual(block[0]);
	});
});
