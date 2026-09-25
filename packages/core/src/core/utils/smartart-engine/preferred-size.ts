/**
 * A child's preferred size, as an arranging algorithm sees it: the values
 * its parent's (and ancestors') constraints assigned, refined by the child's
 * own self-scoped size constraints (`<dgm:constr type="h" refType="w"
 * fact="0.6"/>` declared on the child itself keeps its aspect).
 */

import { applyConstraint, fontAssigned } from './constraint-eval';
import type { EngineNode } from './engine-node';
import { grownSize } from './text-grow';

const SIZE_TYPES = new Set(['w', 'h']);

/** Whether a constraint declared on `node` sizes the node itself. */
export function isSelfSizeConstraint(node: EngineNode, index: number): boolean {
	const constraint = node.constraints[index];
	return constraint.for === 'self' && SIZE_TYPES.has(constraint.type);
}

export interface Size {
	w: number;
	h: number;
}

/**
 * Apply `child`'s own self-scoped `w`/`h` constraints over the values its
 * ancestors assigned, then read its size, defaulting an unconstrained
 * dimension to `fallback`.
 */
export function preferredSize(child: EngineNode, fallback: Size): Size {
	applySelfSizeConstraints(child);
	const w = child.values.get('w');
	const h = child.values.get('h');
	// Text growth is bounded by the node's own `op="lte"` constraints: "Horizontal
	// Bullet List"'s `parTx` may grow to fit its label but never past `0.4 x w`,
	// so a label that would need a second line there shrinks the font instead.
	const grown = grownSize(child, {
		w: clamp(child, 'w', w ?? fallback.w),
		h: clamp(child, 'h', h ?? fallback.h),
	});
	return { w: clamp(child, 'w', grown.w), h: clamp(child, 'h', grown.h) };
}

/**
 * Re-apply `node`'s own self-scoped `w`/`h` constraints over what its
 * ancestors assigned. A bare literal one (`<dgm:constr type="h"/>`, no
 * reference) is only the node's DEFAULT: it yields to a value an ancestor
 * assigned during a text-driven font search ("Basic Chevron Process"'s
 * `parTx` declares a bare `h` while the diagram sizes it `1.5 x primFontSz`).
 */
export function applySelfSizeConstraints(node: EngineNode): void {
	for (let i = 0; i < node.constraints.length; i++) {
		if (!isSelfSizeConstraint(node, i)) {
			continue;
		}
		const constraint = node.constraints[i];
		const literal = constraint.refType === 'none' && constraint.op === 'none';
		if (literal && fontAssigned.has(node, constraint.type)) {
			continue;
		}
		applyConstraint(node, constraint);
	}
}

function clamp(node: EngineNode, type: string, value: number): number {
	const min = node.minValues.get(type);
	const max = node.maxValues.get(type);
	let out = value;
	if (max !== undefined && out > max) {
		out = max;
	}
	if (min !== undefined && out < min) {
		out = min;
	}
	return out;
}
