/**
 * SmartArt DiagramML interpreter - `mode==='hanging'` renderer dispatch.
 *
 * Split out of `smartart-layout-interpreter-hierarchy.ts` (the file-size
 * budget): picks between the two renderers `mode==='hanging'` can reach.
 *
 * A FOREST (`roots.length > 1`, e.g. `square-accent-list`'s own top-level
 * `hierChild` fanning one `hierRoot` instance per top-level data node) is N
 * independent per-branch hanging columns under a fanned root row -
 * structurally different from `arrangeFullyHangingTree`'s single-tree/
 * single-column model (built for `hierarchy-list`'s own single-root shape) -
 * see `smartart-hierarchy-fanned-hang.ts`'s own module doc comment. Falls
 * back to the pre-existing single-column renderer whenever the fanned
 * geometry itself does not resolve (e.g. no declared `sibSp`/root aspect),
 * matching this arranger's pre-existing behaviour for every fixture that
 * reaches `mode==='hanging'` today.
 *
 * Pure geometry dispatch; no framework code, no DOM.
 */

import type {
	PptxSmartArtLayoutNode,
	PptxSmartArtLayoutNodeShape,
	PptxSmartArtNode,
	PptxSmartArtPresLayoutVars,
	SmartArtStyle,
} from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import type { TreeNode } from './smartart-helpers';
import type { CornerHangPlan } from './smartart-hierarchy-corner-plan';
import { arrangeFannedHangingForest } from './smartart-hierarchy-fanned-hang';
import { arrangeFullyHangingTree } from './smartart-hierarchy-hanging-arrange';
import type { BoundingBox, SmartArtLayoutResult } from './smartart-layout-types';

export function dispatchHangingMode(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	roots: TreeNode[],
	itemShape: PptxSmartArtLayoutNodeShape | undefined,
	connectorLabels: Map<string, string> | undefined,
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	index: ConstraintIndex,
	fontName: string | undefined,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	orgChart: boolean,
	cornerPlan: CornerHangPlan | undefined,
): SmartArtLayoutResult {
	if (roots.length > 1) {
		const fanned = arrangeFannedHangingForest(
			nodes,
			box,
			palette,
			style,
			elementId,
			roots,
			itemShape,
			connectorLabels,
			algorithmNode,
			index,
			fontName,
			presLayoutVars,
			orgChart,
		);
		if (fanned) {
			return fanned;
		}
	}
	return arrangeFullyHangingTree(
		nodes,
		box,
		palette,
		style,
		elementId,
		roots,
		itemShape,
		connectorLabels,
		algorithmNode,
		index,
		fontName,
		cornerPlan?.linDir,
		orgChart,
		presLayoutVars,
		cornerPlan?.side,
	);
}
