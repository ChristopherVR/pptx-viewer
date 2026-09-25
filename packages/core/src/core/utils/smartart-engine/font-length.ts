/**
 * Font-relative lengths and the bounds they shadow (see
 * `constraint-eval.ts`'s `applyConstraint`).
 */

import { assign, FONT_TYPES, LENGTH_TYPES, POINTS_PER_MM } from './constraint-units';
import type { EngineNode } from './engine-node';
import type { LdConstraint } from './layout-def-types';
import { layoutFontRef } from './layout-font';

/**
 * Nodes whose `w`/`h`/... currently holds a font-relative length resolved
 * during a font search, per type (a bare self literal must not override it;
 * see `preferred-size.ts`).
 */
const fontAssignedTypes = new WeakMap<EngineNode, Set<string>>();

export const fontAssigned = {
	has(node: EngineNode, type: string): boolean {
		return fontAssignedTypes.get(node)?.has(type) ?? false;
	},
};

/**
 * A LENGTH that reads a font size (`<dgm:constr type="h" refType="primFontSz"
 * fact="0.52"/>`) is `fact x size` millimetres. The size is only known inside
 * a text-driven font search (`layout-font.ts`); there it resolves at once, so
 * the layout is built around the candidate size. Outside a search it stays
 * deferred and unassigned, as before.
 */
export function resolveFontLength(
	targets: EngineNode[],
	constraint: LdConstraint,
	ref: EngineNode,
): void {
	if (!LENGTH_TYPES.has(constraint.type)) {
		return;
	}
	const font = layoutFontRef(ref, constraint.refType);
	if (font === undefined) {
		return;
	}
	for (const target of targets) {
		assign(target, constraint, font * constraint.fact * POINTS_PER_MM);
		if (constraint.op === 'none' || constraint.op === 'equ') {
			const types = fontAssignedTypes.get(target) ?? new Set<string>();
			types.add(constraint.type);
			fontAssignedTypes.set(target, types);
		}
	}
}

/**
 * A reference bound that sits beside a font-relative assignment of the same
 * value, from the same node, does not bind: "Vertical Box List" sizes its
 * `negativeSpace` overlap `-0.41 x primFontSz` and ALSO declares it
 * `lte`/`gte -0.82 x parentText.h`, yet every cached overlap is exactly the
 * font-relative half of the parent box, never the bound.
 */
export function isShadowedBound(node: EngineNode, constraint: LdConstraint): boolean {
	if ((constraint.op !== 'lte' && constraint.op !== 'gte') || constraint.refType === 'none') {
		return false;
	}
	return node.constraints.some(
		(other) =>
			other !== constraint &&
			other.type === constraint.type &&
			other.for === constraint.for &&
			other.forName === constraint.forName &&
			(other.op === 'none' || other.op === 'equ') &&
			FONT_TYPES.has(other.refType),
	);
}
