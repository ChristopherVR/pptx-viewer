/**
 * `preset-avlst-fmla` - evaluate a non-literal `a:gd/@fmla` adjustment value on
 * a preset shape's `a:avLst`, reusing the shared guide-formula engine.
 *
 * Preset adjustment guides are usually literal (`val N`), which the fast path in
 * `parseGeometryAdjustments` handles directly. Some decks author non-literal
 * adjustment formulas (e.g. `*\/ 100000 1 2`, `+- 50000 10000 20000`,
 * `pin 0 60000 100000`, or one adjustment derived from an earlier one). This
 * helper evaluates the forms that do NOT require the shape's geometry
 * (width/height), which is unavailable at avLst-parse time.
 *
 * Geometry-dependent formulas (those referencing `w`, `h`, `hc`, `vc`, `r`, `b`,
 * `wd*`, `hd*`, `ss`, `ls`, `ssd*`) and formulas referencing guides defined
 * outside the `a:avLst` are deferred: this helper returns `undefined` for them
 * so the caller leaves the adjustment unresolved. They still resolve later
 * during render-time guide evaluation, where the shape's `w`/`h` are known.
 *
 * @module preset-avlst-fmla
 */

import { evaluateGuides } from '../../geometry/guide-formula';

/**
 * Built-in variable names whose value does NOT depend on the shape's width or
 * height, so a formula referencing only these (plus literals and prior
 * adjustments) can be resolved without a geometry context:
 * - `l` / `t`: the left/top edge, always `0`.
 * - Angular constants (OOXML 60,000ths of a degree): fixed regardless of size.
 *
 * Every other built-in (`w`, `h`, `hc`, `vc`, `r`, `b`, `wd*`, `hd*`, `ss`,
 * `ls`, `ssd*`) is geometry-dependent and forces a defer.
 */
const GEOMETRY_INDEPENDENT_VARS: ReadonlySet<string> = new Set<string>([
	'l',
	't',
	'cd2',
	'cd4',
	'cd8',
	'3cd4',
	'3cd8',
	'5cd8',
	'7cd8',
]);

/**
 * Evaluate a preset `a:avLst` adjustment formula that is not a literal `val N`.
 *
 * @param formula - The raw `@_fmla` string (already known not to be `val N`).
 * @param name - The adjustment guide name being defined.
 * @param priorAdjustments - Adjustments resolved earlier in the same `a:avLst`,
 *   which a later formula may reference by name.
 * @returns The evaluated numeric value, or `undefined` when the formula needs a
 *   geometry context (deferred) or does not resolve to a finite number.
 */
export function evaluatePresetAdjustmentFormula(
	formula: string,
	name: string,
	priorAdjustments: ReadonlyMap<string, number>,
): number | undefined {
	const trimmed = formula.trim();
	if (!trimmed) {
		return undefined;
	}

	const tokens = trimmed.split(/\s+/);
	// tokens[0] is the operator mnemonic; operands follow. Only operands can
	// carry a variable reference that would require geometry.
	for (let i = 1; i < tokens.length; i++) {
		const token = tokens[i];
		if (token === '') {
			continue;
		}
		if (Number.isFinite(Number(token))) {
			continue; // numeric literal
		}
		if (priorAdjustments.has(token)) {
			continue; // an earlier avLst adjustment
		}
		if (GEOMETRY_INDEPENDENT_VARS.has(token)) {
			continue; // constant built-in
		}
		// Geometry-dependent built-in or externally-defined guide: cannot resolve
		// here without the shape's width/height. Defer to render-time evaluation.
		return undefined;
	}

	// Seed the engine with a zeroed geometry context; the token gate above
	// guarantees the formula never depends on `w`/`h`, so the zeros are inert.
	const vars = evaluateGuides(
		[{ name, formula: trimmed }],
		{ w: 0, h: 0 },
		new Map<string, number>(priorAdjustments),
	);
	const value = vars.get(name);
	return value !== undefined && Number.isFinite(value) ? value : undefined;
}
