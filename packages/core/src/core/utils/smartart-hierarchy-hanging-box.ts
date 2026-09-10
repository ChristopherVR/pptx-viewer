/**
 * SmartArt DiagramML interpreter - `mode==='hanging'` box sizing, derived
 * from the layoutDef's own declared constraints.
 *
 * `arrangeFullyHangingTree` (`smartart-hierarchy-hanging.ts`) used to size
 * EVERY row with a fixed, container-relative guess (`min(w*0.42,160)` /
 * `min(h*0.16,30)`, evidently calibrated against some other, unrecorded
 * fixture - see `smartart-track-r-successor.md`'s SESSION 34 section).
 * Measured against `hierarchy-list--hier5.pptx` (`867x533` box, 4 stacked
 * rows): that guess gives `160x30`, the cached drawing's own descendant row
 * (`childText`) is `179x112` - almost 4x too short. This module replaces the
 * guess with a real fit-to-box solve.
 *
 * ## The equation
 *
 * `placeHangingForest`/`placeHangingTree` stack `rows` boxes in one column,
 * `vGap` apart, so the whole column's height is `rows*itemH +
 * (rows-1)*vGap`. The layout's own declared row gap
 * (`resolveHangingRowGapRatio`, a `dgm:constr type="sibSp"` referencing the
 * descendant item's own height - e.g. `hierarchy-list--hier5.pptx`'s
 * `sibSp for="des" forName="childShape" refType="h" refFor="des"
 * refForName="childText" fact="0.25"`) expresses `vGap` as a RATIO of the
 * descendant row's own height, and a genuinely root-sized first row
 * (`HierarchyGenerationTemplates.root`, see `smartart-hierarchy-generation-
 * templates.ts`) contributes `heightFactor` row-heights instead of `1`.
 * Substituting both into the column-height equation and solving for the
 * descendant row's own height (the free scale variable) against the box's
 * real pixel height:
 *
 * ```
 * boxH = box.height / (rootHeightFactor + (rows - 1) * (1 + vGapRatio))
 * ```
 *
 * (`rootHeightFactor` defaults to `1`, i.e. no distinct root template - the
 * equation degrades to the plain `rows*(1+vGapRatio) - vGapRatio`
 * denominator.) `boxW` follows from the descendant template's own declared
 * `h:w` aspect (`resolveConstraint`-derived, not the narrower self-
 * referential `resolveAspectRatio`: `hierarchy-list--hier5.pptx`'s own
 * `childText` aspect is declared entirely via cross-references to
 * `rootComposite`, which `resolveAspectRatio`'s self-reference-only search
 * cannot read at all).
 *
 * COM-verified against `hierarchy-list--hier5.pptx`'s own cached drawing:
 * `boxH = 533 / (1 + 3*1.25) = 112.21` against cached `childText.h=112`;
 * `boxW = 112.21 / 0.625 = 179.5` against cached `childText.w=179`; the
 * root's own box (`widthFactor=1.25, heightFactor=1` from
 * `resolveHierarchyGenerationTemplates`) gives `224.4x112.21` against cached
 * `rootText`/`rootComposite`'s `224x112` - all within a pixel of rounding,
 * from nothing but the layout's own declared ratios. (Positioning - this
 * fixture's cached drawing anchors the tree at a corner and cascades
 * children down a FIXED x, not `placeHangingTree`'s own left-to-right column
 * indent - remains a separate, unimplemented arrangement mode; see
 * `smartart-track-r-successor.md`'s SESSION 34 section. This module only
 * fixes how big each row is, not where the column sits.)
 *
 * Falls back to the pre-existing ad-hoc ratios whenever the layout's item
 * template declares no resolvable `w`/`h` (every layoutDef this module
 * cannot yet reach a declared size for) - zero behaviour change there, and
 * for `rows < 1`.
 *
 * Pure geometry/constraint reading; no framework code.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtPresLayoutVars } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { resolveConstraint } from './smartart-constraint-solver';
import { resolveHierarchyGenerationTemplates } from './smartart-hierarchy-generation-templates';

/** Legacy ad-hoc fallback ratios (SESSION 28), used only when no declared item-template size resolves. */
const FALLBACK_BOX_W_RATIO = 0.42;
const FALLBACK_BOX_W_MAX = 160;
const FALLBACK_BOX_H_RATIO = 0.16;
const FALLBACK_BOX_H_MAX = 30;

/** `sibSp` row-gap fallback ratio (fraction of the descendant item's own height) when undeclared. */
const DEFAULT_HANGING_VGAP_RATIO = 0.55;

export interface HangingBoxFit {
	/** Descendant (every generation but a distinctly-templated root) row size. */
	boxW: number;
	boxH: number;
	/** Root's own row size, only when the layout declares a genuinely different one - see `resolveHierarchyGenerationTemplates`. */
	rootBoxW?: number;
	rootBoxH?: number;
	/** Row-to-row gap in px, for `placeHangingForest`'s own `vGap`. */
	vGap: number;
}

/**
 * The declared row-gap ratio (`sibSp` referencing the descendant item's own
 * height), or `undefined` when the layout declares none - see the module
 * doc comment.
 */
function resolveRowGapRatio(
	constraints: PptxSmartArtLayoutNode['constraints'],
	descendantName: string,
): number | undefined {
	const sibSp = (constraints ?? []).find(
		(c) =>
			c.type === 'sibSp' &&
			c.referenceType === 'h' &&
			c.referenceForName === descendantName &&
			typeof c.factor === 'number',
	);
	return sibSp?.factor;
}

/**
 * Fit the hanging tree's row size to `box`, deriving every ratio from
 * `algorithmNode`'s own declared constraints where possible. `rows` is the
 * number of stacked item rows the caller's own placement pass will actually
 * produce (current `placeHangingForest`/`placeHangingTree` recursion: one
 * row per data node - folding deeper generations, as the `std`/`tailed`
 * branches already do via `hierarchyLeafFoldsDescendants`, is not yet
 * modelled for this mode).
 */
export function fitHangingBox(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	index: ConstraintIndex,
	w: number,
	h: number,
	rows: number,
	nodeCount = 0,
	presLayoutVars?: PptxSmartArtPresLayoutVars,
): HangingBoxFit {
	const fallbackBoxH = Math.min(h * FALLBACK_BOX_H_RATIO, FALLBACK_BOX_H_MAX);
	const fallback: HangingBoxFit = {
		boxW: Math.min(w * FALLBACK_BOX_W_RATIO, FALLBACK_BOX_W_MAX),
		boxH: fallbackBoxH,
		vGap: fallbackBoxH * DEFAULT_HANGING_VGAP_RATIO,
	};
	if (!algorithmNode || rows < 1) {
		return fallback;
	}
	const templates = resolveHierarchyGenerationTemplates(
		algorithmNode,
		index,
		nodeCount,
		presLayoutVars,
	);
	if (!templates) {
		return fallback;
	}
	const { descendant, root } = templates;
	const descW = resolveConstraint(index, descendant.name, 'w');
	const descH = resolveConstraint(index, descendant.name, 'h');
	if (descW === undefined || descH === undefined || !(descW > 0) || !(descH > 0)) {
		return fallback;
	}
	const aspect = descH / descW; // h:w
	if (!(aspect > 0)) {
		return fallback;
	}
	const constraints = algorithmNode.allConstraints ?? algorithmNode.constraints;
	const vGapRatio = resolveRowGapRatio(constraints, descendant.name) ?? DEFAULT_HANGING_VGAP_RATIO;
	const rootHeightFactor = root?.heightFactor ?? 1;
	const denom = rootHeightFactor + (rows - 1) * (1 + vGapRatio);
	if (!(denom > 0)) {
		return fallback;
	}
	const boxH = h / denom;
	const boxW = boxH / aspect;
	if (!(boxW > 0) || !(boxH > 0)) {
		return fallback;
	}
	const result: HangingBoxFit = { boxW, boxH, vGap: boxH * vGapRatio };
	if (root) {
		result.rootBoxW = boxW * root.widthFactor;
		result.rootBoxH = boxH * root.heightFactor;
	}
	return result;
}
