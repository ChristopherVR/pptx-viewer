/**
 * Guards for the `ST_ShapeType` enumeration, the alias table, and the preset
 * geometry table's coverage of the spec.
 *
 * Two invariants matter here:
 *  - nothing outside the closed 187-value enumeration may reach
 *    `a:prstGeom/@prst` (an unknown token makes the package schema-invalid);
 *  - every spec preset must be present in `PRESET_SHAPE_GEOMETRY_TABLE`, or it
 *    silently degrades to the adjustment-blind polygon fallback in
 *    `preset-shape-clip-paths.ts`.
 */

import { describe, expect, it } from 'vitest';

import {
	PRESET_GEOMETRY_ALIASES,
	ST_SHAPE_TYPE_VALUES,
	isStShapeType,
	normalizeStShapeType,
} from './preset-geometry-names';
import { PRESET_SHAPE_GEOMETRY_TABLE } from './preset-shape-definitions-table';
import { evaluatePresetShape } from './preset-shape-evaluator';

describe('sT_ShapeType enumeration', () => {
	it('has exactly 187 unique values', () => {
		expect(ST_SHAPE_TYPE_VALUES).toHaveLength(187);
		expect(new Set(ST_SHAPE_TYPE_VALUES).size).toBe(187);
	});

	it('recognises spec names and rejects everything else', () => {
		expect(isStShapeType('rtTriangle')).toBeTruthy();
		expect(isStShapeType('flowChartInputOutput')).toBeTruthy();
		expect(isStShapeType('rightTriangle')).toBeFalsy();
		expect(isStShapeType('cylinder')).toBeFalsy();
		expect(isStShapeType(undefined)).toBeFalsy();
	});
});

describe('normalizeStShapeType', () => {
	it('passes canonical names through untouched', () => {
		for (const name of ST_SHAPE_TYPE_VALUES) {
			expect(normalizeStShapeType(name)).toBe(name);
		}
	});

	it('folds casing variants onto the canonical spelling', () => {
		expect(normalizeStShapeType('roundrect')).toBe('roundRect');
		expect(normalizeStShapeType('ROUNDRECT')).toBe('roundRect');
		expect(normalizeStShapeType('  ellipse  ')).toBe('ellipse');
	});

	it('resolves every alias to a real ST_ShapeType value', () => {
		for (const [alias, canonical] of Object.entries(PRESET_GEOMETRY_ALIASES)) {
			expect(isStShapeType(canonical), `alias target ${canonical}`).toBeTruthy();
			expect(normalizeStShapeType(alias), `alias ${alias}`).toBe(canonical);
		}
	});

	it('returns undefined for identifiers that are not presets at all', () => {
		expect(normalizeStShapeType('custom_shape')).toBeUndefined();
		expect(normalizeStShapeType('')).toBeUndefined();
		expect(normalizeStShapeType(undefined)).toBeUndefined();
	});

	// Every key the geometry table can be looked up by must be nameable in
	// OOXML, otherwise a shape rendered from that entry cannot be saved.
	// `mathFunction` is the single documented exception: an invented preset
	// with no honest ECMA equivalent, so it degrades to `rect` on save.
	const RENDER_ONLY_TABLE_KEYS = new Set(['mathFunction']);

	it('can name every PRESET_SHAPE_GEOMETRY_TABLE key in OOXML', () => {
		const unnameable: string[] = [];
		for (const key of Object.keys(PRESET_SHAPE_GEOMETRY_TABLE)) {
			const canonical = normalizeStShapeType(key);
			if (canonical === undefined) {
				unnameable.push(key);
				continue;
			}
			expect(isStShapeType(canonical), `${key} -> ${canonical}`).toBeTruthy();
		}
		expect(unnameable).toStrictEqual([...RENDER_ONLY_TABLE_KEYS]);
	});
});

describe('preset geometry table coverage', () => {
	it('carries an evaluated definition for all 187 ST_ShapeType presets', () => {
		const missing = ST_SHAPE_TYPE_VALUES.filter(
			(name) => PRESET_SHAPE_GEOMETRY_TABLE[name] === undefined,
		);
		expect(missing, `missing preset geometry: ${missing.join(', ')}`).toStrictEqual([]);
	});

	// The six that were missing before this batch. They fell through the
	// shape-geometry cascade to the static polygon table, so they rendered as
	// adjustment-blind approximations rather than spec geometry.
	const NEWLY_COVERED = [
		'cloudCallout',
		'flowChartInputOutput',
		'flowChartOfflineStorage',
		'chartX',
		'chartStar',
		'chartPlus',
	] as const;

	it.each(NEWLY_COVERED)('%s evaluates to a finite, non-empty path', (name) => {
		const result = evaluatePresetShape(name, 200, 120);
		expect(result).toBeDefined();
		expect(result!.svgPath.length).toBeGreaterThan(0);
		expect(/NaN|Infinity/.test(result!.svgPath)).toBeFalsy();
	});

	it('cloudCallout honours its adj1 / adj2 tail placement', () => {
		const base = evaluatePresetShape('cloudCallout', 200, 120)!.svgPath;
		const moved = evaluatePresetShape('cloudCallout', 200, 120, {
			adj1: 30000,
			adj2: -40000,
		})!.svgPath;
		expect(moved).not.toBe(base);
		// Spec defaults put the tail below-left of the centre; adj1 > 0 and
		// adj2 < 0 must move the first tail bubble above-right of it.
		const firstBubble = (svg: string): [number, number] => {
			// The cloud body is sub-path 1; sub-path 2 starts at the tail bubble.
			const moves = [...svg.matchAll(/M (-?[\d.]+) (-?[\d.]+)/g)];
			return [Number(moves[1]![1]), Number(moves[1]![2])];
		};
		const [bx, by] = firstBubble(base);
		const [mx, my] = firstBubble(moved);
		expect(mx).toBeGreaterThan(bx);
		expect(my).toBeLessThan(by);
	});

	it('flowChartInputOutput is the spec parallelogram, slanted by w/5', () => {
		const result = evaluatePresetShape('flowChartInputOutput', 200, 120)!;
		expect(result.svgPath).toBe('M 0 120 L 40 0 L 200 0 L 160 120 Z');
		// `<rect l="wd5" t="t" r="x5" b="b"/>`: text is inset to the straight part.
		expect(result.textRect).toStrictEqual({ l: 40, t: 0, r: 160, b: 120 });
	});

	it('flowChartOfflineStorage draws the triangle plus its rule', () => {
		const result = evaluatePresetShape('flowChartOfflineStorage', 200, 120)!;
		// Filled triangle (2x2 space), the stroke-only rule (5x5 space), outline.
		expect(result.paths).toHaveLength(3);
		expect(result.paths[0]!.stroke).toBeFalsy();
		expect(result.paths[1]!.fill).toBe('none');
		expect(result.paths[1]!.d).toBe('M 80 96 L 120 96');
	});

	it.each(['chartX', 'chartStar', 'chartPlus'])(
		'%s pairs a stroke-only glyph with a fill square',
		(name) => {
			const result = evaluatePresetShape(name, 200, 120)!;
			expect(result.paths).toHaveLength(2);
			expect(result.paths[0]!.fill).toBe('none');
			expect(result.paths[1]!.stroke).toBeFalsy();
			// Mixed fill/none must NOT be reported as a stroke-only geometry.
			expect(result.fillNone).toBeFalsy();
		},
	);
});
