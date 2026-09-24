/**
 * A child's preferred size, as an arranging algorithm sees it: the values
 * its parent's (and ancestors') constraints assigned, refined by the child's
 * own self-scoped size constraints (`<dgm:constr type="h" refType="w"
 * fact="0.6"/>` declared on the child itself keeps its aspect).
 */

import { applyConstraint } from './constraint-eval';
import type { EngineNode } from './engine-node';

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
	for (let i = 0; i < child.constraints.length; i++) {
		if (isSelfSizeConstraint(child, i)) {
			applyConstraint(child, child.constraints[i]);
		}
	}
	const w = child.values.get('w');
	const h = child.values.get('h');
	return {
		w: clamp(child, 'w', w ?? fallback.w),
		h: clamp(child, 'h', h ?? fallback.h),
	};
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
