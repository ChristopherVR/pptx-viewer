/**
 * SmartArt DiagramML interpreter - the declared "corner-anchored hierarchy"
 * arrangement mode (`hierAlign="tL"/"tR"`).
 *
 * `hierarchy-list--hier5.pptx` declares a hierarchy whose root gets its own
 * distinctly-sized item template (`smartart-hierarchy-generation-templates.ts`)
 * and whose children hang in a single vertical column sharing the root's own
 * edge (`smartart-hierarchy-hanging.ts`'s `HangingOptions.columnAlign`) -
 * genuinely different from both the plain fanning "Hierarchy" family
 * (`hierAlign` absent from any nested `hierRoot`) and the centred-on-children
 * "Horizontal Hierarchy" family (`hierAlign="lCtrCh"/"rCtrCh"`, a REAL fanned
 * tree oriented sideways, which must keep using the `std`/`tailed` fan
 * machinery unchanged - see `smartart-hierarchy-dispatch-lindir.ts`'s own
 * module doc comment for why the OUTERMOST `linDir` alone cannot tell these
 * apart, and `smartart-track-r-successor.md`'s SESSION 34/36/37 sections for
 * the full corpus derivation).
 *
 * `resolveCornerHangPlan` is the single gate deciding whether a hierarchy
 * arrangement is this declared construct - narrow and structural, not a
 * per-layout name check, so it reaches every future layoutDef sharing the
 * SAME three properties without special-casing `hierarchy-list` by name:
 *
 *   1. the tree's own root item declares `hierAlign="tL"`/`"tR"` (never
 *      `lCtrCh`/`rCtrCh`/`lT`/`rT`/... - those describe a root CENTRED on a
 *      real fan, not a single hanging column);
 *   2. root's own nested `hierChild` (the "children of root" generation)
 *      declares a VERTICAL `linDir` (`fromT`/`fromB` - "this generation runs
 *      top-to-bottom", i.e. a single column, not a horizontal fan);
 *   3. the layout declares a genuinely distinct root-vs-descendant item size
 *      (`resolveHierarchyGenerationTemplates`'s own `root` entry) - without
 *      this, `arrangeFullyHangingTree`'s existing single-size hanging column
 *      has no COM-verified fit for this exact corner-anchored shape, so
 *      falling through to the pre-existing `std` path is the safer default
 *      (every corpus fixture NOT hierarchy-list currently satisfies (1)+(2)
 *      without (3): `square-accent-list`/`titled-picture-accent-list`, kept
 *      on their existing `std` path unchanged by this gate).
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtPresLayoutVars } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import {
	resolveHierarchyDispatchChAlign,
	resolveHierarchyDispatchLinDir,
	resolveHierarchyRootAlign,
} from './smartart-hierarchy-dispatch-lindir';
import { resolveHierarchyGenerationTemplates } from './smartart-hierarchy-generation-templates';

export interface CornerHangPlan {
	/** The nested `hierChild`'s own `linDir` (`fromT`/`fromB`) - feeds `branchMode`. */
	linDir: string;
	/** `right`: every row shares the column's RIGHT edge (`chAlign="l"`, COM-verified); `left`: mirrored (`chAlign="r"`). */
	side: 'left' | 'right';
}

const CORNER_HIER_ALIGN = new Set(['tL', 'tR']);
const VERTICAL_LIN_DIR = new Set(['fromT', 'fromB']);

/** See the module doc comment. `undefined` unless all three conditions hold. */
export function resolveCornerHangPlan(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	index: ConstraintIndex,
): CornerHangPlan | undefined {
	if (!algorithmNode) {
		return undefined;
	}
	const hierAlign = resolveHierarchyRootAlign(algorithmNode, nodeCount, presLayoutVars);
	if (!hierAlign || !CORNER_HIER_ALIGN.has(hierAlign)) {
		return undefined;
	}
	const linDir = resolveHierarchyDispatchLinDir(algorithmNode, nodeCount, presLayoutVars);
	if (!linDir || !VERTICAL_LIN_DIR.has(linDir)) {
		return undefined;
	}
	const templates = resolveHierarchyGenerationTemplates(algorithmNode, index);
	if (!templates?.root) {
		return undefined;
	}
	const chAlign = resolveHierarchyDispatchChAlign(algorithmNode, nodeCount, presLayoutVars);
	return { linDir, side: chAlign === 'r' ? 'left' : 'right' };
}
