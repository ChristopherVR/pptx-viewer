/**
 * SmartArt DiagramML interpreter - cycle (`cycle`) arranger.
 *
 * Places the data-model points evenly around a centre, honouring the `stAng`
 * (start angle) and `spanAng` (sweep) algorithm parameters when present, and
 * draws light arc connectors between consecutive points. When `ctrShpMap`
 * (`dgm:param[@type=ctrShpMap]`) is `fNode`, the FIRST data point is pulled off
 * the ring and placed at the box centre instead - PowerPoint's "Radial Cycle"
 * family layouts use this for a hub node the ring nodes surround. Pure
 * geometry; no framework code.
 */

import type { PptxSmartArtNode, SmartArtStyle } from '../types';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { algorithmParam, itemNode, numericParam } from './smartart-layout-interpreter-model';
import { presetBoxNode } from './smartart-layout-interpreter-preset-node';
import { styleContext } from './smartart-layout-interpreter-render';
import type {
	BoundingBox,
	RenderedConnector,
	RenderedNode,
	SmartArtLayoutResult,
} from './smartart-layout-types';

const DEG_TO_RAD = Math.PI / 180;

/** Angle (radians, screen space) of point `i` measured clockwise from top. */
function pointAngle(index: number, count: number, startDeg: number, spanDeg: number): number {
	const full = Math.abs(spanDeg) >= 360;
	const step = full ? spanDeg / count : count > 1 ? spanDeg / (count - 1) : 0;
	return (startDeg + index * step - 90) * DEG_TO_RAD;
}

/** Execute the `cycle` algorithm: points on a ring around the box centre. */
export function arrangeCycle(
	plan: ArrangementPlan,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const ctx = styleContext(style);
	// `ctrShpMap="fNode"` pulls the first data point into a hub at the box
	// centre; every other value (including absent, the common case) puts every
	// point on the ring, matching the pre-existing behaviour.
	const hasHub = algorithmParam(plan.node, 'ctrShpMap') === 'fNode' && nodes.length > 0;
	const hubNode = hasHub ? nodes[0] : undefined;
	const ringNodes = hasHub ? nodes.slice(1) : nodes;
	const n = ringNodes.length;
	const size = Math.min(w, h);
	const cx = w / 2;
	const cy = h / 2;
	const startDeg = numericParam(plan.node, 'stAng', 0);
	const spanDeg = numericParam(plan.node, 'spanAng', 360);
	const nodeR = Math.max(size * 0.06, Math.min(size * 0.12, 200 / Math.max(1, n)));
	const radius = Math.max(nodeR, size * 0.5 - nodeR - 4);
	// The hub sits inside the ring, sized to roughly fill the space the ring
	// leaves at the centre.
	const hubR = Math.max(nodeR, radius - nodeR - 4);

	const centre = (index: number): { x: number; y: number } => {
		const angle = pointAngle(index, n, startDeg, spanDeg);
		return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
	};

	const full = Math.abs(spanDeg) >= 360;
	const connectorCount = n > 0 ? (full ? n : Math.max(0, n - 1)) : 0;
	const connectors: RenderedConnector[] = Array.from({ length: connectorCount }, (_, i) => {
		const from = centre(i);
		const to = centre((i + 1) % n);
		const midX = (from.x + to.x) / 2;
		const midY = (from.y + to.y) / 2;
		const pull = 1 + (radius * 0.15) / Math.max(1, Math.hypot(midX - cx, midY - cy));
		const controlX = cx + (midX - cx) * pull;
		const controlY = cy + (midY - cy) * pull;
		return {
			key: `${elementId}-cycle-conn-${i}`,
			d: `M${from.x},${from.y} Q${controlX},${controlY} ${to.x},${to.y}`,
		};
	});

	const itemShape = itemNode(plan.node)?.shape;
	const renderedNodes: RenderedNode[] = ringNodes.map((node, i) => {
		const { x, y } = centre(i);
		return presetBoxNode({
			key: `${elementId}-cycle-${node.id}-${i}`,
			x: x - nodeR,
			y: y - nodeR,
			width: nodeR * 2,
			height: nodeR * 2,
			node,
			index: i,
			total: n,
			palette,
			style,
			ctx,
			shape: itemShape,
			fallbackKind: 'circle',
		});
	});
	if (hubNode) {
		renderedNodes.push(
			presetBoxNode({
				key: `${elementId}-cycle-hub-${hubNode.id}`,
				x: cx - hubR,
				y: cy - hubR,
				width: hubR * 2,
				height: hubR * 2,
				node: hubNode,
				index: 0,
				total: nodes.length,
				palette,
				style,
				ctx,
				shape: itemShape,
				fallbackKind: 'circle',
			}),
		);
	}

	return {
		nodes: renderedNodes,
		connectors,
		shadowFilter: ctx.shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'cycle',
	};
}
