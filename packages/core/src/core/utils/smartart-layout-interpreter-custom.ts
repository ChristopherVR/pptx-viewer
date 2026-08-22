/**
 * SmartArt DiagramML interpreter - manual `cust*` override final transform.
 *
 * PowerPoint writes `custAng`/`custScaleX`/`custScaleY`/`custSzX`/`custSzY`/
 * `custFlipHor`/`custFlipVert`/`custLinFactX`/`custLinFactY`/`custRadScaleRad`/
 * `custRadScaleInc` onto a `dgm:pt/dgm:prSet` when the user drags, resizes,
 * rotates, or flips a node in its own diagram editor (see
 * `PptxSmartArtNode.customLayout`, populated by
 * `smartart-data-model-attributes.ts`). Neither algorithmic layout path ever
 * looks at these, so a manually-placed node silently reverted to its
 * algorithmic position whenever there was no cached `dsp:` drawing to fall
 * back on. This module applies them as the final geometry pass after any
 * arranger runs, regardless of which algorithm produced the base layout.
 *
 * Scope: `linearFactorNeighborX/Y` compensate a NEIGHBOURING node's spacing
 * when this one is resized; they have no effect on this node's own geometry,
 * and folding them into a neighbour's geometry needs whole-layout awareness
 * this per-node pass does not have, so they are parsed (for round-trip
 * completeness) but intentionally not applied here. Pure geometry; no
 * framework code, no DOM.
 */

import type { PptxSmartArtNode, SmartArtNodeCustomLayout } from '../types';
import type {
	BoundingBox,
	RenderedCircleNode,
	RenderedNode,
	RenderedPolygonNode,
	RenderedRectNode,
	SmartArtLayoutResult,
} from './smartart-layout-types';

/** Parse an SVG polygon `points` string ("x,y x,y ...") into numeric pairs. */
function parsePoints(points: string): Array<[number, number]> {
	return points
		.trim()
		.split(/\s+/u)
		.filter((pair) => pair.length > 0)
		.map((pair) => {
			const [x, y] = pair.split(',').map(Number);
			return [x, y] as [number, number];
		});
}

/** Axis-aligned bounding box of a set of points. */
function pointsBoundingBox(points: Array<[number, number]>): {
	x: number;
	y: number;
	width: number;
	height: number;
} {
	const xs = points.map(([x]) => x);
	const ys = points.map(([, y]) => y);
	const minX = Math.min(...xs);
	const minY = Math.min(...ys);
	const maxX = Math.max(...xs);
	const maxY = Math.max(...ys);
	return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/** Combined horizontal/vertical scale ratio (`custScale*` layered with `custSz*`). */
function scaleRatios(custom: SmartArtNodeCustomLayout): { x: number; y: number } {
	return {
		x: (custom.scaleX ?? 1) * (custom.sizeX ?? 1),
		y: (custom.scaleY ?? 1) * (custom.sizeY ?? 1),
	};
}

/** Manual position nudge in pixels, from the linear/radial factor overrides. */
function positionNudge(
	custom: SmartArtNodeCustomLayout,
	box: BoundingBox,
): { dx: number; dy: number } {
	const radialNudge = custom.radialScaleIncrement ?? 0;
	return {
		dx: ((custom.linearFactorX ?? 0) + radialNudge) * box.width,
		dy: ((custom.linearFactorY ?? 0) + radialNudge) * box.height,
	};
}

function applyToRect(
	node: RenderedRectNode,
	custom: SmartArtNodeCustomLayout,
	box: BoundingBox,
): RenderedRectNode {
	const { x: scaleX, y: scaleY } = scaleRatios(custom);
	const { dx, dy } = positionNudge(custom, box);
	const cx = node.x + node.width / 2 + dx;
	const cy = node.y + node.height / 2 + dy;
	const width = Math.max(1, node.width * scaleX);
	const height = Math.max(1, node.height * scaleY);
	return {
		...node,
		x: cx - width / 2,
		y: cy - height / 2,
		width,
		height,
		textX: cx,
		textY: cy,
		rotation: (node.rotation ?? 0) + (custom.angle ?? 0),
	};
}

function applyToCircle(
	node: RenderedCircleNode,
	custom: SmartArtNodeCustomLayout,
	box: BoundingBox,
): RenderedCircleNode {
	// A circle's own scale is driven by the radial-specific override, falling
	// back to the generic scale so a plain `custScaleX` still resizes it.
	const radiusScale = custom.radialScaleRadius ?? custom.scaleX ?? custom.scaleY ?? 1;
	const { dx, dy } = positionNudge(custom, box);
	const cx = node.cx + dx;
	const cy = node.cy + dy;
	return {
		...node,
		cx,
		cy,
		r: Math.max(1, node.r * radiusScale),
		textX: node.textX !== undefined ? node.textX + dx : undefined,
		textY: node.textY !== undefined ? node.textY + dy : undefined,
	};
}

function applyToPolygon(
	node: RenderedPolygonNode,
	custom: SmartArtNodeCustomLayout,
	box: BoundingBox,
): RenderedPolygonNode {
	const points = parsePoints(node.points);
	const bbox = pointsBoundingBox(points);
	const cx = bbox.x + bbox.width / 2;
	const cy = bbox.y + bbox.height / 2;
	const { x: scaleX, y: scaleY } = scaleRatios(custom);
	const flipX = custom.flipHorizontal ? -1 : 1;
	const flipY = custom.flipVertical ? -1 : 1;
	const { dx, dy } = positionNudge(custom, box);
	const transformed = points.map(([x, y]) => {
		const relX = (x - cx) * scaleX * flipX;
		const relY = (y - cy) * scaleY * flipY;
		return `${cx + dx + relX},${cy + dy + relY}`;
	});
	return {
		...node,
		points: transformed.join(' '),
		textX: node.textX + dx,
		textY: node.textY + dy,
		rotation: (node.rotation ?? 0) + (custom.angle ?? 0),
	};
}

/** Apply one node's manual override to its rendered geometry, by `kind`. */
function applyCustomLayoutToNode(
	node: RenderedNode,
	custom: SmartArtNodeCustomLayout,
	box: BoundingBox,
): RenderedNode {
	switch (node.kind) {
		case 'rect':
			return applyToRect(node, custom, box);
		case 'circle':
			return applyToCircle(node, custom, box);
		case 'polygon':
			return applyToPolygon(node, custom, box);
	}
}

/**
 * Apply every node's manual `cust*` layout override (if any) as a final
 * transform over an already-computed layout result. A no-op when no node in
 * `nodes` carries a `customLayout`, returning `result` unchanged (same
 * reference) so callers can cheaply skip re-deriving anything downstream.
 */
export function applyCustomLayoutOverrides(
	result: SmartArtLayoutResult,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
): SmartArtLayoutResult {
	const nodeById = new Map(nodes.map((n) => [n.id, n]));
	let changed = false;
	const nodesOut = result.nodes.map((rendered) => {
		const node = rendered.nodeId ? nodeById.get(rendered.nodeId) : undefined;
		const custom = node?.customLayout;
		if (!custom) {
			return rendered;
		}
		changed = true;
		return applyCustomLayoutToNode(rendered, custom, box);
	});
	return changed ? { ...result, nodes: nodesOut } : result;
}
