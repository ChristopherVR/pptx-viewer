/**
 * Tests for the WordArt text-warp path generators in `text-warp.ts`.
 *
 * Ported from the React colocated suites
 * (`viewer/utils/warp-path-generators.test.ts` and `warp-path-cascade.test.ts`)
 * when the pure path-generation logic was extracted into `pptx-viewer-shared`.
 */
import type { PptxTextWarpPreset } from 'pptx-viewer-core';
import { describe, it, expect, expectTypeOf } from 'vitest';

import {
	SVG_WARP_PRESETS,
	WARP_PATH_GENERATORS,
	shouldUseSvgWarp,
	getWarpPath,
	cascadeUpPath,
	cascadeDownPath,
} from './text-warp';

/** Matches the start/end y-coordinates of a straight `M 0,y L x,y` path. */
const LINE_ENDPOINTS = /M 0,(?<yStart>\d+\.?\d*)\s+L\s+\d+\.?\d*,(?<yEnd>\d+\.?\d*)/u;

describe('the SVG_WARP_PRESETS table', () => {
	it('should contain all priority 1 presets', () => {
		expect(SVG_WARP_PRESETS.has('textArchUp')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textArchDown')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textCircle')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textWave1')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textInflate')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textDeflate')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textCurveUp')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textCurveDown')).toBeTruthy();
	});

	it('should contain priority 2 presets', () => {
		expect(SVG_WARP_PRESETS.has('textWave2')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textCascadeUp')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textCascadeDown')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textButton')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textRingInside')).toBeTruthy();
	});

	it('should contain priority 3 presets', () => {
		expect(SVG_WARP_PRESETS.has('textTriangle')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textStop')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textChevron')).toBeTruthy();
	});

	it('should contain priority 4 presets (slant, fade, pour, compound)', () => {
		expect(SVG_WARP_PRESETS.has('textSlantUp')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textSlantDown')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textFadeRight')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textFadeLeft')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textFadeUp')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textFadeDown')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textArchUpPour')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textArchDownPour')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textCirclePour')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textButtonPour')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textDeflateInflate')).toBeTruthy();
		expect(SVG_WARP_PRESETS.has('textDeflateInflateDeflate')).toBeTruthy();
	});

	it('should not contain plain text presets', () => {
		expect(SVG_WARP_PRESETS.has('textNoShape')).toBeFalsy();
		expect(SVG_WARP_PRESETS.has('textPlain')).toBeFalsy();
	});
});

describe('shouldUseSvgWarp', () => {
	it('should return false for undefined preset', () => {
		expect(shouldUseSvgWarp(undefined)).toBeFalsy();
	});

	it('should return false for "textNoShape"', () => {
		expect(shouldUseSvgWarp('textNoShape')).toBeFalsy();
	});

	it('should return false for "textPlain"', () => {
		expect(shouldUseSvgWarp('textPlain')).toBeFalsy();
	});

	it('should return true for known SVG warp presets', () => {
		expect(shouldUseSvgWarp('textArchUp')).toBeTruthy();
		expect(shouldUseSvgWarp('textCircle')).toBeTruthy();
		expect(shouldUseSvgWarp('textWave1')).toBeTruthy();
		expect(shouldUseSvgWarp('textTriangle')).toBeTruthy();
	});

	it('should return true for priority 4 presets', () => {
		expect(shouldUseSvgWarp('textSlantUp')).toBeTruthy();
		expect(shouldUseSvgWarp('textSlantDown')).toBeTruthy();
		expect(shouldUseSvgWarp('textFadeRight')).toBeTruthy();
		expect(shouldUseSvgWarp('textFadeLeft')).toBeTruthy();
		expect(shouldUseSvgWarp('textFadeUp')).toBeTruthy();
		expect(shouldUseSvgWarp('textFadeDown')).toBeTruthy();
		expect(shouldUseSvgWarp('textArchUpPour')).toBeTruthy();
		expect(shouldUseSvgWarp('textDeflateInflate')).toBeTruthy();
		expect(shouldUseSvgWarp('textDeflateInflateDeflate')).toBeTruthy();
	});

	it('should return false for unknown preset strings', () => {
		expect(shouldUseSvgWarp('textUnknownShape' as unknown as PptxTextWarpPreset)).toBeFalsy();
	});
});

describe('the WARP_PATH_GENERATORS table', () => {
	it('should have a generator for each SVG warp preset', () => {
		for (const preset of SVG_WARP_PRESETS) {
			expect(WARP_PATH_GENERATORS[preset]).toBeDefined();
			expectTypeOf(WARP_PATH_GENERATORS[preset]).toBeFunction();
		}
	});

	it('should produce valid SVG path strings', () => {
		for (const [_name, generator] of Object.entries(WARP_PATH_GENERATORS)) {
			const path = generator(200, 100, 0.5);
			expectTypeOf(path).toBeString();
			expect(path.charAt(0)).toBe('M');
		}
	});

	it('should produce different paths for different t values', () => {
		const gen = WARP_PATH_GENERATORS['textArchUp'];
		const pathTop = gen(200, 100, 0);
		const pathBottom = gen(200, 100, 1);
		expect(pathTop).not.toBe(pathBottom);
	});
});

describe('getWarpPath', () => {
	it('should return a valid SVG path for a known preset', () => {
		const path = getWarpPath('textArchUp', 200, 100, 0, 3);
		expect(path).toBeDefined();
		expect(path.startsWith('M')).toBeTruthy();
	});

	it('should use t=0.5 for single line', () => {
		const singleLine = getWarpPath('textWave1', 200, 100, 0, 1);
		const gen = WARP_PATH_GENERATORS['textWave1'];
		const expected = gen(200, 100, 0.5);
		expect(singleLine).toBe(expected);
	});

	it('should distribute t values across lines', () => {
		const firstLine = getWarpPath('textInflate', 200, 100, 0, 3);
		const lastLine = getWarpPath('textInflate', 200, 100, 2, 3);
		expect(firstLine).not.toBe(lastLine);
	});

	it('should return fallback straight line for unknown preset', () => {
		const path = getWarpPath('textUnknown' as unknown as PptxTextWarpPreset, 200, 100, 0, 1);
		expect(path).toContain('M 0,');
		expect(path).toContain('L 200,');
	});

	it('should handle zero height gracefully', () => {
		const path = getWarpPath('textArchUp', 200, 0, 0, 1);
		expectTypeOf(path).toBeString();
		expect(path.length).toBeGreaterThan(0);
	});

	it('should handle zero width gracefully', () => {
		const path = getWarpPath('textArchUp', 0, 100, 0, 1);
		expectTypeOf(path).toBeString();
		expect(path.length).toBeGreaterThan(0);
	});

	it('should handle t=0 for first line of multi-line text', () => {
		const gen = WARP_PATH_GENERATORS['textTriangle'];
		const expected = gen(200, 100, 0);
		const path = getWarpPath('textTriangle', 200, 100, 0, 5);
		expect(path).toBe(expected);
	});

	it('should handle t=1 for last line of multi-line text', () => {
		const gen = WARP_PATH_GENERATORS['textTriangle'];
		const expected = gen(200, 100, 1);
		const path = getWarpPath('textTriangle', 200, 100, 4, 5);
		expect(path).toBe(expected);
	});
});

describe('priority 4 path generators', () => {
	it('textSlantUp: end y should be less than start y', () => {
		const gen = WARP_PATH_GENERATORS['textSlantUp'];
		const path = gen(200, 100, 0.5);
		const match = path.match(LINE_ENDPOINTS);
		expect(match).not.toBeNull();
		const yStart = parseFloat(match!.groups!.yStart);
		const yEnd = parseFloat(match!.groups!.yEnd);
		expect(yStart).toBeGreaterThan(yEnd);
	});

	it('textSlantDown: end y should be greater than start y', () => {
		const gen = WARP_PATH_GENERATORS['textSlantDown'];
		const path = gen(200, 100, 0.5);
		const match = path.match(LINE_ENDPOINTS);
		expect(match).not.toBeNull();
		const yStart = parseFloat(match!.groups!.yStart);
		const yEnd = parseFloat(match!.groups!.yEnd);
		expect(yEnd).toBeGreaterThan(yStart);
	});

	it('textFadeUp / textFadeDown vary with t', () => {
		for (const preset of ['textFadeUp', 'textFadeDown']) {
			const gen = WARP_PATH_GENERATORS[preset];
			const pathTop = gen(200, 100, 0);
			const pathBottom = gen(200, 100, 1);
			expect(pathTop).toMatch(/^M\s/u);
			expect(pathBottom).toMatch(/^M\s/u);
			expect(pathTop).not.toBe(pathBottom);
		}
	});

	it('textFadeRight / textFadeLeft produce valid paths', () => {
		for (const preset of ['textFadeRight', 'textFadeLeft']) {
			const path = WARP_PATH_GENERATORS[preset](200, 100, 0.5);
			expect(path).toMatch(/^M 0,/u);
			expect(path).toContain('L 200,');
		}
	});

	it('textArchUpPour / textArchDownPour produce valid arc paths', () => {
		for (const preset of ['textArchUpPour', 'textArchDownPour']) {
			const path = WARP_PATH_GENERATORS[preset](200, 100, 0);
			expect(path).toMatch(/^M/u);
			expect(path).toContain('A');
		}
	});

	it('textCirclePour produces a valid ellipse path', () => {
		const path = WARP_PATH_GENERATORS['textCirclePour'](200, 100, 0.5);
		expect(path).toMatch(/^M/u);
		expect((path.match(/A /gu) || []).length).toBeGreaterThanOrEqual(2);
	});

	it('textButtonPour / textDeflateInflate produce a quadratic curve', () => {
		for (const preset of ['textButtonPour', 'textDeflateInflate']) {
			const path = WARP_PATH_GENERATORS[preset](200, 100, 0.5);
			expect(path).toMatch(/^M/u);
			expect(path).toContain('Q');
		}
	});

	it('textDeflateInflateDeflate produces valid path with two curves', () => {
		const path = WARP_PATH_GENERATORS['textDeflateInflateDeflate'](200, 100, 0.5);
		expect(path).toMatch(/^M/u);
		expect((path.match(/Q /gu) || []).length).toBeGreaterThanOrEqual(2);
	});

	it('all priority 4 generators produce different paths for t=0 vs t=1', () => {
		const p4Presets = [
			'textSlantUp',
			'textSlantDown',
			'textFadeRight',
			'textFadeLeft',
			'textFadeUp',
			'textFadeDown',
			'textArchUpPour',
			'textArchDownPour',
			'textCirclePour',
			'textButtonPour',
			'textDeflateInflate',
			'textDeflateInflateDeflate',
		];
		for (const preset of p4Presets) {
			const gen = WARP_PATH_GENERATORS[preset];
			expect(gen).toBeDefined();
			expect(gen(200, 100, 0)).not.toBe(gen(200, 100, 1));
		}
	});

	it('paths scale with dimensions', () => {
		const gen = WARP_PATH_GENERATORS['textSlantUp'];
		const small = gen(100, 50, 0.5);
		const large = gen(400, 200, 0.5);
		expect(small).not.toBe(large);
		expect(large).toContain('400,');
	});
});

describe('adjustment values (adj/adj2)', () => {
	it('textInflate: adj=0 still produces a valid curve', () => {
		const path = WARP_PATH_GENERATORS['textInflate'](200, 100, 0.5, 0);
		expect(path).toMatch(/^M/u);
		expect(path).toContain('Q');
	});

	it.each([
		['textInflate', 0, 37500, 0],
		['textWave1', 0.5, 5000, 25000],
		['textDeflate', 0.2, undefined, 37500],
		['textTriangle', 0, 10000, 90000],
		['textCurveUp', 0.5, undefined, 91954],
		['textButton', 0.3, undefined, 37500],
		['textChevron', 0.3, 10000, 50000],
		['textChevronInverted', 0.7, 10000, 50000],
		['textCanUp', 0.3, undefined, 37500],
		['textCanDown', 0.5, undefined, 37500],
		['textRingInside', 0.5, undefined, 37500],
		['textRingOutside', 0.5, undefined, 37500],
		['textStop', 0.3, undefined, 50000],
		['textSlantUp', 0.5, undefined, 110000],
		['textSlantDown', 0.5, undefined, 110000],
		['textFadeRight', 0.3, undefined, 100000],
		['textFadeUp', 0, undefined, 100000],
		['textInflateBottom', 0.8, undefined, 37500],
		['textDeflateTop', 0.2, undefined, 37500],
		['textButtonPour', 0.3, undefined, 37500],
		['textDeflateInflate', 0.3, undefined, 37500],
		['textDeflateInflateDeflate', 0.3, undefined, 37500],
	] as const)('%s: adj changes the generated path', (preset, t, lowAdj, highAdj) => {
		const gen = WARP_PATH_GENERATORS[preset];
		const baseline = gen(200, 100, t, lowAdj);
		const adjusted = gen(200, 100, t, highAdj);
		expect(baseline).not.toBe(adjusted);
	});

	it.each(['textArchUp', 'textArchUpPour', 'textCirclePour', 'textCircle'] as const)(
		'%s: arc-style adj changes the generated path',
		(preset) => {
			const gen = WARP_PATH_GENERATORS[preset];
			expect(gen(200, 100, 0.3)).not.toBe(gen(200, 100, 0.3, 5400000));
		},
	);

	it.each(['textWave1', 'textWave2'] as const)('%s: adj2 controls horizontal shift', (preset) => {
		const gen = WARP_PATH_GENERATORS[preset];
		expect(gen(200, 100, 0.5, 12500, 0)).not.toBe(gen(200, 100, 0.5, 12500, 50000));
	});

	it('all generators accept adj without error', () => {
		for (const [_name, gen] of Object.entries(WARP_PATH_GENERATORS)) {
			expect(gen(200, 100, 0.5, 50000, 25000)).toMatch(/^M/u);
		}
	});

	it('getWarpPath passes adj/adj2 through to generator', () => {
		const gen = WARP_PATH_GENERATORS['textInflate'];
		const expected = gen(200, 100, 0.5, 37500, undefined);
		const result = getWarpPath('textInflate', 200, 100, 0, 1, 37500);
		expect(result).toBe(expected);
	});

	it('getWarpPath with adj produces different result from without', () => {
		const withoutAdj = getWarpPath('textWave1', 200, 100, 0, 1);
		const withAdj = getWarpPath('textWave1', 200, 100, 0, 1, 25000);
		expect(withoutAdj).not.toBe(withAdj);
	});
});

describe('cascade generators', () => {
	it('cascadeUpPath: yEnd is lower than yStart (lines go up to the right)', () => {
		const path = cascadeUpPath(200, 100, 0.5);
		const match = path.match(LINE_ENDPOINTS);
		expect(match).not.toBeNull();
		expect(parseFloat(match!.groups!.yStart)).toBeGreaterThan(parseFloat(match!.groups!.yEnd));
	});

	it('cascadeDownPath: yEnd is higher than yStart (lines go down to the right)', () => {
		const path = cascadeDownPath(200, 100, 0.5);
		const match = path.match(LINE_ENDPOINTS);
		expect(match).not.toBeNull();
		expect(parseFloat(match!.groups!.yEnd)).toBeGreaterThan(parseFloat(match!.groups!.yStart));
	});

	it('cascadeDownPath is the mirror of cascadeUpPath', () => {
		const upMatch = cascadeUpPath(200, 100, 0.5).match(LINE_ENDPOINTS);
		const downMatch = cascadeDownPath(200, 100, 0.5).match(LINE_ENDPOINTS);
		expect(parseFloat(upMatch!.groups!.yStart)).toBeCloseTo(parseFloat(downMatch!.groups!.yEnd), 5);
		expect(parseFloat(upMatch!.groups!.yEnd)).toBeCloseTo(parseFloat(downMatch!.groups!.yStart), 5);
	});

	it.each([cascadeUpPath, cascadeDownPath])('adj=0 produces a flat line', (fn) => {
		const match = fn(200, 100, 0.5, 0).match(LINE_ENDPOINTS);
		expect(match).not.toBeNull();
		expect(parseFloat(match!.groups!.yStart)).toBeCloseTo(parseFloat(match!.groups!.yEnd), 5);
	});

	it.each([cascadeUpPath, cascadeDownPath])('adj controls tilt amount', (fn) => {
		expect(fn(200, 100, 0.5)).not.toBe(fn(200, 100, 0.5, 88888));
	});
});
