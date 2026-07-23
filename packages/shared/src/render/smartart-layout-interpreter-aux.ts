/**
 * SmartArt DiagramML interpreter - auxiliary arrangers (`conn` / `sp` / `tx`).
 *
 * These cover the three "leaf / glue" algorithms that appear inside composite
 * DiagramML layout definitions. They are intentionally best-effort standalone
 * passes for the SVG-fallback interpreter, which arranges the flat data-model
 * points linearly rather than running the full recursive constraint solver:
 *
 *   - `tx`   (text):      a single node that fills the whole parent region with
 *                         the point's text. Degenerate but real - it is the leaf
 *                         of a composite where an outer arranger has already
 *                         chosen the region. On its own it renders one filling
 *                         rect for the first point.
 *   - `sp`   (space):     a spacer that consumes layout space but draws nothing.
 *                         We return an empty (but valid) result: zero nodes and
 *                         zero connectors. See `arrangeSpacer` for the rationale.
 *   - `conn` (connector): connector shapes drawn between sibling nodes. Faithful
 *                         connector geometry needs the primary arrangement's
 *                         resolved positions; standalone we arrange the points
 *                         linearly (via the `lin` arranger) and link consecutive
 *                         rects with arrowed paths, honouring `linDir`.
 *
 * Pure geometry; no framework code, no DOM.
 */

import type { PptxSmartArtNode, SmartArtStyle } from 'pptx-viewer-core';

import { arrangeLinear } from './smartart-layout-interpreter-linear';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { resolveFlowDirection } from './smartart-layout-interpreter-model';
import { rectNode, styleContext } from './smartart-layout-interpreter-render';
import type {
	BoundingBox,
	RenderedConnector,
	RenderedRectNode,
	SmartArtLayoutResult,
} from './smartart-layout-types';

const INSET = 6;
/** Half-width of the drawn arrowhead wings, in px. */
const ARROW_WING = 4;
/** Length of the arrowhead along the connector, in px. */
const ARROW_HEAD = 7;

/**
 * Build an SVG path for a straight connector from `(x0,y0)` to `(x1,y1)` with a
 * small chevron arrowhead at the target end (indicating flow direction). When
 * the two points coincide only the (degenerate) move is emitted.
 */
function arrowPath(x0: number, y0: number, x1: number, y1: number): string {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const len = Math.hypot(dx, dy);
	const line = `M${x0},${y0} L${x1},${y1}`;
	if (len < 1e-6) {
		return line;
	}
	const ux = dx / len;
	const uy = dy / len;
	// Base of the arrowhead, ARROW_HEAD back from the tip along the segment.
	const bx = x1 - ux * ARROW_HEAD;
	const by = y1 - uy * ARROW_HEAD;
	// Perpendicular unit vector for the two wings.
	const px = -uy;
	const py = ux;
	const w1x = bx + px * ARROW_WING;
	const w1y = by + py * ARROW_WING;
	const w2x = bx - px * ARROW_WING;
	const w2y = by - py * ARROW_WING;
	return `${line} M${w1x},${w1y} L${x1},${y1} L${w2x},${w2y}`;
}

/** Connection point on a rect's edge facing the next rect for the flow axis. */
function connectPoints(
	from: RenderedRectNode,
	to: RenderedRectNode,
	horizontal: boolean,
): { x0: number; y0: number; x1: number; y1: number } {
	const fromCx = from.x + from.width / 2;
	const fromCy = from.y + from.height / 2;
	const toCx = to.x + to.width / 2;
	const toCy = to.y + to.height / 2;
	if (horizontal) {
		// Link the trailing edge of `from` to the leading edge of `to`, following
		// the geometric order so it works for both forward and reversed flow.
		const leftFirst = fromCx <= toCx;
		return leftFirst
			? { x0: from.x + from.width, y0: fromCy, x1: to.x, y1: toCy }
			: { x0: from.x, y0: fromCy, x1: to.x + to.width, y1: toCy };
	}
	const topFirst = fromCy <= toCy;
	return topFirst
		? { x0: fromCx, y0: from.y + from.height, x1: toCx, y1: to.y }
		: { x0: fromCx, y0: from.y, x1: toCx, y1: to.y + to.height };
}

/**
 * Execute the `conn` algorithm: arrange the points linearly and draw an arrowed
 * connector between each consecutive pair (N nodes -> N-1 connectors).
 *
 * Limitation: this is a standalone best-effort pass. A real `conn` node draws
 * against positions computed by the sibling arranger; without that shared
 * geometry we re-run the linear arrangement here. `presLayoutVars` direction is
 * not threaded through this signature, so only `linDir` reversal is honoured.
 */
export function arrangeConn(
	plan: ArrangementPlan,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult | undefined {
	if (nodes.length === 0) {
		return undefined;
	}
	const flow = resolveFlowDirection(plan.node, undefined);
	const base = arrangeLinear(plan, flow, nodes, box, palette, style, elementId);
	const rects = base.nodes.filter((node): node is RenderedRectNode => node.kind === 'rect');
	const horizontal = flow.orientation === 'horizontal';

	const connectors: RenderedConnector[] = [];
	for (let i = 0; i < rects.length - 1; i++) {
		const { x0, y0, x1, y1 } = connectPoints(rects[i], rects[i + 1], horizontal);
		connectors.push({ key: `${elementId}-conn-${i}`, d: arrowPath(x0, y0, x1, y1) });
	}

	return { ...base, connectors, family: 'process' };
}

/**
 * Execute the `sp` algorithm: a spacer that reserves layout space but draws
 * nothing.
 *
 * Choice: we return a valid, empty `SmartArtLayoutResult` (no nodes, no
 * connectors) rather than a transparent placeholder rect or `undefined`. The
 * spacer is genuinely "applicable" (it is a recognised algorithm), so declining
 * with `undefined` would wrongly send the caller to the legacy family
 * approximation; emitting an invisible placeholder would add a stray hit-target
 * and complicate node indexing. An empty result cleanly represents "consumed
 * space, nothing drawn".
 */
export function arrangeSpacer(
	_plan: ArrangementPlan,
	_nodes: PptxSmartArtNode[],
	box: BoundingBox,
	_palette: string[],
	style: SmartArtStyle,
	_elementId: string,
): SmartArtLayoutResult | undefined {
	const ctx = styleContext(style);
	return {
		nodes: [],
		connectors: [],
		shadowFilter: ctx.shadow,
		viewBox: `0 0 ${box.width} ${box.height}`,
		family: 'list',
	};
}

/**
 * Execute the `tx` algorithm: a single node filling the parent region with the
 * point's text. Only the first point is placed (composite `tx` leaves describe
 * one region). Returns `undefined` when there is no point to render.
 */
export function arrangeText(
	_plan: ArrangementPlan,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult | undefined {
	const node = nodes[0];
	if (!node) {
		return undefined;
	}
	const { width: w, height: h } = box;
	const ctx = styleContext(style);
	const rect = rectNode({
		key: `${elementId}-tx-${node.id}`,
		x: INSET,
		y: INSET,
		width: Math.max(0, w - INSET * 2),
		height: Math.max(0, h - INSET * 2),
		node,
		index: 0,
		total: 1,
		palette,
		style,
		ctx,
	});
	return {
		nodes: [rect],
		connectors: [],
		shadowFilter: ctx.shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'list',
	};
}
