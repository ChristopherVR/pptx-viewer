/**
 * The presentation style label (`presStyleLbl`) of an engine node: the label
 * PowerPoint records on the node's presentation point, and the quick-style /
 * colour-transform label its shape is styled with.
 *
 * A layout node's own `@styleLbl` wins, then the nearest ancestor's. Most
 * built-in layouts declare none on their main shapes, and PowerPoint then
 * derives one from the point the node presents (checked against every
 * presentation point of the 3D ground-truth deck's eight layouts):
 *
 * - a content point at data depth `d` (the diagram's top-level items are depth
 *   1) is `node<d>`: Basic Pyramid's `level` is `node1`, Organization Chart's
 *   second-level `rootText` is `node2`;
 * - a sibling transition is `sibTrans2D1` (or `sibTrans1D1` for a 1-D
 *   connector): Basic Process / Basic Cycle arrows and their `connectorText`;
 * - a parent transition is `parChTrans<dim><d>`, `d` being the child's depth:
 *   Organization Chart's and Basic Radial's lines are `parChTrans1D2`.
 *
 * Labels are capped at 4, the deepest level a quick style defines.
 */

import type { DataPoint } from './data-points';
import type { EngineNode } from './engine-node';

const MAX_LEVEL = 4;

/** Data depth of a point: the doc is 0, its content children 1, ... */
function depthOf(point: DataPoint): number {
	let depth = 0;
	for (let current = point.parent; current; current = current.parent) {
		depth++;
	}
	return depth;
}

function level(depth: number): number {
	return Math.max(0, Math.min(MAX_LEVEL, depth));
}

/** The connector dimension (`1D` / `2D`) a transition point is drawn with. */
function connectorDim(node: EngineNode): '1D' | '2D' {
	return node.alg.type === 'conn' && node.alg.params.dim === '1D' ? '1D' : '2D';
}

/** The label PowerPoint derives from the presented point, when the layout declares none. */
function derivedStyleLabel(node: EngineNode): string | undefined {
	if (!node.hasPresOf) {
		return undefined;
	}
	const point = node.presOf[0] ?? node.point;
	switch (point.type) {
		case 'node':
		case 'asst':
			return `node${level(depthOf(point))}`;
		case 'sibTrans':
			return `sibTrans${connectorDim(node)}1`;
		case 'parTrans':
			return `parChTrans${connectorDim(node)}${level(depthOf(point))}`;
		default:
			return undefined;
	}
}

/** The style label of an engine node's shape, or `undefined` when none applies. */
export function engineStyleLabel(node: EngineNode): string | undefined {
	for (let current: EngineNode | undefined = node; current; current = current.parent) {
		if (current.styleLbl) {
			return current.styleLbl;
		}
	}
	return derivedStyleLabel(node);
}
