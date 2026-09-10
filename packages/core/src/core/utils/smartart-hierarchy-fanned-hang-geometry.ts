/**
 * SmartArt DiagramML interpreter - geometry resolution for the "fanned root
 * row, N independent per-branch hanging columns" hierarchy construct.
 *
 * Split out of `smartart-hierarchy-fanned-hang.ts` (the file-size budget):
 * `resolveFannedHangGeometry` alone, so the placement/entry-point half stays
 * under 300 LOC. See that module's own doc comment for the full derivation
 * (COM-verified against all three `square-accent-list` samples):
 *
 * ```
 * rootW = box.width / (N + (N - 1) * sibSpRatio)
 * gap   = sibSpRatio * rootW
 * rootH = rootW / rootAspect            // rootAspect from the root template's own unit-space w/h
 * descH = rootH / heightFactor          // heightFactor from resolveHierarchyGenerationTemplates, reliable
 * descW = descWidthFraction * rootW     // descWidthFraction from resolveConstraint on the descendant name
 * ```
 *
 * Pure geometry/constraint reading; no framework code, no DOM.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtPresLayoutVars } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { resolveConstraint } from './smartart-constraint-solver';
import { resolveHierarchyDispatchChAlign } from './smartart-hierarchy-dispatch-lindir';
import { resolveHierarchyGenerationTemplates } from './smartart-hierarchy-generation-templates';
import type { BoundingBox } from './smartart-layout-types';

/** Fan gap ratio (fraction of the root box's own width) when the layout declares no `sibSp`. */
const DEFAULT_SIB_SP_RATIO = 0.05;
/** Descendant width, as a fraction of the root's own width, when no declared fraction resolves. */
const DEFAULT_DESC_WIDTH_FRACTION = 0.85;

export interface FannedHangGeometry {
	rootW: number;
	rootH: number;
	descW: number;
	descH: number;
	gap: number;
	side: 'left' | 'right';
	/** `true` when the outer fan runs right-to-left (`linDir="fromR"`) - mirrors the root row. */
	reversed: boolean;
}

/** First declared `sibSp` ratio in `algorithmNode`'s own constraint list, or the calibrated default. */
function resolveSibSpRatio(algorithmNode: PptxSmartArtLayoutNode): number {
	const constraints = algorithmNode.allConstraints ?? algorithmNode.constraints ?? [];
	const sibSp = constraints.find((c) => c.type === 'sibSp' && typeof c.factor === 'number');
	return sibSp?.factor ?? DEFAULT_SIB_SP_RATIO;
}

/**
 * Resolve this construct's own geometry from `algorithmNode`'s declared
 * constraints - see the module doc comment. `undefined` when the layout
 * declares no root/descendant template split, or the root's own aspect does
 * not resolve to a usable box (the caller falls back to
 * `arrangeFullyHangingTree` in either case).
 */
export function resolveFannedHangGeometry(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	index: ConstraintIndex,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	branchCount: number,
	box: BoundingBox,
): FannedHangGeometry | undefined {
	if (!algorithmNode || branchCount < 1) {
		return undefined;
	}
	const templates = resolveHierarchyGenerationTemplates(
		algorithmNode,
		index,
		nodeCount,
		presLayoutVars,
	);
	if (!templates?.root) {
		return undefined;
	}
	const rootW_ = resolveConstraint(index, templates.root.name, 'w');
	const rootH_ = resolveConstraint(index, templates.root.name, 'h');
	if (rootW_ === undefined || rootH_ === undefined || !(rootW_ > 0) || !(rootH_ > 0)) {
		return undefined;
	}
	const rootAspect = rootW_ / rootH_;
	if (!(rootAspect > 0)) {
		return undefined;
	}
	const sibSpRatio = resolveSibSpRatio(algorithmNode);
	const rootW = box.width / (branchCount + (branchCount - 1) * sibSpRatio);
	const rootH = rootW / rootAspect;
	if (!(rootW > 0) || !(rootH > 0)) {
		return undefined;
	}
	const heightFactor = templates.root.heightFactor;
	const descH = heightFactor > 0 ? rootH / heightFactor : rootH;
	const descWidthFraction = resolveConstraint(index, templates.descendant.name, 'w');
	const descW =
		(descWidthFraction !== undefined && descWidthFraction > 0 && descWidthFraction <= 1.5
			? descWidthFraction
			: DEFAULT_DESC_WIDTH_FRACTION) * rootW;
	const chAlign = resolveHierarchyDispatchChAlign(algorithmNode, nodeCount, presLayoutVars);
	const linDir = algorithmNode.algorithm?.parameters?.find((p) => p.type === 'linDir')?.value;
	return {
		rootW,
		rootH,
		descW,
		descH,
		gap: sibSpRatio * rootW,
		side: chAlign === 'r' ? 'right' : 'left',
		reversed: linDir === 'fromR',
	};
}
