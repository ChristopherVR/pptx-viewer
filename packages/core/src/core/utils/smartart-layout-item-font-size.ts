/**
 * SmartArt DiagramML interpreter - shared item `primFontSz` resolution.
 *
 * ECMA-376 21.4.2.x: a `dgm:ruleLst` shrink rule governs every point that
 * shares it, so a `lin`/`snake` item template's font size is ONE size for
 * the WHOLE arranged set (the diagram picks the size that makes the
 * worst-fitting item's text fit, and every item - even a short one - renders
 * at that SAME size), never each box's own independent best fit. Confirmed
 * against `smartart-gallery/basic-process--hier5.pptx`'s cached drawing: all
 * three item boxes share one font size regardless of their own text length.
 * That sharing is scoped to points arranged through the SAME item role -
 * see `resolveRoleFontSize`'s doc comment for why a DIFFERENT declared role
 * of the same item template (a numbered badge alongside its body text) gets
 * its own independent size instead.
 *
 * This resolves that shared size from DiagramML-declared bounds instead of a
 * hardcoded guess (bounds resolution itself lives in
 * `smartart-layout-item-font-role.ts`, split out for the file-size budget):
 *  - the CEILING: the arranger's own `dgm:constr type="primFontSz"` starting
 *    value declared for the item role (an absolute `val`, e.g. `65`), read
 *    via the constraint index.
 *  - the FLOOR: the item layoutNode's own `dgm:ruleLst` minimum `primFontSz`
 *    `val` (the most aggressive of its shrink stages).
 * A layoutDef that declares neither keeps the interpreter's pre-existing
 * heuristic bounds, so a layout with no such constraint renders as before.
 *
 * NO DISCRETE SHRINK-STEP SEQUENCE: cross-referencing every gallery fixture's
 * cached `a:rPr/@sz` against its declared `primFontSz` ceiling found no
 * common ratio or percentage-step pattern (values ranged continuously from
 * ~29% to 134% of the declared ceiling) - the ONLY consistent regularity is
 * that every observed cached size is an EXACT WHOLE POINT (never e.g. a
 * half-point), confirming PowerPoint solves this continuously (by real text
 * measurement) rather than by walking a fixed percentage table, then rounds
 * the result to a whole point. Re-confirmed by dumping every cached `a:rPr/
 * @sz` across all 227 gallery fixtures: the distinct set is 5-43 (nearly
 * every whole point) plus 45-52/55/60/65 - no half points anywhere, and no
 * small fixed ladder (unlike `normAutofit`'s ~10-step fontScale table) -
 * `resolveSharedItemFontSize` reproduces that granularity by snapping its
 * own continuous fit to the nearest whole point.
 *
 * Units: `dgm:constr`/`dgm:rule` numeric values for `primFontSz`/margins are
 * in POINTS (ECMA-376's own unit for CT_Constraint numeric attributes), but
 * every element/box dimension elsewhere in this codebase - and the cached
 * ground truth's OWN `textStyle.fontSize` (see
 * `PptxHandlerRuntimeSmartArtParsing.ts`'s `extractDrawingShapeTextStyle`,
 * `fontSize = (szRaw / 100) * (96 / 72)`) - is in CSS PIXELS. Everything here
 * converts to pixels immediately so it composes with the pixel-based box
 * geometry `arrangeLinear`/`arrangeSnake` already work in.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import { DEFAULT_FONT_ADVANCE_TABLE, FONT_ADVANCE_TABLES } from './font-advance-widths.generated';
import type { FontAdvanceTable } from './font-advance-widths.generated';
import { entryKey, resolveConstraint } from './smartart-constraint-solver';
import type { ConstraintIndex } from './smartart-constraint-solver';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import type { FontBounds } from './smartart-layout-item-font-role';
import { itemFontBoundsPx, nodeFontBounds } from './smartart-layout-item-font-role';
import { fitWrappedFontSize, SMARTART_LINE_SPACING_FACTOR } from './smartart-text-wrap-fit';

export { primFontSzCeilingPx, resolveItemSelfAspect } from './smartart-layout-item-font-role';

/** Points per CSS pixel at PowerPoint's 96 DPI convention (see module doc comment). */
const POINTS_TO_PIXELS = 96 / 72;

/** One arranged item's text plus the box (in pixels) it will render into. */
export interface FontFitItem {
	text: string;
	width: number;
	height: number;
}

/**
 * Resolve the {@link FontAdvanceTable} for `fontName`, defaulting to Calibri
 * (the Office theme's default minor font, and what SmartArt renders in
 * absent an explicit per-node font override) and falling back to the
 * cross-font average for a font this table has not measured.
 */
export function resolveFontTable(fontName: string | undefined): FontAdvanceTable {
	return FONT_ADVANCE_TABLES[fontName ?? 'Calibri'] ?? DEFAULT_FONT_ADVANCE_TABLE;
}

/**
 * Resolve the item's own text-frame insets (`dgm:constr type="lMarg"/
 * "rMarg"/"tMarg"/"bMarg"`, most commonly declared as a `fact` of the item's
 * own `primFontSz`), in PIXELS, falling back to `table`'s measured default
 * `a:bodyPr` insets (PowerPoint's own plain-textbox default: 0.1in
 * left/right, 0.05in top/bottom) when the layoutDef declares none.
 */
export function itemMarginsPx(
	index: ConstraintIndex,
	role: string,
	table: FontAdvanceTable,
): { horizontal: number; vertical: number } {
	const left = resolveConstraint(index, role, 'lMarg');
	const right = resolveConstraint(index, role, 'rMarg');
	const top = resolveConstraint(index, role, 'tMarg');
	const bottom = resolveConstraint(index, role, 'bMarg');
	const leftPt = typeof left === 'number' ? left : table.marginLeftPt;
	const rightPt = typeof right === 'number' ? right : table.marginRightPt;
	const topPt = typeof top === 'number' ? top : table.marginTopPt;
	const bottomPt = typeof bottom === 'number' ? bottom : table.marginBottomPt;
	return {
		horizontal: (leftPt + rightPt) * POINTS_TO_PIXELS,
		vertical: (topPt + bottomPt) * POINTS_TO_PIXELS,
	};
}

/**
 * Per-axis margin fraction of a CANDIDATE font size, when the layoutDef
 * declares `lMarg`/`rMarg`/`tMarg`/`bMarg` as a fraction of `primFontSz`
 * (`<dgm:constr type="lMarg" refType="primFontSz" fact="0.3"/>`, the pattern
 * "Basic Process"/"Basic Block List"/"Vertical Bullet List" ALL use).
 *
 * `itemMarginsPx` resolves this ONCE against the declared CEILING (the
 * constraint solver has no notion of "the font size after shrinking"), which
 * systematically UNDER-estimates the real available text space once the fit
 * actually shrinks below that ceiling: real margins shrink WITH the font,
 * they are not pinned to the ceiling's own margin. Measured across all three
 * fixtures above, using the fixed ceiling-based margin throughout the search
 * consistently underestimates the cached `a:rPr/@sz` by 10-16% - `undefined`
 * per axis when that axis's margin is not `primFontSz`-proportional (a
 * literal point value, or not declared at all), so the caller keeps
 * `itemMarginsPx`'s fixed default for that axis.
 */
export function proportionalMarginFraction(
	index: ConstraintIndex,
	role: string,
): { horizontal: number; vertical: number } | undefined {
	const factorIfProportional = (type: string): number | undefined => {
		const constraint = index.entries.get(entryKey(role, type))?.[0]?.constraint;
		return constraint?.referenceType === 'primFontSz' && typeof constraint.factor === 'number'
			? constraint.factor
			: undefined;
	};
	const left = factorIfProportional('lMarg');
	const right = factorIfProportional('rMarg');
	const top = factorIfProportional('tMarg');
	const bottom = factorIfProportional('bMarg');
	if (left === undefined && right === undefined && top === undefined && bottom === undefined) {
		return undefined;
	}
	return { horizontal: (left ?? 0) + (right ?? 0), vertical: (top ?? 0) + (bottom ?? 0) };
}

/**
 * Snap `sizePx` to the nearest WHOLE POINT: see the module doc comment's "no
 * discrete shrink-step sequence" finding - every cached `a:rPr/@sz` across
 * the gallery corpus is an exact whole point, so the fit result should be
 * too.
 */
export function snapToWholePoint(sizePx: number): number {
	return Math.round(sizePx / POINTS_TO_PIXELS) * POINTS_TO_PIXELS;
}

/**
 * Resolve ONE shared font size (in pixels) for `items`: the item role's
 * declared `primFontSz` is the ceiling, its `dgm:ruleLst` minimum `val` is
 * the floor, each item's box is measured net of its own text-frame insets,
 * and the diagram-wide MINIMUM best-fit candidate across every item wins -
 * see the module doc comment for why no item gets its own independent size.
 * The result is snapped to the nearest whole point.
 *
 * @param naturalAspect - The item template's own self-scoped `h`/`w` aspect
 *   (`resolveItemSelfAspect`), when the caller's arranger declines to apply
 *   it to DISPLAY geometry (see that function's doc comment). When present,
 *   each candidate's fit height is capped at `width * naturalAspect` before
 *   subtracting margins, so font-fit is solved against the diagram's own
 *   natural box size even when the displayed box is later stretched taller.
 */
export function resolveSharedItemFontSize(
	plan: ArrangementPlan,
	index: ConstraintIndex,
	items: readonly FontFitItem[],
	fontName?: string,
	naturalAspect?: number,
): number {
	return fitSharedFontSize(itemFontBoundsPx(plan, index), index, items, fontName, naturalAspect);
}

/**
 * Resolve a SINGLE per-item-ROLE's own font size (in pixels), independent of
 * any OTHER role sharing the same arranged point's box. The module doc
 * comment's "one size for the whole arranged set" sharing is scoped to
 * points arranged through the SAME role/forEach - it does NOT extend across
 * DIFFERENT declared roles of the same item template. Measured against
 * "Numbered Card List": its `sibTransNodeRect` role (the numbered badge,
 * `<dgm:constr type="primFontSz" val="66"/>`) and `nodeRect` role (the body
 * text, `val="26"`) are two INDEPENDENT `primFontSz` declarations sharing
 * nothing - `smartart-layout-interpreter-item-role-stack.ts`'s `stackAsRect`
 * previously copied the OUTER arranger's single resolved size onto every
 * split role, putting the badge number at the body text's 26pt ceiling
 * (cached: 26px/19.5pt) instead of its own, cached 65pt.
 */
export function resolveRoleFontSize(
	roleNode: PptxSmartArtLayoutNode,
	index: ConstraintIndex,
	items: readonly FontFitItem[],
	fontName?: string,
): number {
	return fitSharedFontSize(
		nodeFontBounds(roleNode, roleNode, index),
		index,
		items,
		fontName,
		undefined,
	);
}

function fitSharedFontSize(
	bounds: FontBounds,
	index: ConstraintIndex,
	items: readonly FontFitItem[],
	fontName: string | undefined,
	naturalAspect: number | undefined,
): number {
	const { ceilingPx, floorPx, role } = bounds;
	if (items.length === 0) {
		return snapToWholePoint(ceilingPx);
	}
	const table = resolveFontTable(fontName);
	const fixedMargins = itemMarginsPx(index, role, table);
	const proportional = proportionalMarginFraction(index, role);
	// See `SMARTART_LINE_SPACING_FACTOR`'s doc comment: the universal 90%
	// SmartArt line spacing measurably helps when the fit height comes
	// directly from the arranger's own declared box (margins net of
	// `candidate.height`), but OVERSHOOTS when it comes from a self-scoped
	// aspect estimate instead - that estimate's own error margin already
	// covers what the 90% factor would otherwise relieve.
	const lineSpacingFactor = typeof naturalAspect === 'number' ? 1 : SMARTART_LINE_SPACING_FACTOR;

	/** One fit pass, margins computed against `marginBasisPx` (see `proportionalMarginFraction`'s doc comment). */
	const fitAtMarginBasis = (marginBasisPx: number): number => {
		const margins = proportional
			? {
					horizontal: proportional.horizontal * marginBasisPx,
					vertical: proportional.vertical * marginBasisPx,
				}
			: fixedMargins;
		let shared = ceilingPx;
		for (const candidate of items) {
			const availableWidth = Math.max(1, candidate.width - margins.horizontal);
			const naturalHeight =
				typeof naturalAspect === 'number'
					? Math.min(candidate.height, candidate.width * naturalAspect)
					: candidate.height;
			const availableHeight = Math.max(1, naturalHeight - margins.vertical);
			const fit = fitWrappedFontSize(
				candidate.text,
				availableWidth,
				availableHeight,
				ceilingPx,
				floorPx,
				table,
				lineSpacingFactor,
			);
			shared = Math.min(shared, fit);
		}
		return shared;
	};

	let shared = fitAtMarginBasis(ceilingPx);
	if (proportional) {
		// Margins shrink WITH the font: re-solve against the PREVIOUS pass's own
		// result a few times until it stabilises. Converges fast (a handful of
		// iterations) because a smaller margin only ever grows the fit, and a
		// bigger fit only ever grows the margin back - monotone in both
		// directions, never oscillating past the fixed point.
		for (let i = 0; i < 6; i++) {
			const next = fitAtMarginBasis(shared);
			if (Math.abs(next - shared) < 0.01) {
				shared = next;
				break;
			}
			shared = next;
		}
	}
	return snapToWholePoint(shared);
}
