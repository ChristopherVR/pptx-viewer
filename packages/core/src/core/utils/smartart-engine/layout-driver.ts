/**
 * Top-down layout driver. Each node receives its final box from its parent's
 * algorithm; it then evaluates its own constraint list against that box
 * (assigning preferred values to its children and descendants) and runs its
 * own algorithm to place its children, recursively.
 *
 * An algorithm that has to shrink its content to fit (a `lin` row that is
 * wider than the node) does so by re-evaluating the node's constraints
 * against a scaled reference box ({@link evaluateWithReference}): every child
 * value derived from the node's own `w`/`h` then scales with it, which is how
 * PowerPoint keeps a `refType="w"` item width, a `fact="0.4"` arrow slot and
 * a `fact="-0.015"` overlap in proportion while fitting them.
 */

import { applyConstraint } from './constraint-eval';
import type { Box, EngineNode } from './engine-node';

/** Places `node`'s children (sets each child's `box`); `node.box` is final. */
export type ArrangeAlgorithm = (node: EngineNode) => void;

const SELF_GEOMETRY = new Set(['w', 'h', 'l', 't', 'r', 'b', 'ctrX', 'ctrY']);

/**
 * Evaluate `node`'s constraints with its own `w`/`h` taken as `refW`/`refH`.
 * Self-scoped geometry constraints are skipped: they sized the node for its
 * parent and must not override the box the parent chose.
 */
export function evaluateWithReference(node: EngineNode, refW: number, refH: number): void {
	// Constraints may reference values a later constraint in the list sets
	// (PowerPoint solves them as a system, not in document order), so the
	// list is re-run until no value changes.
	for (let pass = 0; pass < MAX_PASSES; pass++) {
		node.groups = [];
		node.values.set('w', refW);
		node.values.set('h', refH);
		const before = snapshot(node);
		for (const constraint of node.constraints) {
			if (constraint.for === 'self' && !constraint.forName && SELF_GEOMETRY.has(constraint.type)) {
				continue;
			}
			applyConstraint(node, constraint);
		}
		node.values.set('w', refW);
		node.values.set('h', refH);
		if (pass > 0 && snapshot(node) === before) {
			break;
		}
	}
}

const MAX_PASSES = 4;

/** A cheap fingerprint of every value `node`'s constraints can touch. */
function snapshot(node: EngineNode): string {
	const parts: string[] = [];
	const visit = (current: EngineNode): void => {
		for (const [key, value] of current.values) {
			parts.push(`${key}=${value.toFixed(4)}`);
		}
		parts.push('|');
		current.children.forEach(visit);
	};
	visit(node);
	return parts.join(',');
}

/** Give every child the parent's full box (algorithms without placement). */
export function fillChildren(node: EngineNode): void {
	const box = node.box;
	if (!box) {
		return;
	}
	for (const child of node.children) {
		child.box = { ...box };
	}
}

export interface LayoutRegistry {
	resolve(type: string): ArrangeAlgorithm;
}

/** Lay out `node` (whose box is set) and, recursively, its subtree. */
export function layoutSubtree(node: EngineNode, registry: LayoutRegistry): void {
	const box = node.box;
	if (!box) {
		return;
	}
	evaluateWithReference(node, box.w, box.h);
	if (node.alg.type === 'conn') {
		// Connectors are routed once every shape they join has its box.
		return;
	}
	registry.resolve(node.alg.type)(node);
	for (const child of node.children) {
		if (!child.box) {
			child.box = { x: box.x, y: box.y, w: 0, h: 0 };
		}
		layoutSubtree(child, registry);
	}
}

function connectors(node: EngineNode, out: EngineNode[]): EngineNode[] {
	if (node.alg.type === 'conn') {
		out.push(node);
	}
	for (const child of node.children) {
		connectors(child, out);
	}
	return out;
}

/** Lay out the whole tree inside a `width` x `height` point frame. */
export function layoutTree(root: EngineNode, frame: Box, registry: LayoutRegistry): void {
	root.box = { ...frame };
	layoutSubtree(root, registry);
	for (const connector of connectors(root, [])) {
		registry.resolve('conn')(connector);
		for (const child of connector.children) {
			layoutSubtree(child, registry);
		}
	}
}
