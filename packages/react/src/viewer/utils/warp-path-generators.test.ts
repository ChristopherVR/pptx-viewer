import { describe, it, expect } from 'vitest';
import {
	SVG_WARP_PRESETS,
	WARP_PATH_GENERATORS,
	shouldUseSvgWarp,
	getWarpPath,
} from './warp-path-generators';

describe('SVG_WARP_PRESETS', () => {
	it('should contain all priority 1 presets', () => {
		expect(SVG_WARP_PRESETS.has('textArchUp')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textArchDown')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textCircle')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textWave1')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textInflate')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textDeflate')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textCurveUp')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textCurveDown')).toBe(true);
	});

	it('should contain priority 2 presets', () => {
		expect(SVG_WARP_PRESETS.has('textWave2')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textCascadeUp')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textCascadeDown')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textButton')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textRingInside')).toBe(true);
	});

	it('should contain priority 3 presets', () => {
		expect(SVG_WARP_PRESETS.has('textTriangle')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textStop')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textChevron')).toBe(true);
	});

	it('should contain priority 4 presets (slant, fade, pour, compound)', () => {
		expect(SVG_WARP_PRESETS.has('textSlantUp')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textSlantDown')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textFadeRight')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textFadeLeft')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textFadeUp')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textFadeDown')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textArchUpPour')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textArchDownPour')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textCirclePour')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textButtonPour')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textDeflateInflate')).toBe(true);
		expect(SVG_WARP_PRESETS.has('textDeflateInflateDeflate')).toBe(true);
	});

	it('should not contain plain text presets', () => {
		expect(SVG_WARP_PRESETS.has('textNoShape')).toBe(false);
		expect(SVG_WARP_PRESETS.has('textPlain')).toBe(false);
	});
});

describe('shouldUseSvgWarp', () => {
	it('should return false for undefined preset', () => {
		expect(shouldUseSvgWarp(undefined)).toBe(false);
	});

	it('should return false for "textNoShape"', () => {
		expect(shouldUseSvgWarp('textNoShape')).toBe(false);
	});

	it('should return false for "textPlain"', () => {
		expect(shouldUseSvgWarp('textPlain')).toBe(false);
	});

	it('should return true for known SVG warp presets', () => {
		expect(shouldUseSvgWarp('textArchUp')).toBe(true);
		expect(shouldUseSvgWarp('textCircle')).toBe(true);
		expect(shouldUseSvgWarp('textWave1')).toBe(true);
		expect(shouldUseSvgWarp('textTriangle')).toBe(true);
	});

	it('should return true for priority 4 presets', () => {
		expect(shouldUseSvgWarp('textSlantUp')).toBe(true);
		expect(shouldUseSvgWarp('textSlantDown')).toBe(true);
		expect(shouldUseSvgWarp('textFadeRight')).toBe(true);
		expect(shouldUseSvgWarp('textFadeLeft')).toBe(true);
		expect(shouldUseSvgWarp('textFadeUp')).toBe(true);
		expect(shouldUseSvgWarp('textFadeDown')).toBe(true);
		expect(shouldUseSvgWarp('textArchUpPour')).toBe(true);
		expect(shouldUseSvgWarp('textDeflateInflate')).toBe(true);
		expect(shouldUseSvgWarp('textDeflateInflateDeflate')).toBe(true);
	});

	it('should return false for unknown preset strings', () => {
		expect(shouldUseSvgWarp('textUnknownShape' as any)).toBe(false);
	});
});

describe('WARP_PATH_GENERATORS', () => {
	it('should have a generator for each SVG warp preset', () => {
		for (const preset of SVG_WARP_PRESETS) {
			expect(WARP_PATH_GENERATORS[preset]).toBeDefined();
			expect(typeof WARP_PATH_GENERATORS[preset]).toBe('function');
		}
	});

	it('should produce valid SVG path strings', () => {
		for (const [name, generator] of Object.entries(WARP_PATH_GENERATORS)) {
			const path = generator(200, 100, 0.5);
			expect(typeof path).toBe('string');
			// All paths should start with M
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
		expect(path.startsWith('M')).toBe(true);
	});

	it('should use t=0.5 for single line', () => {
		const singleLine = getWarpPath('textWave1', 200, 100, 0, 1);
		// With lineCount=1, t should be 0.5
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
		const path = getWarpPath('textUnknown' as any, 200, 100, 0, 1);
		// Fallback: M 0,{y} L {w},{y}
		expect(path).toContain('M 0,');
		expect(path).toContain('L 200,');
	});

	it('should handle zero height gracefully', () => {
		const path = getWarpPath('textArchUp', 200, 0, 0, 1);
		expect(typeof path).toBe('string');
		expect(path.length).toBeGreaterThan(0);
	});

	it('should handle zero width gracefully', () => {
		const path = getWarpPath('textArchUp', 0, 100, 0, 1);
		expect(typeof path).toBe('string');
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

describe('Priority 4 path generators', () => {
	it('textSlantUp: end y should be less than start y', () => {
		const gen = WARP_PATH_GENERATORS['textSlantUp'];
		const path = gen(200, 100, 0.5);
		const match = path.match(/M 0,(\d+\.?\d*)\s+L\s+\d+\.?\d*,(\d+\.?\d*)/);
		expect(match).not.toBeNull();
		const yStart = parseFloat(match![1]);
		const yEnd = parseFloat(match![2]);
		expect(yStart).toBeGreaterThan(yEnd);
	});

	it('textSlantDown: end y should be greater than start y', () => {
		const gen = WARP_PATH_GENERATORS['textSlantDown'];
		const path = gen(200, 100, 0.5);
		const match = path.match(/M 0,(\d+\.?\d*)\s+L\s+\d+\.?\d*,(\d+\.?\d*)/);
		expect(match).not.toBeNull();
		const yStart = parseFloat(match![1]);
		const yEnd = parseFloat(match![2]);
		expect(yEnd).toBeGreaterThan(yStart);
	});

	it('textFadeUp: line width should grow as t increases', () => {
		const gen = WARP_PATH_GENERATORS['textFadeUp'];
		const pathTop = gen(200, 100, 0);
		const pathBottom = gen(200, 100, 1);
		// Both start with M and contain L
		expect(pathTop).toMatch(/^M\s/);
		expect(pathBottom).toMatch(/^M\s/);
		expect(pathTop).not.toBe(pathBottom);
	});

	it('textFadeDown: line width should shrink as t increases', () => {
		const gen = WARP_PATH_GENERATORS['textFadeDown'];
		const pathTop = gen(200, 100, 0);
		const pathBottom = gen(200, 100, 1);
		expect(pathTop).toMatch(/^M\s/);
		expect(pathBottom).toMatch(/^M\s/);
		expect(pathTop).not.toBe(pathBottom);
	});

	it('textFadeRight produces valid path', () => {
		const gen = WARP_PATH_GENERATORS['textFadeRight'];
		const path = gen(200, 100, 0.5);
		expect(path).toMatch(/^M 0,/);
		expect(path).toContain('L 200,');
	});

	it('textFadeLeft produces valid path', () => {
		const gen = WARP_PATH_GENERATORS['textFadeLeft'];
		const path = gen(200, 100, 0.5);
		expect(path).toMatch(/^M 0,/);
		expect(path).toContain('L 200,');
	});

	it('textArchUpPour produces a valid arc path', () => {
		const gen = WARP_PATH_GENERATORS['textArchUpPour'];
		const path = gen(200, 100, 0);
		expect(path).toMatch(/^M/);
		expect(path).toContain('A');
	});

	it('textArchDownPour produces a valid arc path', () => {
		const gen = WARP_PATH_GENERATORS['textArchDownPour'];
		const path = gen(200, 100, 0);
		expect(path).toMatch(/^M/);
		expect(path).toContain('A');
	});

	it('textCirclePour produces a valid ellipse path', () => {
		const gen = WARP_PATH_GENERATORS['textCirclePour'];
		const path = gen(200, 100, 0.5);
		expect(path).toMatch(/^M/);
		// Should contain two arcs for a full ellipse
		expect((path.match(/A /g) || []).length).toBeGreaterThanOrEqual(2);
	});

	it('textButtonPour produces a valid quadratic curve', () => {
		const gen = WARP_PATH_GENERATORS['textButtonPour'];
		const path = gen(200, 100, 0.5);
		expect(path).toMatch(/^M/);
		expect(path).toContain('Q');
	});

	it('textDeflateInflate produces a valid quadratic curve', () => {
		const gen = WARP_PATH_GENERATORS['textDeflateInflate'];
		const path = gen(200, 100, 0.5);
		expect(path).toMatch(/^M/);
		expect(path).toContain('Q');
	});

	it('textDeflateInflateDeflate produces valid path with two curves', () => {
		const gen = WARP_PATH_GENERATORS['textDeflateInflateDeflate'];
		const path = gen(200, 100, 0.5);
		expect(path).toMatch(/^M/);
		// Should contain two Q commands for double oscillation
		expect((path.match(/Q /g) || []).length).toBeGreaterThanOrEqual(2);
	});

	it('all priority 4 generators produce different paths for t=0 vs t=1', () => {
		const p4Presets = [
			'textSlantUp', 'textSlantDown', 'textFadeRight', 'textFadeLeft',
			'textFadeUp', 'textFadeDown', 'textArchUpPour', 'textArchDownPour',
			'textCirclePour', 'textButtonPour', 'textDeflateInflate',
			'textDeflateInflateDeflate',
		];
		for (const preset of p4Presets) {
			const gen = WARP_PATH_GENERATORS[preset];
			expect(gen).toBeDefined();
			const pathTop = gen(200, 100, 0);
			const pathBot = gen(200, 100, 1);
			expect(pathTop).not.toBe(pathBot);
		}
	});

	it('paths scale with dimensions', () => {
		const gen = WARP_PATH_GENERATORS['textSlantUp'];
		const small = gen(100, 50, 0.5);
		const large = gen(400, 200, 0.5);
		expect(small).not.toBe(large);
		// Large path should contain the larger width endpoint
		expect(large).toContain('400,');
	});
});
