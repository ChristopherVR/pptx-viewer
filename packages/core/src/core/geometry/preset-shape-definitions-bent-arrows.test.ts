/**
 * Geometry correctness tests for the exact bent-arrow transcriptions
 * (`bentArrow`, `bentUpArrow`, `uturnArrow`) in
 * `preset-shape-definitions-arrows-refined.ts`.
 *
 * Unlike the structural guard in `preset-shape-definitions-arrows-refined.test.ts`,
 * these evaluate the shapes to real SVG paths and assert that non-default
 * `avLst` adjustments actually move the geometry, and that specific spec
 * guide values land where ISO/IEC 29500-1 §20.1.10.55 says they should.
 */

import { describe, expect, it } from 'vitest';

import { evaluatePresetShape } from './preset-shape-evaluator';

/** Pull every numeric coordinate out of an evaluated SVG path string. */
function coords(path: string): number[] {
	return (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

describe('bent arrow preset geometry', () => {
	it('bentUpArrow head length (adj3) moves the shoulder line', () => {
		const W = 400;
		const H = 400;
		// y1 = ss * a3 / 100000, ss = min(w,h) = 400. Default adj3=25000 -> y1=100.
		const def = evaluatePresetShape('bentUpArrow', W, H);
		const tall = evaluatePresetShape('bentUpArrow', W, H, { adj3: 50000 });
		expect(def).toBeDefined();
		expect(tall).toBeDefined();
		expect(def!.svgPath).not.toBe(tall!.svgPath);
		// y1 for adj3=50000 is 200; the shoulder y should appear in the path.
		expect(coords(tall!.svgPath)).toContain(200);
		// and the default 100 should not be the shoulder for the tall variant.
		expect(coords(def!.svgPath)).toContain(100);
	});

	it('bentUpArrow tip apex tracks the right edge and head width', () => {
		const W = 400;
		const H = 400;
		// x3 = r - ss*a2/100000; default a2=25000 -> x3 = 400 - 100 = 300, tip at (x3, t).
		const result = evaluatePresetShape('bentUpArrow', W, H);
		expect(coords(result!.svgPath)).toContain(300);
		const wide = evaluatePresetShape('bentUpArrow', W, H, { adj2: 50000 });
		// a2=50000 -> x3 = 400 - 200 = 200.
		expect(coords(wide!.svgPath)).toContain(200);
	});

	it('bentArrow honours the knee-radius adjustment (adj4)', () => {
		const def = evaluatePresetShape('bentArrow', 400, 400);
		const sharper = evaluatePresetShape('bentArrow', 400, 400, { adj4: 0 });
		const rounder = evaluatePresetShape('bentArrow', 400, 400, { adj4: 100000 });
		expect(def!.svgPath).not.toBe(sharper!.svgPath);
		expect(def!.svgPath).not.toBe(rounder!.svgPath);
		// The knee is drawn with an elliptical arc; a valid path keeps arc segments.
		expect(def!.svgPath).toMatch(/[Aa]\s/);
	});

	it('bentArrow head width (adj2) changes the arrowhead span', () => {
		const narrow = evaluatePresetShape('bentArrow', 400, 400, { adj2: 12500 });
		const wide = evaluatePresetShape('bentArrow', 400, 400, { adj2: 50000 });
		expect(narrow!.svgPath).not.toBe(wide!.svgPath);
	});

	it('uturnArrow right-leg extent (adj5) and body (adj1) both move geometry', () => {
		const def = evaluatePresetShape('uturnArrow', 400, 400);
		const shortLeg = evaluatePresetShape('uturnArrow', 400, 400, { adj5: 50000 });
		const thick = evaluatePresetShape('uturnArrow', 400, 400, { adj1: 20000 });
		expect(def).toBeDefined();
		expect(def!.svgPath).not.toBe(shortLeg!.svgPath);
		expect(def!.svgPath).not.toBe(thick!.svgPath);
		// The two rounded bends keep the path curved rather than a bare polygon.
		expect(def!.svgPath).toMatch(/[Aa]\s/);
	});

	it.each(['bentArrow', 'bentUpArrow', 'uturnArrow'])(
		'%s produces a finite, closed path at defaults',
		(name) => {
			const result = evaluatePresetShape(name, 320, 240);
			expect(result).toBeDefined();
			expect(result!.svgPath.trim().length).toBeGreaterThan(0);
			expect(coords(result!.svgPath).every(Number.isFinite)).toBeTruthy();
			expect(result!.svgPath.trimEnd().endsWith('Z')).toBeTruthy();
		},
	);
});
