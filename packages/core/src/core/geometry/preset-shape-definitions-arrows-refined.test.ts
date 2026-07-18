/**
 * Structural tests for the refined arrow preset definitions.
 *
 * These guard against the simplified silhouettes regressing back into
 * `preset-shape-definitions-arrows-refined.ts`:
 *   - every refined entry must declare a non-trivial `gdLst` (≥ 8 guides)
 *     since the simplified versions used 4-9 guides only;
 *   - `pathLst` must use at least one curved primitive (`arcTo`,
 *     `cubicBezTo`, or `quadBezTo`) — the simplified versions degraded
 *     to straight `lnTo` polygons for several shapes;
 *   - every guide formula must be a plain string with at least one
 *     non-whitespace token (no placeholders like `TODO` or `'…'`);
 *   - all formula operators must come from the canonical OOXML set so
 *     the evaluator does not silently degrade to `0`.
 */

import { describe, expect, it } from 'vitest';

import { REFINED_ARROW_PRESET_DEFINITIONS } from './preset-shape-definitions-arrows-refined';

const REQUIRED_REFINEMENTS = [
	'bentArrow',
	'bentUpArrow',
	'uturnArrow',
	'circularArrow',
	'leftCircularArrow',
	'leftRightCircularArrow',
	'swooshArrow',
] as const;

const KNOWN_OPS = new Set([
	'val',
	'abs',
	'sqrt',
	'+-',
	'*/',
	'+/',
	'?:',
	'if',
	'min',
	'max',
	'mod',
	'pin',
	'sin',
	'cos',
	'tan',
	'atan',
	'at2',
	'atan2',
	'cat2',
	'sat2',
]);

const PLACEHOLDER_PATTERNS = [/TODO/i, /FIXME/i, /SIMPLIFIED/i, /placeholder/i, /…/];

describe('refined arrow preset definitions', () => {
	it('contains all 7 refined shapes', () => {
		for (const name of REQUIRED_REFINEMENTS) {
			expect(
				REFINED_ARROW_PRESET_DEFINITIONS[name],
				`missing refined preset ${name}`,
			).toBeDefined();
		}
		expect(Object.keys(REFINED_ARROW_PRESET_DEFINITIONS)).toHaveLength(REQUIRED_REFINEMENTS.length);
	});

	it.each(REQUIRED_REFINEMENTS)(
		'%s has a non-trivial gdLst with at least 8 guides',
		(shapeName) => {
			const shape = REFINED_ARROW_PRESET_DEFINITIONS[shapeName];
			expect(shape).toBeDefined();
			expect(shape!.gdLst).toBeDefined();
			// The simplified versions topped out at ~9 guides; the canonical
			// formulas need >= 8 guides to wire the head and tangent points.
			expect(shape!.gdLst!.length).toBeGreaterThanOrEqual(8);
		},
	);

	it.each(REQUIRED_REFINEMENTS)('%s has no placeholder formulas', (shapeName) => {
		const shape = REFINED_ARROW_PRESET_DEFINITIONS[shapeName];
		for (const guide of shape!.gdLst ?? []) {
			expect(guide.formula).toBeTypeOf('string');
			expect(guide.formula.trim().length).toBeGreaterThan(0);
			for (const pattern of PLACEHOLDER_PATTERNS) {
				expect(guide.formula).not.toMatch(pattern);
			}
		}
	});

	// Shapes whose canonical ECMA-376 pathLst dictates curved primitives.
	// (`bentUpArrow` is a true polygon in the spec — sharp 90° corners
	// throughout — so it is intentionally exempt.)
	const SHAPES_REQUIRING_CURVES = REQUIRED_REFINEMENTS.filter((n) => n !== 'bentUpArrow');

	it.each(SHAPES_REQUIRING_CURVES)(
		'%s pathLst uses at least one curved primitive (arcTo / cubicBezTo / quadBezTo)',
		(shapeName) => {
			const shape = REFINED_ARROW_PRESET_DEFINITIONS[shapeName];
			const allCommands = shape!.pathLst.flatMap((p) => p.commands);
			const hasCurve = allCommands.some(
				(c) => c.kind === 'arcTo' || c.kind === 'cubicBezTo' || c.kind === 'quadBezTo',
			);
			expect(hasCurve, `${shapeName} should not be a pure lnTo polygon`).toBeTruthy();
		},
	);

	it.each(REQUIRED_REFINEMENTS)(
		'%s guide operators are all known to the evaluator',
		(shapeName) => {
			const shape = REFINED_ARROW_PRESET_DEFINITIONS[shapeName];
			for (const guide of shape!.gdLst ?? []) {
				const op = guide.formula.trim().split(/\s+/)[0];
				// Numeric literals are also fine — accept any token that parses to
				// a finite number even if it's not in KNOWN_OPS.
				const numeric = Number.isFinite(Number(op));
				expect(
					numeric || KNOWN_OPS.has(op!),
					`${shapeName} guide ${guide.name} uses unknown op '${op}'`,
				).toBeTruthy();
				// args mirror the formula tokens (everything after the op)
				expect(guide.args).toStrictEqual(guide.formula.trim().split(/\s+/).slice(1));
			}
		},
	);

	it.each(REQUIRED_REFINEMENTS)('%s declares avLst defaults', (shapeName) => {
		const shape = REFINED_ARROW_PRESET_DEFINITIONS[shapeName];
		expect(shape!.avLst).toBeDefined();
		expect(Object.keys(shape!.avLst!).length).toBeGreaterThan(0);
	});

	it('preserves shape names matching their map keys', () => {
		for (const [key, shape] of Object.entries(REFINED_ARROW_PRESET_DEFINITIONS)) {
			expect(shape.name).toBe(key);
		}
	});
});
