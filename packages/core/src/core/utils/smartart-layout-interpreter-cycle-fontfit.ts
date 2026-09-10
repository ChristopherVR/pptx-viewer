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
 *
 * Round 36: a `ctrShpMap="fNode"` hub was still being forced into the SAME
 * joint fit as the ring items (one `fitItems` array, one binary search), so
 * the hub's font size was capped at whatever size the SMALLER ring boxes
 * could fit - never its own, usually much bigger, box. A corpus-wide scan of
 * every hub-bearing cycle fixture's own CACHED drawing (`l36-hub-font-scan.ts`,
 * scratchpad) shows the hub's real font size is ALWAYS independently larger
 * than the ring items' (`basic-radial--hier5.pptx`: hub 50.7pt vs ring 28pt;
 * `converging-radial--hier5.pptx`: 66.7pt vs 38.7pt; `radial-venn--hier5.pptx`:
 * 86.7pt vs 24pt; `radial-cluster--hier5.pptx`: 36pt vs 13.3pt; 8 more
 * fixtures, same pattern, zero counterexamples) - PowerPoint fits the hub to
 * ITS OWN box, never jointly with the ring. Fixed generally (every
 * hub-bearing cycle fixture, not a `radial-cluster` special case): the hub
 * now gets its own {@link resolveTieredItemFontSize} call, against its own
 * box only. A ring-less cycle (`hubNode` undefined, the majority of the
 * family) is byte-identical to before this round: the ring-only branch below
 * is unchanged.
 */

import type { PptxSmartArtNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { foldedDescendantTexts } from './smartart-interpreter-drawing-bridge';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { resolveTieredItemFontSize } from './smartart-layout-item-font-tier';

/** Resolved root/descendant font size (px) for the ring items, plus the hub's own (when one is present). */
export interface CycleFontFit {
	fontSizeOverride: number;
	descendantSizePx: number;
	/** The hub's own, independently-fit root size (px) - see the module doc comment's Round 36 note. `undefined` when there is no hub. */
	hubFontSizeOverride?: number;
	/** The hub's own, independently-fit descendant size (px). `undefined` when there is no hub. */
	hubDescendantSizePx?: number;
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
	const ringFitItems = ringNodes.map((node) => ({
		rootText: node.text,
		descendantTexts: descendantTextsFor(node),
		width: ringNodeWidth,
		height: ringNodeHeight,
	}));
	const { rootSizePx, descendantSizePx } = resolveTieredItemFontSize(
		plan,
		index,
		ringFitItems,
		fontName,
		undefined,
		cornerInsetPx,
	);
	if (!hubNode) {
		return { fontSizeOverride: rootSizePx, descendantSizePx };
	}
	// The hub fits its OWN box independently of the ring items' shared size -
	// see the module doc comment's Round 36 corpus derivation.
	const hubFitItems = [
		{
			rootText: hubNode.text,
			descendantTexts: descendantTextsFor(hubNode),
			width: hubWidth,
			height: hubHeight,
		},
	];
	const hubFit = resolveTieredItemFontSize(
		plan,
		index,
		hubFitItems,
		fontName,
		undefined,
		cornerInsetPx,
	);
	return {
		fontSizeOverride: rootSizePx,
		descendantSizePx,
		hubFontSizeOverride: hubFit.rootSizePx,
		hubDescendantSizePx: hubFit.descendantSizePx,
	};
}
