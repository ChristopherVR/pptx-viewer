/**
 * SmartArt DiagramML interpreter - hierarchy arranger shared helpers.
 *
 * Small pieces shared by the standard/init tree placer
 * (`smartart-hierarchy-standard.ts`) and the hanging-column placer
 * (`smartart-hierarchy-hanging.ts`): the per-run render context, the rect/
 * connector factories, and assistant-node ("`dgm:pt/@type="asst"`") detection
 * for `presLayoutVars.orgChart` mode. Pure geometry; no framework code, no
 * DOM.
 */

import type { PptxSmartArtNode, SmartArtStyle } from '../types';
import type { TreeNode } from './smartart-helpers';
import { rectNode, styleContext } from './smartart-layout-interpreter-render';
import type { StyleContext } from './smartart-layout-interpreter-render';
import type { RenderedConnector, RenderedNode } from './smartart-layout-types';

/** Mutable render state threaded through one hierarchy arrangement pass. */
export interface HierContext {
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
	/**
	 * Connector text keyed `${parentNodeId}>${childNodeId}`, resolved from
	 * each `parOf` connection's linked `parTrans` point (see
	 * `PptxSmartArtConnection.label`). Looked up by {@link elbowConnector}.
	 */
	connectorLabels?: Map<string, string>;
}

export function baseContext(
	nodeCount: number,
	elementId: string,
	palette: string[],
	style: SmartArtStyle,
	boxW: number,
	boxH: number,
	connectorLabels?: Map<string, string>,
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
		connectorLabels,
	};
}

export function pushNode(
	hc: HierContext,
	node: PptxSmartArtNode,
	x: number,
	y: number,
	width = hc.boxW,
	height = hc.boxH,
): number {
	const index = hc.counter.value++;
	hc.nodes.push(
		rectNode({
			key: `${hc.elementId}-hier-${node.id}-${index}`,
			x,
			y,
			width,
			height,
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

/**
 * Elbow connector (drop, then across, then drop) used for a normal child.
 *
 * @param toId - The child node's id, used with `fromId` to look up this
 *               edge's connector text in `hc.connectorLabels`, when the
 *               caller has it (every genuine parent/child edge does).
 */
export function elbowConnector(
	hc: HierContext,
	fromId: string,
	fx: number,
	fy: number,
	cx: number,
	cy: number,
	toId?: string,
): void {
	const midY = fy + (cy - fy) / 2;
	const text = toId ? hc.connectorLabels?.get(`${fromId}>${toId}`) : undefined;
	hc.connectors.push({
		key: `${hc.elementId}-hier-conn-${fromId}-${cx}-${cy}`,
		d: `M${fx},${fy} L${fx},${midY} L${cx},${midY} L${cx},${cy}`,
		...(text ? { text } : {}),
	});
}

/** Short straight stub connector, visually distinct from `elbowConnector`. */
export function stubConnector(
	hc: HierContext,
	fromId: string,
	fx: number,
	fy: number,
	cx: number,
	cy: number,
): void {
	hc.connectors.push({
		key: `${hc.elementId}-hier-asst-${fromId}-${cx}-${cy}`,
		d: `M${fx},${fy} L${cx},${cy}`,
		dash: '2,2',
	});
}

/** A `dgm:pt/@type="asst"` (assistant) data-model node. */
export function isAssistant(node: PptxSmartArtNode): boolean {
	return node.nodeType === 'asst';
}

/** Split a tree node's children into assistants and ordinary subordinates. */
export function partitionChildren(
	t: TreeNode,
	orgChart: boolean,
): { assistants: TreeNode[]; normal: TreeNode[] } {
	if (!orgChart) {
		return { assistants: [], normal: t.children };
	}
	const assistants: TreeNode[] = [];
	const normal: TreeNode[] = [];
	for (const child of t.children) {
		(isAssistant(child.node) ? assistants : normal).push(child);
	}
	return { assistants, normal };
}

/**
 * Tree width counting only ordinary (non-assistant) descendants: assistants
 * are rendered as a side annotation near their parent, not a fan-out sibling,
 * so they must not claim a normal sibling's share of the available width.
 * Falls back to plain leaf-counting (matching `treeWidth`) when `orgChart` is
 * off, so non-org-chart hierarchies are unaffected.
 */
export function effectiveWidth(t: TreeNode, orgChart: boolean): number {
	const { normal } = partitionChildren(t, orgChart);
	if (normal.length === 0) {
		return 1;
	}
	let sum = 0;
	for (const child of normal) {
		sum += effectiveWidth(child, orgChart);
	}
	return sum;
}

/** A resolved per-parent row size for `chMax`/`chPref` wrapping (`Infinity` = unbounded). */
export function rowSize(childMax: number | undefined, childPreferred: number | undefined): number {
	if (typeof childPreferred === 'number' && childPreferred > 0) {
		return childPreferred;
	}
	if (typeof childMax === 'number' && childMax > 0) {
		return childMax;
	}
	return Number.POSITIVE_INFINITY;
}
