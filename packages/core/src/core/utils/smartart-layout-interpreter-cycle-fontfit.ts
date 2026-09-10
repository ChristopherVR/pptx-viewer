/**
 * SmartArt DiagramML interpreter - shared font-fit wiring for the `cycle`
 * arranger.
 *
 * Split out of `smartart-layout-interpreter-cycle.ts` (the repo's per-file
 * line budget).
 *
 * Round 18: `arrangeCycle` used to never call the shared font-fit at all, so
 * every item fell through `rectNode`/`circleNode`'s own `fontSizeOverride ??
 * fitFontSize(...)` fallback - a crude, un-derived `0.6 char-width` heuristic
 * capped at a literal 12px (9pt) ceiling, regardless of the diagram's real
 * declared `primFontSz`. Measured against the full gallery: dozens of
 * `cycle`/`pyramid`/hierarchy-family fixtures rendered a flat ~8-9pt for
 * cached sizes of 20-70pt. This wires the SAME shared fitter `lin`/`snake`
 * already use (`smartart-layout-interpreter-linear.ts`'s matching call) -
 * it degenerates to the single-tier case when no item folds a descendant
 * (the common case here), and folds correctly when one does (`basic-
 * cycle--hier5.pptx`'s "Node One\nNode Two has a longer label").
 */

import type { PptxSmartArtNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { foldedDescendantTexts } from './smartart-interpreter-drawing-bridge';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { resolveTieredItemFontSize } from './smartart-layout-item-font-tier';

/** Resolved shared root/descendant font size (px) for every ring + hub item. */
export interface CycleFontFit {
	fontSizeOverride: number;
	descendantSizePx: number;
}

export function resolveCycleFontFit(
	plan: ArrangementPlan,
	index: ConstraintIndex,
	ringNodes: PptxSmartArtNode[],
	hubNode: PptxSmartArtNode | undefined,
	ringNodeWidth: number,
	ringNodeHeight: number,
	hubWidth: number,
	hubHeight: number,
	cornerInsetPx: number,
	childrenOf: Map<string, PptxSmartArtNode[]> | undefined,
	fontName: string | undefined,
): CycleFontFit {
	const renderedIds = new Set(ringNodes.map((node) => node.id));
	if (hubNode) {
		renderedIds.add(hubNode.id);
	}
	const descendantTextsFor = (node: PptxSmartArtNode): readonly string[] =>
		childrenOf ? foldedDescendantTexts(node, renderedIds, childrenOf) : [];
	const fitItems = ringNodes.map((node) => ({
		rootText: node.text,
		descendantTexts: descendantTextsFor(node),
		width: ringNodeWidth,
		height: ringNodeHeight,
	}));
	if (hubNode) {
		fitItems.push({
			rootText: hubNode.text,
			descendantTexts: descendantTextsFor(hubNode),
			width: hubWidth,
			height: hubHeight,
		});
	}
	const { rootSizePx, descendantSizePx } = resolveTieredItemFontSize(
		plan,
		index,
		fitItems,
		fontName,
		undefined,
		cornerInsetPx,
	);
	return { fontSizeOverride: rootSizePx, descendantSizePx };
}
