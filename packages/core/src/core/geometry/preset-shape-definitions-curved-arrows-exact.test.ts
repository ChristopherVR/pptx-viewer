/**
 * Behavioural tests for the spec-exact curved-arrow preset definitions.
 *
 * Unlike the earlier structural guards (which only checked that a `gdLst`
 * existed), these evaluate the geometry through `evaluatePresetShape` and
 * assert:
 *   - the path is finite (no `NaN` / `Infinity` leaking from the guide chain);
 *   - the path RESPONDS to non-default adjustment values (body thickness
 *     `adj1`, head width `adj2`, head length `adj3`), which the previous
 *     default-adjustment silhouettes did not; and
 *   - concrete absolute landmarks (the arrowhead tip reaches the correct
 *     bounding-box edge), proving the transcription is not merely "different"
 *     but geometrically placed where ECMA-376 requires.
 */

import { describe, expect, it } from 'vitest';

import { EXACT_CURVED_ARROW_PRESET_DEFINITIONS } from './preset-shape-definitions-curved-arrows-exact';
import { evaluatePresetShape } from './preset-shape-evaluator';

const SHAPES = ['curvedRightArrow', 'curvedLeftArrow', 'curvedUpArrow', 'curvedDownArrow'] as const;

const W = 200;
const H = 120;

// Number of numeric parameters each emitted SVG command carries. The final two
// are always the endpoint (x, y); arcs are emitted as "A rx ry 0 laf sf x y".
const ARITY: Record<string, number> = { M: 2, L: 2, Q: 4, C: 6, A: 7, Z: 0 };

/** Walk an SVG path and collect the endpoint (x, y) of every draw command. */
function endpoints(svg: string): Array<[number, number]> {
	const tokens = svg.trim().split(/\s+/);
	const points: Array<[number, number]> = [];
	let i = 0;
	while (i < tokens.length) {
		const cmd = tokens[i++]!;
		const arity = ARITY[cmd];
		if (arity === undefined) {
			continue;
		}
		const nums = tokens.slice(i, i + arity).map(Number);
		i += arity;
		if (arity >= 2) {
			points.push([nums[arity - 2]!, nums[arity - 1]!]);
		}
	}
	return points;
}

function bounds(svg: string): { minX: number; maxX: number; minY: number; maxY: number } {
	const pts = endpoints(svg);
	const xs = pts.map((p) => p[0]);
	const ys = pts.map((p) => p[1]);
	return {
		minX: Math.min(...xs),
		maxX: Math.max(...xs),
		minY: Math.min(...ys),
		maxY: Math.max(...ys),
	};
}

describe('spec-exact curved arrows', () => {
	it('registers exactly the four curved arrows with matching keys', () => {
		expect(Object.keys(EXACT_CURVED_ARROW_PRESET_DEFINITIONS)).toStrictEqual([...SHAPES]);
		for (const [key, def] of Object.entries(EXACT_CURVED_ARROW_PRESET_DEFINITIONS)) {
			expect(def.name).toBe(key);
			expect(def.avLst).toStrictEqual({ adj1: 25000, adj2: 50000, adj3: 25000 });
		}
	});

	it('carries the verbatim spec guide chain (>= 40 guides, three sub-paths)', () => {
		for (const name of SHAPES) {
			const def = EXACT_CURVED_ARROW_PRESET_DEFINITIONS[name]!;
			expect(def.gdLst!.length).toBeGreaterThanOrEqual(40);
			// fill silhouette, darkenLess shade, and the fill:'none' outline.
			expect(def.pathLst).toHaveLength(3);
			expect(def.pathLst.some((p) => p.fill === 'darkenLess')).toBeTruthy();
			expect(def.pathLst.some((p) => p.fill === 'none')).toBeTruthy();
			expect(def.pathLst.flatMap((p) => p.commands).some((c) => c.kind === 'arcTo')).toBeTruthy();
		}
	});

	it.each(SHAPES)('%s evaluates to a finite path within its bounding box', (name) => {
		const result = evaluatePresetShape(name, W, H);
		expect(result).toBeDefined();
		expect(/NaN|Infinity/.test(result!.svgPath)).toBeFalsy();
		const b = bounds(result!.svgPath);
		// Curved arrows fill their bounding box; the full-radius arcs authored by
		// ECMA-376 can overshoot the b/r edge by ~1-2px, so allow a 3px margin
		// (still far tighter than the parsing-bug values of ~197 this guards).
		expect(b.minX).toBeGreaterThanOrEqual(-3);
		expect(b.maxX).toBeLessThanOrEqual(W + 3);
		expect(b.minY).toBeGreaterThanOrEqual(-3);
		expect(b.maxY).toBeLessThanOrEqual(H + 3);
	});

	it.each(SHAPES)('%s responds to body thickness (adj1) and head length (adj3)', (name) => {
		const base = evaluatePresetShape(name, W, H)!.svgPath;
		const thick = evaluatePresetShape(name, W, H, { adj1: 12500 })!.svgPath;
		const head = evaluatePresetShape(name, W, H, { adj3: 5000 })!.svgPath;
		const width = evaluatePresetShape(name, W, H, { adj2: 30000 })!.svgPath;
		expect(thick, 'adj1 must change the geometry').not.toBe(base);
		expect(head, 'adj3 must change the geometry').not.toBe(base);
		expect(width, 'adj2 must change the geometry').not.toBe(base);
	});

	// Each arrow's head points toward one bounding-box edge; the tip must reach
	// that edge (within a small full-radius-arc overshoot margin).
	it('curvedRightArrow head tip reaches the right edge', () => {
		const base = evaluatePresetShape('curvedRightArrow', W, H)!.svgPath;
		const b = bounds(base);
		expect(b.maxX).toBeGreaterThanOrEqual(W - 1);
		expect(b.maxX).toBeLessThanOrEqual(W + 3);
		expect(evaluatePresetShape('curvedRightArrow', W, H, { adj3: 5000 })!.svgPath).not.toBe(base);
	});

	it('curvedDownArrow head tip reaches the bottom edge', () => {
		expect(
			bounds(evaluatePresetShape('curvedDownArrow', W, H)!.svgPath).maxY,
		).toBeGreaterThanOrEqual(H - 1);
	});

	it('curvedUpArrow head tip reaches the top edge', () => {
		expect(bounds(evaluatePresetShape('curvedUpArrow', W, H)!.svgPath).minY).toBeLessThanOrEqual(1);
	});

	it('curvedLeftArrow head tip reaches the left edge', () => {
		expect(bounds(evaluatePresetShape('curvedLeftArrow', W, H)!.svgPath).minX).toBeLessThanOrEqual(
			1,
		);
	});
});
