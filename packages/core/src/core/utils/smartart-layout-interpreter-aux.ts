/**
 * SmartArt DiagramML interpreter - auxiliary arrangers (`conn` / `sp` / `tx`).
 *
 * These cover the three "leaf / glue" algorithms that appear inside composite
 * DiagramML layout definitions. They are intentionally best-effort standalone
 * passes for the interpreter, which arranges the flat data-model points
 * linearly rather than running the full recursive constraint solver:
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
 *                         rects with arrowed paths, honouring `linDir` plus the
 *                         connector's own `begSty`/`endSty`/`connRout`/`bendPt`/
 *                         `dim` params (see `smartart-layout-interpreter-conn-path.ts`).
 *
 * Pure geometry; no framework code, no DOM.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode, SmartArtStyle } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import type {
	ConnArrowStyle,
	ConnDimension,
	ConnRouting,
} from './smartart-layout-interpreter-conn-path';
import { connectorEndpoints, connectorPath } from './smartart-layout-interpreter-conn-path';
import { arrangeLinear } from './smartart-layout-interpreter-linear';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { algorithmParam, resolveFlowDirection } from './smartart-layout-interpreter-model';
import { rectNode, styleContext } from './smartart-layout-interpreter-render';
import type {
	BoundingBox,
	RenderedConnector,
	RenderedRectNode,
	SmartArtLayoutResult,
} from './smartart-layout-types';

const INSET = 6;

/** Read `begSty`/`endSty`, defaulting to the pre-existing single-arrowhead-at-target behaviour. */
function arrowStyle(
	node: PptxSmartArtLayoutNode,
	type: string,
	fallback: ConnArrowStyle,
): ConnArrowStyle {
	const raw = algorithmParam(node, type);
	return raw === 'arr' || raw === 'noArr' ? raw : fallback;
}

/**
 * Execute the `conn` algorithm: arrange the points linearly and draw a
 * connector between each consecutive pair (N nodes -> N-1 connectors), honouring
 * `begSty`/`endSty` (arrowhead presence), `connRout` (straight/bend/curve),
 * `dim` (facing-edge vs centre-to-centre routing), and `linDir` ordering.
 *
 * Limitation: this is a standalone best-effort pass. A real `conn` node draws
 * against positions computed by the sibling arranger; without that shared
 * geometry we re-run the linear arrangement here. `presLayoutVars` direction is
 * not threaded through this signature, so only `linDir` reversal is honoured.
 * `bendPt`'s finer corner-routing variants collapse to one fixed midpoint elbow
 * (see `smartart-layout-interpreter-conn-path.ts`'s module doc).
 */
export function arrangeConn(
	plan: ArrangementPlan,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	index: ConstraintIndex = EMPTY_CONSTRAINT_INDEX,
): SmartArtLayoutResult | undefined {
	if (nodes.length === 0) {
		return undefined;
	}
	const flow = resolveFlowDirection(plan.node, undefined);
	const base = arrangeLinear(plan, flow, nodes, box, palette, style, elementId, index);
	const rects = base.nodes.filter((node): node is RenderedRectNode => node.kind === 'rect');
	const horizontal = flow.orientation === 'horizontal';

	const routingRaw = algorithmParam(plan.node, 'connRout');
	const routing: ConnRouting =
		routingRaw === 'bend' || routingRaw === 'curve' ? routingRaw : 'stra';
	const dim: ConnDimension = algorithmParam(plan.node, 'dim') === '2D' ? '2D' : '1D';
	const begSty = arrowStyle(plan.node, 'begSty', 'noArr');
	const endSty = arrowStyle(plan.node, 'endSty', 'arr');
	const centre = { x: box.width / 2, y: box.height / 2 };

	const connectors: RenderedConnector[] = [];
	for (let i = 0; i < rects.length - 1; i++) {
		const { x0, y0, x1, y1 } = connectorEndpoints(rects[i], rects[i + 1], horizontal, dim);
		connectors.push({
			key: `${elementId}-conn-${i}`,
			d: connectorPath(x0, y0, x1, y1, centre, routing, begSty, endSty),
		});
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
