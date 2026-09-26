/**
 * Geometry inputs of a `conn` node that depend on the FINAL boxes of the
 * shapes around it. Split out of `alg-connector.ts` for the file-size budget.
 *
 * - Thickness: a parent constraint sizing the connector off a content node
 *   (Basic Cycle: `w for="ch" ptType="sibTrans" refType="w" refPtType="node"
 *   fact="0.25"`, then the arrow's own `h refType="w" fact="1.35"`) is
 *   evaluated before the cycle algorithm shrinks the nodes to fit, so it
 *   still reads the unshrunk width. PowerPoint keeps the ratio to the laid-out
 *   node, so the connector's size is re-derived from the referenced node's
 *   final box here.
 * - Edge distance: an `ellipse` is left along the centre line at its own
 *   outline, not its bounding box's.
 * - Padding: a connector with no `begPad`/`endPad` constraint keeps 22% / 25%
 *   of the gap free at either end (measured on Basic Cycle's cached arrows,
 *   which span 0.53 of the gap starting 0.22 in).
 */

import { applyConstraint, relatedNodes } from './constraint-eval';
import type { Box, EngineNode } from './engine-node';
import { isSelfSizeConstraint } from './preferred-size';

const SIZE_TYPES = new Set(['w', 'h']);

/** Default `begPad` / `endPad`, as fractions of `connDist`. */
export const DEFAULT_BEGIN_PAD = 0.22;
export const DEFAULT_END_PAD = 0.25;

/**
 * Re-apply the parent's size constraints that address `node` off another
 * node's laid-out box, then `node`'s own self-scoped size constraints.
 * Returns the connector's thickness (`h`), or `fallback` when nothing sizes it.
 */
export function connectorThickness(node: EngineNode, fallback: number): number {
	const parent = node.parent;
	let resized = false;
	for (const constraint of parent?.constraints ?? []) {
		if (!parent || !SIZE_TYPES.has(constraint.type) || !SIZE_TYPES.has(constraint.refType)) {
			continue;
		}
		if (constraint.refFor === 'self' && !constraint.refForName) {
			continue;
		}
		const targets = relatedNodes(parent, constraint.for, constraint.forName, constraint.ptType);
		if (!targets.includes(node)) {
			continue;
		}
		const ref = relatedNodes(
			parent,
			constraint.refFor,
			constraint.refForName,
			constraint.refPtType,
		)[0];
		const box = ref?.box;
		if (!box || ref.alg.type === 'conn') {
			continue;
		}
		const base = constraint.refType === 'w' ? box.w : box.h;
		if (base > 0) {
			node.values.set(constraint.type, base * constraint.fact);
			resized = true;
		}
	}
	if (resized) {
		for (let i = 0; i < node.constraints.length; i++) {
			if (isSelfSizeConstraint(node, i)) {
				applyConstraint(node, node.constraints[i]);
			}
		}
	}
	const h = node.values.get('h');
	return resized && h !== undefined && h > 0 ? h : fallback;
}

/** Distance from a shape's centre to its outline along the unit direction (dx, dy). */
export function edgeDistance(shape: EngineNode, box: Box, dx: number, dy: number): number {
	const halfW = box.w / 2;
	const halfH = box.h / 2;
	if (shape.shape?.type === 'ellipse' && halfW > 0 && halfH > 0) {
		return (halfW * halfH) / Math.hypot(halfH * dx, halfW * dy);
	}
	const tx = dx === 0 ? Infinity : halfW / Math.abs(dx);
	const ty = dy === 0 ? Infinity : halfH / Math.abs(dy);
	return Math.min(tx, ty);
}
