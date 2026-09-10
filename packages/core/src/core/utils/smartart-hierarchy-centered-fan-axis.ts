/**
 * SmartArt DiagramML interpreter - the declared "centred-on-children,
 * axis-swapped" hierarchy arrangement mode (`hierAlign="lCtrCh"/"rCtrCh"`).
 *
 * `horizontal-labeled-hierarchy--hier5.pptx` (and any layoutDef sharing the
 * same structural shape) declares a REAL fanned hierarchy tree - the SAME
 * `std`-mode fan/generation MACHINERY as the plain "Hierarchy" family (a
 * parent centred over the span of its own children - `placeStandardTree`'s
 * own existing default behaviour, `cx = (xOffset + spanW / 2) * cellW`) -
 * but rendered with the fan and generation axes SWAPPED: generations run
 * left-to-right (not top-to-bottom), and each generation's own siblings fan
 * top-to-bottom (not side-to-side).
 *
 * COM-verified against the cached drawing: three GENERATION columns at
 * x=53/372/691 (an 867-wide box), each generation's own siblings fanned
 * along y (a 533-tall box) - `Node One` (the sole gen-0 root) sits
 * vertically CENTRED on the y-span its two gen-1 children (`Node Two`/
 * `Node Three`, y=264/395) occupy, exactly matching `placeStandardTree`'s
 * own "parent centred over its fan" behaviour, rotated 90 degrees. Before
 * this module existed, the interpreter placed this tree with the un-swapped
 * axes (generations stacking Y, siblings fanning X) - a structurally
 * coherent but WRONG tree shape, `maxDeltaFraction` 0.4787.
 *
 * Distinct from BOTH the plain fanning family (no `hierAlign` declared at
 * all - X is already the fan axis, no swap needed) and the "Horizontal
 * Hierarchy" family (`resolveHierarchyOrientation`'s own `transposed`
 * branch, triggered by an UNSCOPED `sibSp refType="h"` - a genuinely
 * different declared shape whose own margin/aspect ratios are calibrated
 * for ITS OWN simple, directly-declared `w`/`h`/`sibSp` constraint set, not
 * this family's font-driven, autofit item sizing): this construct keeps the
 * STD branch's own ratio/margin resolution entirely unchanged (its own item
 * SIZE is already close to correct under that resolution, measured: a
 * 3.2%/3.7% w/h residual, versus 38-48% x/y residuals from the wrong axis
 * assignment alone) and swaps ONLY the two axes' final placement, via the
 * SAME `effectiveBox`-swap + `transposeResult` post-pass `arrangeHierarchy`
 * already runs for `orientation.transposed`, for the unrelated reason above.
 *
 * `hierarchyDeclaresCenteredFanAxisSwap` is the gate: narrow and
 * structural, not a per-layout name check, mirroring `resolveCornerHangPlan`'s
 * own two-part discipline (`smartart-hierarchy-corner-plan.ts`):
 *
 *   1. the tree's own root item declares `hierAlign="lCtrCh"`/`"rCtrCh"`
 *      (never `tL`/`tR` - the corner-anchored single-column construct that
 *      module owns - or absent, the plain fanning family, already correctly
 *      on the X-fan axis with no swap needed);
 *   2. root's own nested `hierChild` (the "children of root" generation)
 *      declares a VERTICAL `linDir` (`fromT`/`fromB` - "this generation
 *      runs top-to-bottom", i.e. the fan axis this construct swaps onto Y).
 *
 * No third "distinct root template" gate (unlike `resolveCornerHangPlan`'s
 * own gate 3): this construct's root uses the SAME item template as every
 * other generation (`horizontal-labeled-hierarchy--hier5.pptx`'s own
 * `level1Shape`/`level2Shape` are structurally identical plain `tx` leaves,
 * sized entirely by autofit, no distinct root size declared) -
 * `resolveHierarchyGenerationTemplates` correctly returns no `root` entry
 * for it, so gating on that would wrongly EXCLUDE this construct rather
 * than include it.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtPresLayoutVars } from '../types';
import {
	resolveHierarchyDispatchLinDir,
	resolveHierarchyRootAlign,
} from './smartart-hierarchy-dispatch-lindir';

const CENTERED_FAN_HIER_ALIGN = new Set(['lCtrCh', 'rCtrCh']);
const VERTICAL_LIN_DIR = new Set(['fromT', 'fromB']);

/** See the module doc comment. `true` only when both conditions hold. */
export function hierarchyDeclaresCenteredFanAxisSwap(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): boolean {
	if (!algorithmNode) {
		return false;
	}
	const hierAlign = resolveHierarchyRootAlign(algorithmNode, nodeCount, presLayoutVars);
	if (!hierAlign || !CENTERED_FAN_HIER_ALIGN.has(hierAlign)) {
		return false;
	}
	const linDir = resolveHierarchyDispatchLinDir(algorithmNode, nodeCount, presLayoutVars);
	return linDir !== undefined && VERTICAL_LIN_DIR.has(linDir);
}
