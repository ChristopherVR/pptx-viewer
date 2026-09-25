/**
 * Units and value assignment shared by constraint evaluation
 * (`constraint-eval.ts`) and font-relative length resolution
 * (`font-length.ts`).
 */

import type { EngineNode } from './engine-node';
import type { LdConstraint } from './layout-def-types';

export const POINTS_PER_MM = 72 / 25.4;

/** Constraint types that are lengths (literal values in millimetres). */
export const LENGTH_TYPES = new Set([
	'w',
	'h',
	'l',
	't',
	'r',
	'b',
	'ctrX',
	'ctrY',
	'lOff',
	'tOff',
	'rOff',
	'bOff',
	'ctrXOff',
	'ctrYOff',
	'wOff',
	'hOff',
	'sp',
	'sibSp',
	'secSibSp',
	'begPad',
	'endPad',
	'connDist',
	'bendDist',
	'diam',
	'stemThick',
]);

/**
 * Text-frame margins are POINTS, not millimetres (the font-size unit, so a
 * `refType="primFontSz"` margin is simply `fact x size`). Measured against
 * the cached drawings: a literal `rMarg val="20"` ("Increasing Arrows
 * Process") is a 20pt `rIns`, a literal `lMarg val="1"` ("Horizontal
 * Hierarchy") a 1pt `lIns`, and a length-referenced `tMarg refType="h"
 * fact="0.28"` ("Vertical Action List") is `0.28 x` the node's height
 * IN MILLIMETRES read as points (a 128.1pt = 45.2mm tall box gets a
 * 12.66pt `tIns`, not 35.9pt).
 */
export const MARGIN_TYPES = new Set(['lMarg', 'rMarg', 'tMarg', 'bMarg']);

/**
 * A reference whose value is a length: a geometry type, or a `userA`-`userZ`
 * variable, which the built-in layouts only ever assign lengths to and read
 * back in margins as `fact="2.834"` (points per millimetre) - "Upward
 * Arrow"'s `lMarg refType="userA" fact="2.834"` is an 8.8pt inset for a
 * 3.1mm `userA`.
 */
export function isLengthReference(refType: string): boolean {
	return LENGTH_TYPES.has(refType) || /^user[A-Z]$/.test(refType);
}

export const FONT_TYPES = new Set(['primFontSz', 'secFontSz']);

/** Types an algorithm computes itself; a bare constraint must not zero them. */
export const COMPUTED_TYPES = new Set(['connDist']);

/** Store a constraint's value on `target` (a bound for `gte`/`lte`). */
export function assign(target: EngineNode, constraint: LdConstraint, value: number): void {
	switch (constraint.op) {
		case 'gte':
			target.minValues.set(
				constraint.type,
				Math.max(target.minValues.get(constraint.type) ?? -Infinity, value),
			);
			return;
		case 'lte':
			target.maxValues.set(
				constraint.type,
				Math.min(target.maxValues.get(constraint.type) ?? Infinity, value),
			);
			return;
		default:
			target.values.set(constraint.type, value);
	}
}
