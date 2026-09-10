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
import type { ChooseAwareSlot } from './smartart-layout-interpreter-composite-group-slots';
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

/**
 * One shared font-fit per distinct `declaringRole` among `slots` - see
 * `arrangeByChooseAwareSlots`'s own doc comment (`smartart-layout-
 * interpreter-composite-choose.ts`) for why a single global fit
 * over-restricts a choose-aware composite whose slots come from more than
 * one named wrapper group (`cycle-matrix`/`grid-matrix`/`segmented-
 * pyramid`'s shape - each named group carries its own, genuinely different,
 * declared `primFontSz` ceiling, unlike `upward-arrow`'s own count-branches,
 * which all share ONE wrapper and so degenerate to a single shared fit
 * here regardless).
 */
export function resolveFitByDeclaringRole(
	fontCtx: FontFitContext,
	slots: ChooseAwareSlot[],
): Map<string, SharedFontFit | undefined> {
	const byRole = new Map<string, ChooseAwareSlot[]>();
	for (const slot of slots) {
		const group = byRole.get(slot.declaringRole);
		if (group) {
			group.push(slot);
		} else {
			byRole.set(slot.declaringRole, [slot]);
		}
	}
	const fitByRole = new Map<string, SharedFontFit | undefined>();
	for (const [role, group] of byRole) {
		const fit = resolveSharedFontFit(
			fontCtx,
			group[0]?.node,
			group.map(({ content, rect }) => ({
				rootText: content[0]?.text ?? '',
				descendantTexts: content.slice(1).map((entry) => entry.text),
				width: rect.width,
				height: rect.height,
			})),
		);
		fitByRole.set(role, fit);
	}
	return fitByRole;
}
