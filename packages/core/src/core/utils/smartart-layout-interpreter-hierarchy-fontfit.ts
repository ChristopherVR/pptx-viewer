/**
 * SmartArt DiagramML interpreter - hierarchy (`hierRoot` / `hierChild`)
 * font-fit.
 *
 * Split out of `smartart-layout-interpreter-hierarchy.ts` (the repo's
 * per-file line budget).
 *
 * ONE shared font size (pixels) across every node's own text, pre-fit at the
 * uniform `boxW`/`boxH` a hierarchy run places every item at - the SAME
 * "unwired `fitFontSize`-fallback" bug class `smartart-layout-interpreter-
 * cycle-fontfit.ts`'s doc comment names, closed generally for `cycle`/
 * `composite`/`pyramid` in round 18: `smartart-hierarchy-shared.ts`'s
 * `pushNode` called `presetBoxNode` with no `fontSizeOverride` at all, so
 * EVERY hierarchy item in the whole gallery fell through to `rectNode`'s
 * crude, un-derived `fitFontSize(text, width*0.9, height, 12)` fallback (a
 * flat ~9pt floor, confirmed via the round-19 corpus font-bucket scan:
 * `organization-chart`/`hierarchy`/`horizontal-hierarchy`/`picture-
 * organization-chart`, 9 of the gallery's `hierarchy`-plan fixtures, all
 * pegged at 12px regardless of their real cached size). Deliberately keyed
 * off `algorithmNode` itself (not `itemNode(plan.node)`'s first-child
 * heuristic) - `nodeFontBounds`'s own `findFontRoleNode` DFS already walks
 * past the per-node `composite`/`tx` wrapper `findHierarchyItemShape`
 * documents to the real text role, the same way `arrangeText` passes its own
 * one-level-shallower `plan.node` directly (see that module's round-18 doc
 * comment). No descendant folding: unlike `lin`/`snake`, a hierarchy child is
 * always its OWN separate box at the next generation, never folded into a
 * parent's text - `descendantTexts` is always `[]`. Returns `undefined`
 * (keeping `pushNode`'s previous fallback) when there is no `algorithmNode`
 * (a plan this interpreter cannot resolve constraints against) or no
 * text-bearing node to fit at all.
 *
 * Known residual (not fixed this round): this resolves ONE size for the
 * WHOLE tree, fit against the fanned generation's own `boxW`/`boxH` - real
 * PowerPoint gives an unaccented/leaf row a LARGER font than an accented row
 * sharing its slot with other content (the same per-row differentiation
 * `arrangePyramid`'s own round-19 residual shows), which a single shared size
 * cannot reproduce exactly. Measured as a real, large reduction in the
 * average FONT delta across the `hierarchy`-plan fixtures (not an exact
 * match) - see `smartart-track-l-successor.md`'s round 19 section.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { resolveTieredItemFontSize } from './smartart-layout-item-font-tier';

/** See the module doc comment. */
export function resolveHierarchyItemFontSizePx(
	nodes: readonly PptxSmartArtNode[],
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	index: ConstraintIndex,
	boxW: number,
	boxH: number,
	fontName: string | undefined,
): number | undefined {
	if (!algorithmNode) {
		return undefined;
	}
	const textNodes = nodes.filter((node) => node.text && node.text.trim().length > 0);
	if (textNodes.length === 0) {
		return undefined;
	}
	const plan: ArrangementPlan = { kind: 'hierarchy', node: algorithmNode };
	const { rootSizePx } = resolveTieredItemFontSize(
		plan,
		index,
		textNodes.map((node) => ({
			rootText: node.text,
			descendantTexts: [],
			width: boxW,
			height: boxH,
		})),
		fontName,
		undefined,
		0,
		algorithmNode,
	);
	return rootSizePx;
}
