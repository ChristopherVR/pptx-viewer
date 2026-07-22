/**
 * SmartArt DiagramML interpreter - hierarchy (`hierRoot` / `hierChild`) arranger.
 *
 * Arranges the data-model node tree as an org-chart / hierarchy. Consults the
 * presentation layout variables (`hierBranch`, `orgChart`) to switch between a
 * standard horizontal tree (children spread below the parent) and a hanging
 * layout (children stacked in an indented column). Pure geometry; no framework
 * code.
 */

import type { PptxSmartArtNode, PptxSmartArtPresLayoutVars, SmartArtStyle } from 'pptx-viewer-core';

import { buildTree, treeDepth, treeWidth } from './smartart-layout-helpers';
import { rectNode, styleContext } from './smartart-layout-interpreter-render';
import type { StyleContext } from './smartart-layout-interpreter-render';
import type {
	BoundingBox,
	RenderedConnector,
	RenderedNode,
	SmartArtLayoutResult,
	TreeNode,
} from './smartart-layout-types';

const INSET = 6;

/** Whether the resolved layout variables call for a hanging (indented) tree. */
function isHanging(presLayoutVars: PptxSmartArtPresLayoutVars | undefined): boolean {
	const branch = presLayoutVars?.hierarchyBranch;
	return branch === 'l' || branch === 'r' || branch === 'hang';
}

interface HierContext {
	elementId: string;
	palette: string[];
	style: SmartArtStyle;
	ctx: StyleContext;
	total: number;
	boxW: number;
	boxH: number;
	nodes: RenderedNode[];
	connectors: RenderedConnector[];
	counter: { value: number };
}

function connector(
	hc: HierContext,
	from: TreeNode,
	fx: number,
	fy: number,
	cx: number,
	cy: number,
): void {
	const midY = fy + (cy - fy) / 2;
	hc.connectors.push({
		key: `${hc.elementId}-hier-conn-${from.node.id}-${cx}-${cy}`,
		d: `M${fx},${fy} L${fx},${midY} L${cx},${midY} L${cx},${cy}`,
	});
}

function pushNode(hc: HierContext, node: PptxSmartArtNode, x: number, y: number): number {
	const index = hc.counter.value++;
	hc.nodes.push(
		rectNode({
			key: `${hc.elementId}-hier-${node.id}-${index}`,
			x,
			y,
			width: hc.boxW,
			height: hc.boxH,
			node,
			index,
			total: hc.total,
			palette: hc.palette,
			style: hc.style,
			ctx: hc.ctx,
		}),
	);
	return index;
}

/** Standard tree: children spread horizontally below the parent. */
function placeStandard(
	hc: HierContext,
	t: TreeNode,
	xOffset: number,
	level: number,
	cellW: number,
	cellH: number,
): void {
	const spanW = treeWidth(t);
	const cx = (xOffset + spanW / 2) * cellW;
	const cy = level * cellH + cellH / 2;
	pushNode(hc, t.node, cx - hc.boxW / 2, cy - hc.boxH / 2);
	let childOffset = xOffset;
	for (const child of t.children) {
		const childW = treeWidth(child);
		const childCx = (childOffset + childW / 2) * cellW;
		const childCy = (level + 1) * cellH + cellH / 2;
		connector(hc, t, cx, cy + hc.boxH / 2, childCx, childCy - hc.boxH / 2);
		placeStandard(hc, child, childOffset, level + 1, cellW, cellH);
		childOffset += childW;
	}
}

/** Hanging tree: children stacked in an indented column under the parent. */
function placeHanging(
	hc: HierContext,
	t: TreeNode,
	x: number,
	indent: number,
	vGap: number,
	cursor: { y: number },
): void {
	const y = cursor.y;
	cursor.y += hc.boxH + vGap;
	pushNode(hc, t.node, x, y);
	for (const child of t.children) {
		const childY = cursor.y;
		connector(hc, t, x + hc.boxH / 2, y + hc.boxH, x + indent, childY + hc.boxH / 2);
		placeHanging(hc, child, x + indent, indent, vGap, cursor);
	}
}

function baseContext(
	nodeCount: number,
	elementId: string,
	palette: string[],
	style: SmartArtStyle,
	boxW: number,
	boxH: number,
): HierContext {
	return {
		elementId,
		palette,
		style,
		ctx: styleContext(style),
		total: nodeCount,
		boxW,
		boxH,
		nodes: [],
		connectors: [],
		counter: { value: 0 },
	};
}

/** Execute the hierarchy algorithm over the data-model node tree. */
export function arrangeHierarchy(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const roots = buildTree(nodes);

	if (isHanging(presLayoutVars)) {
		const boxW = Math.min(w * 0.42, 160);
		const boxH = Math.min(h * 0.16, 30);
		const indent = boxW * 0.35;
		const vGap = boxH * 0.55;
		const hc = baseContext(nodes.length, elementId, palette, style, boxW, boxH);
		const cursor = { y: INSET };
		for (const root of roots) {
			placeHanging(hc, root, INSET, indent, vGap, cursor);
		}
		return {
			nodes: hc.nodes,
			connectors: hc.connectors,
			shadowFilter: hc.ctx.shadow,
			viewBox: `0 0 ${w} ${h}`,
			family: 'hierarchy',
		};
	}

	const totalLeaves = roots.reduce((sum, r) => sum + treeWidth(r), 0);
	const depth = roots.length > 0 ? Math.max(...roots.map(treeDepth)) : 1;
	const cellW = w / Math.max(1, totalLeaves);
	const cellH = h / Math.max(1, depth);
	const boxW = Math.min(cellW * 0.8, 150);
	const boxH = Math.min(cellH * 0.4, 40);
	const hc = baseContext(nodes.length, elementId, palette, style, boxW, boxH);
	let offset = 0;
	for (const root of roots) {
		placeStandard(hc, root, offset, 0, cellW, cellH);
		offset += treeWidth(root);
	}
	return {
		nodes: hc.nodes,
		connectors: hc.connectors,
		shadowFilter: hc.ctx.shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'hierarchy',
	};
}
