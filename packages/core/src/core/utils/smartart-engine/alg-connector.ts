/**
 * `conn` algorithm (ECMA-376 Part 1, 21.4.2.x Connector): draws a transition
 * between the two shapes it connects. The source and destination are the
 * content points on either side of the transition point (a `sibTrans` joins
 * a node to its next sibling, wrapping for a cycle's last one; a `parTrans`
 * joins a parent to the child), located among the laid-out nodes by data
 * point and, when given, the `srcNode`/`dstNode` layout-node names.
 *
 * A 2-D connector (the default, e.g. an arrow) becomes a shape running from
 * the source's edge to the destination's edge along the centre line, less
 * `begPad`/`endPad`, as thick as the node's own height and rotated to the
 * line; `connDist` is published for constraints to read.
 */

import type { DataPoint } from './data-points';
import type { Box, EngineNode } from './engine-node';

function rootOf(node: EngineNode): EngineNode {
	let current = node;
	while (current.parent) {
		current = current.parent;
	}
	return current;
}

function endpoints(point: DataPoint): [DataPoint | undefined, DataPoint | undefined] {
	const parent = point.parent;
	if (!parent) {
		return [undefined, undefined];
	}
	if (point.type === 'parTrans') {
		const index = parent.children.indexOf(point);
		return [parent, parent.children[index + 1]];
	}
	const content = parent.children.filter((c) => c.type === 'node' || c.type === 'asst');
	const index = parent.children.indexOf(point);
	const before = parent.children[index - 1];
	const position = content.indexOf(before);
	return [before, content[(position + 1) % Math.max(1, content.length)]];
}

function findShape(
	scope: EngineNode,
	point: DataPoint | undefined,
	name: string | undefined,
	skip: EngineNode,
): EngineNode | undefined {
	if (!point) {
		return undefined;
	}
	let fallback: EngineNode | undefined;
	let named: EngineNode | undefined;
	const visit = (node: EngineNode): void => {
		if (named) {
			return;
		}
		if (node !== skip && node.point === point && node.box && node.alg.type !== 'conn') {
			if (name && node.name === name) {
				named = node;
				return;
			}
			if (!fallback && node.shape?.type && !node.shape.hideGeom) {
				fallback = node;
			}
		}
		node.children.forEach(visit);
	};
	visit(scope);
	return named ?? fallback;
}

/** Distance from a box's centre to its edge along the unit direction (dx, dy). */
function edgeDistance(box: Box, dx: number, dy: number): number {
	const halfW = box.w / 2;
	const halfH = box.h / 2;
	const tx = dx === 0 ? Infinity : halfW / Math.abs(dx);
	const ty = dy === 0 ? Infinity : halfH / Math.abs(dy);
	return Math.min(tx, ty);
}

export function arrangeConnector(node: EngineNode): void {
	const box = node.box;
	if (!box) {
		return;
	}
	const [srcPoint, dstPoint] = endpoints(node.point);
	const root = rootOf(node);
	const src = findShape(root, srcPoint, node.alg.params.srcNode, node);
	const dst = findShape(root, dstPoint, node.alg.params.dstNode, node);
	if (src?.box && dst?.box) {
		const sx = src.box.x + src.box.w / 2;
		const sy = src.box.y + src.box.h / 2;
		const ex = dst.box.x + dst.box.w / 2;
		const ey = dst.box.y + dst.box.h / 2;
		const length = Math.hypot(ex - sx, ey - sy);
		if (length > 0) {
			const dx = (ex - sx) / length;
			const dy = (ey - sy) / length;
			const startGap = edgeDistance(src.box, dx, dy);
			const endGap = edgeDistance(dst.box, dx, dy);
			const connDist = Math.max(0, length - startGap - endGap);
			node.values.set('connDist', connDist);
			for (const constraint of node.constraints) {
				if (constraint.refType === 'connDist' && constraint.for === 'self') {
					node.values.set(constraint.type, connDist * constraint.fact);
				}
			}
			const begPad = node.values.get('begPad') ?? 0;
			const endPad = node.values.get('endPad') ?? 0;
			const arrowLength = Math.max(0, connDist - begPad - endPad);
			const mid = startGap + begPad + arrowLength / 2;
			const cx = sx + dx * mid;
			const cy = sy + dy * mid;
			const thickness = box.h;
			node.box = { x: cx - arrowLength / 2, y: cy - thickness / 2, w: arrowLength, h: thickness };
			node.rotation = normaliseAngle((Math.atan2(dy, dx) * 180) / Math.PI);
		}
	}
	for (const child of node.children) {
		child.box = { ...(node.box ?? box) };
		child.rotation = node.rotation;
	}
}

function normaliseAngle(degrees: number): number {
	const rounded = Math.round(degrees * 1000) / 1000;
	return ((rounded % 360) + 360) % 360;
}
