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
