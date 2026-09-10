/**
 * SmartArt DiagramML interpreter - shared font-fit wiring for the
 * `composite` arranger.
 *
 * Split out of `smartart-layout-interpreter-composite.ts` (the repo's
 * per-file line budget).
 *
 * Round 18: a `composite` arranger used to never call the shared font-fit
 * at all - every item fell through `rectNode`'s own `fontSizeOverride ??
 * fitFontSize(text, width*0.9, height, 12)` fallback, a crude, un-derived
 * `0.6` char-width heuristic capped at a literal 12px (9pt) regardless of
 * the diagram's real declared `primFontSz`. Measured against the full
 * gallery: dozens of `hierarchy`/`organization-chart`/`pyramid`-family
 * fixtures rendered a flat ~8-9pt for cached sizes of 20-70pt. This wires
 * the SAME shared fitter `lin`/`snake`/`cycle` already use, with an
 * explicit `fontRoleNode` (the first resolved slot's own layoutNode) since
 * `itemFontBoundsPx`'s `itemNode(plan.node)` first-child heuristic does not
 * apply to a composite's own slot structure (see `smartart-layout-item-
 * font-tier.ts`'s `fontRoleNode` parameter doc).
 */

import type { PptxSmartArtLayoutNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import type { SelfDesPair } from './smartart-layout-interpreter-composite-pairs';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { resolveTieredItemFontSize } from './smartart-layout-item-font-tier';

/** What a shared font-fit computation needs from the caller; see `resolveSharedFontFit`. */
export interface FontFitContext {
	plan: ArrangementPlan;
	index: ConstraintIndex;
	fontName: string | undefined;
}

/** A resolved shared font size (root + folded-descendant). */
export interface SharedFontFit {
	rootSizePx: number;
	descendantSizePx: number;
}

/** One item's own text (plus any folded descendant texts) and box, for {@link resolveSharedFontFit}. */
export interface FontFitCandidate {
	rootText: string;
	descendantTexts: readonly string[];
	width: number;
	height: number;
}

/** Resolve ONE shared font size across `items`, or `undefined` when there are none to fit. */
export function resolveSharedFontFit(
	fontCtx: FontFitContext,
	fontRoleNode: PptxSmartArtLayoutNode | undefined,
	items: FontFitCandidate[],
): SharedFontFit | undefined {
	if (items.length === 0) {
		return undefined;
	}
	return resolveTieredItemFontSize(
		fontCtx.plan,
		fontCtx.index,
		items,
		fontCtx.fontName,
		undefined,
		0,
		fontRoleNode,
	);
}

/** {@link resolveSharedFontFit}, building `FontFitCandidate`s directly from `collectSelfDesPairs`' output. */
export function resolveFontFitFromPairs(
	fontCtx: FontFitContext | undefined,
	fontRoleNode: PptxSmartArtLayoutNode | undefined,
	pairs: SelfDesPair[],
): SharedFontFit | undefined {
	if (!fontCtx) {
		return undefined;
	}
	return resolveSharedFontFit(
		fontCtx,
		fontRoleNode,
		pairs.map((pair) => ({
			rootText: pair.node.text,
			descendantTexts: pair.desSlot?.content.map((entry) => entry.text) ?? [],
			width: pair.selfRect.width,
			height: pair.selfRect.height,
		})),
	);
}
