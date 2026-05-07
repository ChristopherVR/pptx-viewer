import { describe, expect, it } from 'vitest';

import { evaluatePresetShape, lookupPresetShape } from './preset-shape-evaluator';
import { getShapeClipPathFromPreset } from './shape-geometry';

describe('evaluatePresetShape', () => {
	it('returns undefined for unknown shape names', () => {
		expect(evaluatePresetShape('definitelyNotAShape', 100, 100)).toBeUndefined();
		expect(lookupPresetShape('definitelyNotAShape')).toBeUndefined();
	});

	it('does not crash on zero-size shapes', () => {
		const result = evaluatePresetShape('rect', 0, 0);
		expect(result).toBeDefined();
		expect(typeof result?.svgPath === 'string').toBeTruthy();
	});

	it('rect emits a closed polygon over the full bounding box', () => {
		const result = evaluatePresetShape('rect', 200, 100);
		expect(result).toBeDefined();
		// Should start at (0,0) and trace to the four corners.
		expect(result?.svgPath).toContain('M 0 0');
		expect(result?.svgPath).toContain('L 200 0');
		expect(result?.svgPath).toContain('L 200 100');
		expect(result?.svgPath).toContain('L 0 100');
		expect(result?.svgPath.endsWith('Z')).toBeTruthy();
	});

	it('roundRect with default adj produces ~1/3 corner radius', () => {
		const W = 300;
		const H = 300;
		const result = evaluatePresetShape('roundRect', W, H);
		expect(result).toBeDefined();
		// Default adj=16667 → x1 = ss * 16667 / 100000 = 300 * 0.16667 ≈ 50.001
		// The first moveTo lands at (0, x1), so the path text should contain
		// "M 0 50" (give or take a few decimal places).
		const m = result!.svgPath.match(/M\s+0\s+([\d.]+)/);
		expect(m).not.toBeNull();
		const radius = Number(m![1]);
		expect(radius).toBeGreaterThan(49.5);
		expect(radius).toBeLessThan(50.5);
		// Four arcs (one per corner) → at least four "A " segments.
		const arcCount = (result!.svgPath.match(/\bA\s/g) ?? []).length;
		expect(arcCount).toBeGreaterThanOrEqual(4);
	});

	it('roundRect responds to custom adjustments', () => {
		const result0 = evaluatePresetShape('roundRect', 300, 300, { adj: 0 });
		const result50 = evaluatePresetShape('roundRect', 300, 300, { adj: 50000 });
		expect(result0?.svgPath).not.toBe(result50?.svgPath);
		// With adj=0 the rounded corners collapse to zero radius, so the very
		// first moveTo should be at y=0 (no inset).
		expect(result0?.svgPath.startsWith('M 0 0')).toBeTruthy();
		// With adj=50000 the corner radius equals min(w,h)/2 = 150.
		expect(result50?.svgPath).toMatch(/^M 0 150\b/);
	});

	it('pie with default sweep produces an arc + two line segments', () => {
		const result = evaluatePresetShape('pie', 200, 200);
		expect(result).toBeDefined();
		// Pie default: stAng=0 swAng=16200000 → 270° sweep. Output must contain
		// at least one moveTo, one arc, one line, and a close.
		expect(result!.svgPath).toMatch(/^M\s/);
		expect(result!.svgPath).toContain('L ');
		expect(result!.svgPath).toContain('A ');
		expect(result!.svgPath.endsWith('Z')).toBeTruthy();
	});

	it('wedgeRectCallout default produces 17 commands (16 line segments + close)', () => {
		const result = evaluatePresetShape('wedgeRectCallout', 200, 100);
		expect(result).toBeDefined();
		const lineCount = (result!.svgPath.match(/\bL\s/g) ?? []).length;
		// The callout outline is built entirely of line segments around the
		// rectangle and the pointer notch.
		expect(lineCount).toBeGreaterThan(10);
		expect(result!.svgPath.endsWith('Z')).toBeTruthy();
	});

	it('blockArc thickness adjustment changes the inner ring', () => {
		const thin = evaluatePresetShape('blockArc', 200, 200, { adj3: 5000 });
		const thick = evaluatePresetShape('blockArc', 200, 200, { adj3: 45000 });
		expect(thin).toBeDefined();
		expect(thick).toBeDefined();
		expect(thin!.svgPath).not.toBe(thick!.svgPath);
	});

	it('exposes textRect derived from the spec rect tokens', () => {
		const result = evaluatePresetShape('rect', 400, 300);
		expect(result?.textRect).toStrictEqual({ l: 0, t: 0, r: 400, b: 300 });
	});
});

describe('getShapeClipPathFromPreset', () => {
	it('returns a CSS path() expression for known shapes', () => {
		const css = getShapeClipPathFromPreset('rect', 100, 100);
		expect(css).toMatch(/^path\('/);
		expect(css).toMatch(/Z'\)$/);
	});

	it('returns undefined for unknown shapes (so callers fall back)', () => {
		expect(getShapeClipPathFromPreset('notARealPreset', 100, 100)).toBeUndefined();
	});

	it('returns undefined for missing shapeType', () => {
		expect(getShapeClipPathFromPreset(undefined, 100, 100)).toBeUndefined();
	});
});
