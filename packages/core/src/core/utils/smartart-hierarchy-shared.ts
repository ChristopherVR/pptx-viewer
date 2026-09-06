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

/**
 * The org-chart-family "hierRoot" algorithm's root-box alignment offset
 * (`dgm:param type="hierAlign"` / `dgm:constr type="alignOff"` in the built-in
 * "Organization Chart" layoutDef), as a fraction of one box's width.
 *
 * Measured directly against genuine PowerPoint cached `dsp:drawing` output
 * (not derived from the ECMA-376 constraint text, which this interpreter does
 * not solve generically): every sampled hanging-generation transition offsets
 * the child column by EXACTLY 0.25x the box width from its parent's own left
 * edge, regardless of `hierBranch` (`std`/`init`/`l`/`r`/`hang` all measured
 * identical) and regardless of generation depth:
 *
 *   - `smartart-orgchart-hierbranch.pptx` slides 1-4 (Standard/Both/Left/Right
 *     Hanging): Report One -> Analyst One, every variant, ratio 0.25 exactly.
 *   - `smartart-orgchart-many.pptx`: a flattened report-group's real children
 *     offset 0.25 from the (dropped) group-wrapper's own fanned slot.
 *   - `smartart-orgchart-nested-hang.pptx` (Standard AND Both Hanging):
 *     Team One's own hanging children (Team Four/Five, a THIRD generation)
 *     offset 0.25 from Team One, confirming the ratio recurses unchanged at
 *     deeper generations, and that "Both Hanging" does NOT alternate side for
 *     multiple ordinary children of the SAME parent (they share one column,
 *     same as every other `hierBranch` value) - see the doc comment on
 *     `placeHangingTree` in `smartart-hierarchy-hanging.ts`.
 *
 * Used both for the first hop out of a fanned/flattened parent (see
 * `smartart-hierarchy-standard.ts`'s `hangingPlacer` invocation) and for every
 * further hop within the hanging tail itself (`HangingOptions.indent` in
 * `smartart-hierarchy-hanging.ts`).
 */
export const HIER_TAIL_OFFSET_RATIO = 0.25;

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

/** True for a `dgm:pt` that is an invisible org-chart grouping wrapper. */
function isOrgChartGroupWrapper(node: PptxSmartArtNode): boolean {
	return !node.nodeType && node.text.trim().length === 0;
}

/**
 * Genuine PowerPoint org charts (`presLayoutVars.orgChart`) do NOT attach
 * ordinary reports directly to their manager: even a manager with only 3
 * direct reports (well within the default `chPref=3` threshold, no overflow)
 * gets up to `chPref` synthetic, untyped, EMPTY content points as an
 * intermediate "hierChild group" layer, with the real reports nested one
 * level under whichever group slot got populated. Measured against
 * `smartart-orgchart-hierbranch.pptx` in the corpus: every one of its four
 * slides parses to 11 content points for a tree the author only typed 7 nodes
 * into, the extra 4 being one empty assistant slot and three empty group
 * points (only one of which has any children).
 *
 * Left alone, the hierarchy arranger renders those group wrappers as ordinary
 * blank fanned-out boxes and their real children one generation too deep
 * (landing on the hanging tail instead of the fan-out row PowerPoint itself
 * shows). This flattens them out before the tree is built: an empty, untyped
 * node's children are spliced into its own parent's child list in its place,
 * and the wrapper itself is dropped (an empty, childless slot simply
 * disappears, matching PowerPoint's own unpopulated group columns). Assistant
 * points keep their role even when empty - only a plain untyped node with no
 * text is a group wrapper - so a genuinely blank ordinary node is never lost:
 * that shape does not occur in a real org chart's data model. A no-op when
 * `orgChart` is not set, or when no such wrapper is present.
 */
export function flattenOrgChartGroupWrappers(
	nodes: PptxSmartArtNode[],
	orgChart: boolean,
): PptxSmartArtNode[] {
	if (!orgChart || !nodes.some(isOrgChartGroupWrapper)) {
		return nodes;
	}
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const parentIdOf = (node: PptxSmartArtNode): string | undefined => {
		let current = node;
		// Walk past chained wrappers (a wrapper parented under another wrapper).
		while (current.parentId) {
			const parent = byId.get(current.parentId);
			if (!parent || !isOrgChartGroupWrapper(parent)) {
				return current.parentId;
			}
			current = parent;
		}
		return current.parentId;
	};
	return nodes
		.filter((node) => !isOrgChartGroupWrapper(node))
		.map((node) => ({ ...node, parentId: parentIdOf(node) }));
}
