/**
 * Unit tests for SVG warp path generators.
 *
 * Angular port of the React warp-path generator logic;
 * mirrors the preset catalogue and asserts deterministic path shapes.
 */
import { describe, expect, it } from 'vitest';

import {
	getWarpPath,
	shouldUseSvgWarp,
	SVG_WARP_PRESETS,
	WARP_PATH_GENERATORS,
} from './warp-path-generators';

// ── shouldUseSvgWarp ────────────────────────────────────────────────────

describe('shouldUseSvgWarp', () => {
	it('returns false for undefined', () => {
		expect(shouldUseSvgWarp(undefined)).toBeFalsy();
	});

	it('returns false for textNoShape and textPlain', () => {
		expect(shouldUseSvgWarp('textNoShape')).toBeFalsy();
		expect(shouldUseSvgWarp('textPlain')).toBeFalsy();
	});

	it('returns true for all SVG_WARP_PRESETS members', () => {
		for (const preset of SVG_WARP_PRESETS) {
			expect(shouldUseSvgWarp(preset), `preset: ${preset}`).toBeTruthy();
		}
	});

	it('returns false for unknown preset string', () => {
		expect(shouldUseSvgWarp('textUnknownXyz')).toBeFalsy();
	});
});

// ── getWarpPath: path structure ────────────────────────────────────────

describe('getWarpPath', () => {
	const W = 400;
	const H = 200;

	it('returns a fallback line for an unknown preset', () => {
		const d = getWarpPath('textUnknownXyz', W, H, 0, 1);
		expect(d).toMatch(/^M 0,/u);
		expect(d).toContain('L 400,');
	});

	it('textArchUp starts with M 0,<h> and contains an arc', () => {
		const d = getWarpPath('textArchUp', W, H, 0, 1);
		expect(d).toMatch(/^M 0,200/u);
		expect(d).toContain('A ');
	});

	it('textArchDown starts with M 0,0 and contains an arc for t>0', () => {
		// At lineIndex 0, lineCount 2 → t = 0 → baseDepth gives a small archH
		const d = getWarpPath('textArchDown', W, H, 1, 2);
		expect(d).toMatch(/^M 0,0/u);
		expect(d).toContain('A ');
	});

	it('textCircle produces a two-arc closed path (M … A … A …)', () => {
		const d = getWarpPath('textCircle', W, H, 0, 1);
		const aCount = (d.match(/\bA\b/gu) ?? []).length;
		expect(aCount).toBe(2);
	});

	it('textWave1 produces a cubic Bézier path (C)', () => {
		const d = getWarpPath('textWave1', W, H, 0, 1);
		expect(d).toContain('C ');
	});

	it('textWave4 produces two cubic Bézier segments', () => {
		const d = getWarpPath('textWave4', W, H, 0, 1);
		const cCount = (d.match(/\bC\b/gu) ?? []).length;
		expect(cCount).toBe(2);
	});

	it('textInflate produces a quadratic Bézier path (Q)', () => {
		const d = getWarpPath('textInflate', W, H, 0, 2);
		expect(d).toContain('Q ');
	});

	it('textChevron produces a two-segment polyline (L … L …)', () => {
		const d = getWarpPath('textChevron', W, H, 0, 1);
		const lCount = (d.match(/\bL\b/gu) ?? []).length;
		expect(lCount).toBe(2);
	});

	it('textTriangle produces a single line segment (one L)', () => {
		const d = getWarpPath('textTriangle', W, H, 0.5, 1);
		const lCount = (d.match(/\bL\b/gu) ?? []).length;
		expect(lCount).toBe(1);
	});

	it('textCascadeUp produces a diagonal line (M … L)', () => {
		const d = getWarpPath('textCascadeUp', W, H, 0, 2);
		expect(d).toMatch(/^M 0,/u);
		expect(d).toContain('L 400,');
		// y values should differ (diagonal)
		const yStart = d.match(/^M 0,(?<y>[0-9.]+)/u)?.groups?.['y'];
		const yEnd = d.match(/L 400,(?<y>[0-9.]+)/u)?.groups?.['y'];
		expect(Number(yStart)).not.toBeCloseTo(Number(yEnd), 5);
	});

	it('textCascadeDown produces a diagonal in the opposite direction to cascadeUp', () => {
		const dUp = getWarpPath('textCascadeUp', W, H, 0, 2);
		const dDown = getWarpPath('textCascadeDown', W, H, 0, 2);
		const yStartUp = Number(dUp.match(/^M 0,(?<y>[0-9.]+)/u)?.groups?.['y']);
		const yEndUp = Number(dUp.match(/L 400,(?<y>[0-9.]+)/u)?.groups?.['y']);
		const yStartDown = Number(dDown.match(/^M 0,(?<y>[0-9.]+)/u)?.groups?.['y']);
		const yEndDown = Number(dDown.match(/L 400,(?<y>[0-9.]+)/u)?.groups?.['y']);
		// cascadeUp: yStart > yEnd; cascadeDown: yStart < yEnd
		expect(yStartUp).toBeGreaterThan(yEndUp);
		expect(yStartDown).toBeLessThan(yEndDown);
	});

	it('single-line (lineCount=1) uses t=0.5', () => {
		// For textArchUp at t=0.5, archH = h*(0.85-0.5*0.7) = h*0.5 > 0 → arc form
		const d = getWarpPath('textArchUp', W, H, 0, 1);
		expect(d).toContain('A ');
		expect(d).not.toBe(`M 0,${H} L ${W},${H}`);
	});

	it('covers all WARP_PATH_GENERATORS without throwing', () => {
		for (const preset of Object.keys(WARP_PATH_GENERATORS)) {
			expect(() => getWarpPath(preset, W, H, 0, 1)).not.toThrow();
		}
	});

	it('adj parameter scales archUp arch height', () => {
		// Higher adj → larger arch (for t=0)
		const dDefault = getWarpPath('textArchUp', W, H, 0, 1, 10800000);
		const dTaller = getWarpPath('textArchUp', W, H, 0, 1, 21600000);
		// Both should be arcs; taller has larger ry
		const ryDefault = Number(dDefault.match(/A [0-9.]+,(?<ry>[0-9.]+)/u)?.groups?.['ry']);
		const ryTaller = Number(dTaller.match(/A [0-9.]+,(?<ry>[0-9.]+)/u)?.groups?.['ry']);
		expect(ryTaller).toBeGreaterThanOrEqual(ryDefault);
	});
});
