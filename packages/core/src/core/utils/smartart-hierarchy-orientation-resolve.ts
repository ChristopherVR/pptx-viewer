/**
 * SmartArt DiagramML interpreter - resolve `arrangeHierarchy`'s own
 * orientation + effective (possibly axis-swapped) box, one call site.
 *
 * Split out of `smartart-layout-interpreter-hierarchy.ts` (the file-size
 * budget): `orientation.transposed` ("Horizontal Hierarchy" and its
 * siblings - see `smartart-hierarchy-orientation.ts`'s own module doc
 * comment) AND the SEPARATE `axisSwapped` construct (`hierAlign="lCtrCh"/
 * "rCtrCh"`, see `smartart-hierarchy-centered-fan-axis.ts`) both run the
 * WHOLE std/tailed placement algorithm against a box with width/height
 * swapped, then map the result back at the very end (`transposeResult`):
 * the fan axis is always "X"/`cellW`/`boxW`'s own width and the generation
 * axis always "Y" from `placeStandardTree`'s own point of view, whichever
 * real screen axis that maps to. They differ only in WHICH ratios size the
 * item: `orientation.transposed` also switches `resolveHierarchyOrientation`'s
 * own margin/aspect formula; `axisSwapped` alone leaves that formula on the
 * STD branch throughout, only re-deriving the axis-relative fields
 * `adjustOrientationForAxisSwap` names (see its own doc comment).
 *
 * Pure geometry; no framework code, no DOM.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtPresLayoutVars } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { adjustOrientationForAxisSwap } from './smartart-hierarchy-axis-swap-orientation';
import { hierarchyDeclaresCenteredFanAxisSwap } from './smartart-hierarchy-centered-fan-axis';
import { resolveHierarchyOrientation } from './smartart-hierarchy-orientation';
import type { HierarchyOrientation } from './smartart-hierarchy-orientation-types';
import { findHierarchyItemName } from './smartart-hierarchy-shared';
import type { BoundingBox } from './smartart-layout-types';

export interface HierarchyEffectiveOrientation {
	orientation: HierarchyOrientation;
	/** `true` when this arranger runs against `effectiveBox` and needs a final `transposeResult` pass. */
	swapAxes: boolean;
	/** `{width: box.height, height: box.width}` when `swapAxes`, `box` unchanged otherwise. */
	effectiveBox: BoundingBox;
}

/** See the module doc comment. */
export function resolveHierarchyEffectiveOrientation(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	index: ConstraintIndex,
	mode: 'std' | 'tailed' | 'hanging',
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	box: BoundingBox,
): HierarchyEffectiveOrientation {
	const itemShapeName = findHierarchyItemName(algorithmNode);
	const stdOrientation = resolveHierarchyOrientation(algorithmNode, index, mode, itemShapeName);
	const axisSwapped = hierarchyDeclaresCenteredFanAxisSwap(
		algorithmNode,
		nodeCount,
		presLayoutVars,
	);
	const orientation = axisSwapped
		? adjustOrientationForAxisSwap(stdOrientation, algorithmNode, index, itemShapeName)
		: stdOrientation;
	const swapAxes = orientation.transposed || axisSwapped;
	return {
		orientation,
		swapAxes,
		effectiveBox: swapAxes
			? { width: box.height, height: box.width }
			: { width: box.width, height: box.height },
	};
}
