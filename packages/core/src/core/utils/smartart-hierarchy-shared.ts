/**
 * SmartArt DiagramML interpreter - hierarchy arranger shared render context.
 *
 * The per-run render context and the rect/connector factories shared by the
 * standard/init tree placer (`smartart-hierarchy-standard.ts`) and the
 * hanging-column placer (`smartart-hierarchy-hanging.ts`). Org-chart tree
 * shaping (assistant partitioning, group-wrapper flattening, effective
 * width) lives in `smartart-hierarchy-orgchart-tree.ts` (split out for the
 * file-size budget). Pure geometry; no framework code, no DOM.
 */

import type {
	PptxSmartArtLayoutNode,
	PptxSmartArtLayoutNodeShape,
	PptxSmartArtNode,
	SmartArtStyle,
} from '../types';
import { resolveHierarchyItemNode } from './smartart-hierarchy-item-template';
import { presetBoxNode } from './smartart-layout-interpreter-preset-node';
import { styleContext } from './smartart-layout-interpreter-render';
import type { StyleContext } from './smartart-layout-interpreter-render';
import type { RenderedConnector, RenderedNode } from './smartart-layout-types';

/**
 * Find the actual per-node preset geometry a hierarchy item box should carry.
 *
 * Every genuine org-chart-family item is itself a small `composite` (a
 * genuine fixture's `rootComposite` -> `rootText` (`alg="tx"`, the real
 * `dgm:shape` - e.g. `rect`) + `rootConnector` (`alg="sp"`, a hidden spacer)):
 * this arranger renders that whole per-node composite as ONE box, so the
 * preset that must reach the save-pipeline bridge
 * (`smartart-interpreter-drawing-bridge.ts`) is the `tx`-algorithm
 * descendant's own shape, not the wrapping `composite` node's (which never
 * declares a `@type`, only `hierRoot`/`hierChild`'s first child directly).
 * Depth-first, first `tx` node with a shape wins - UNLESS a second `tx`+shape
 * template exists that cross-references the first one's own dimension by
 * name, in which case the cross-referencing (majority-generation) template
 * wins instead - see `resolveHierarchyItemNode`'s own module doc comment in
 * `smartart-hierarchy-item-template.ts`. `undefined` when the arranger's item
 * template declares no shape anywhere (falls back to `presetBoxNode`'s own
 * family default).
 */
export function findHierarchyItemShape(
	node: PptxSmartArtLayoutNode | undefined,
): PptxSmartArtLayoutNodeShape | undefined {
	return resolveHierarchyItemNode(node)?.shape;
}

/**
 * The item template's own layoutNode NAME (e.g. `level1Shape`, `rootText1`)
 * - the SAME node `findHierarchyItemShape` finds, but its `name` rather than
 * its `shape`. SESSION 24: used to search a `ConstraintIndex` for a
 * generation-gap `sp` constraint declared on an ANCESTOR of `hierChild`
 * (see `resolveGenerationGapFromIndex`'s own doc comment in `smartart-
 * hierarchy-generation-gap.ts`) that references this exact name - a
 * constraint reachable only by name, not by tree position.
 */
export function findHierarchyItemName(
	node: PptxSmartArtLayoutNode | undefined,
): string | undefined {
	return resolveHierarchyItemNode(node)?.name;
}

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

/**
 * Extra vertical gap between consecutive hanging-tail boxes, as a fraction of
 * the item's own height (`HangingOptions.vGap` in `smartart-hierarchy-
 * hanging.ts`, and `arrangeHierarchy`'s own `vGap` setup in
 * `smartart-layout-interpreter-hierarchy.ts`). Also consumed by `fitItemBox`
 * (`smartart-hierarchy-orientation.ts`) to size the item box AROUND the
 * generation-axis room a hanging tail will actually need - see
 * `smartart-hierarchy-hang-depth.ts`'s module doc comment for the
 * COM-verified derivation (`organization-chart--hier5.pptx`/`--hier8.pptx`).
 */
export const HANG_HEIGHT_RATIO = 0.55;

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
	/** The item template's own preset override; see {@link findHierarchyItemShape}. */
	itemShape?: PptxSmartArtLayoutNodeShape;
	/**
	 * ONE shared font size (pixels), pre-fit across every node's text at the
	 * uniform `boxW`/`boxH` this run places every item at - see
	 * `smartart-layout-interpreter-hierarchy.ts`'s `resolveHierarchyItemFontSizePx`
	 * doc comment for why this must be resolved BEFORE any node is pushed.
	 * `undefined` (no `algorithmNode`, or nothing fits) keeps `pushNode`'s
	 * previous behaviour: `presetBoxNode`'s own crude per-node char-width
	 * fallback.
	 */
	itemFontSizePx?: number;
}

export function baseContext(
	nodeCount: number,
	elementId: string,
	palette: string[],
	style: SmartArtStyle,
	boxW: number,
	boxH: number,
	connectorLabels?: Map<string, string>,
	itemShape?: PptxSmartArtLayoutNodeShape,
	itemFontSizePx?: number,
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
		itemShape,
		itemFontSizePx,
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
		presetBoxNode({
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
			shape: hc.itemShape,
			fallbackKind: 'rect',
			fontSizeOverride: hc.itemFontSizePx,
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
