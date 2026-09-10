/**
 * SmartArt DiagramML interpreter - content-sized main-axis extents for `lin`.
 *
 * ECMA-376 21.4.7.6: a `dgm:constr type="h"/"w"` declaring `val="INF"` (no
 * limit) means the item's own extent along that axis comes from its
 * CONTENT, not a declared/divided slot - the one place `arrangeLinear`'s
 * otherwise-uniform per-item `mainExtent` is genuinely DATA-DEPENDENT.
 * "Vertical Box List"'s own item template (`parentLin`) declares exactly
 * this: `<dgm:constr type="h" for="ch" forName="parentLin" val="INF"/>`
 * (round 24 - `smartart-constraint-rules.ts` already parses `val="INF"` to
 * `Number.POSITIVE_INFINITY`, but `resolveConstraint`'s own `finite()` guard
 * silently drops it, so this needs its OWN raw-constraint detection, not a
 * `resolveConstraint` call).
 *
 * Scoped to VERTICAL flow only this round (the one fixture that declares
 * this pattern is a vertical list) - `arrangeLinear` guards the call with
 * `!horizontal`, so a future horizontal fixture using this same pattern
 * falls back to the existing uniform-slot behaviour rather than reaching
 * unverified code.
 */

import type { FontAdvanceTable } from './font-advance-widths.generated';
import { firstConstraintDeclaredBy } from './smartart-constraint-declared-by';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { hasReference } from './smartart-constraint-solver';
import { itemMarginsPx, proportionalMarginFraction } from './smartart-layout-item-font-size';
import { wrappedLineCount } from './smartart-text-wrap-fit';

/**
 * True when the arranger declares `itemRole`'s own `mainAxisType` extent as
 * a LITERAL `val="INF"` (no reference at all - a genuine "no limit, size to
 * content" declaration). `undefined` when nothing is declared at all (the
 * far more common case) is a DIFFERENT, unrelated situation the caller's
 * existing uniform-slot fallback already handles correctly - only an
 * EXPLICIT `INF` engages this module.
 */
export function isMainAxisContentSized(
	index: ConstraintIndex,
	arrangerRole: string,
	itemRole: string,
	mainAxisType: 'w' | 'h',
): boolean {
	const raw = firstConstraintDeclaredBy(index, itemRole, mainAxisType, arrangerRole);
	return raw !== undefined && raw.value === Number.POSITIVE_INFINITY && !hasReference(raw);
}

/**
 * Each item's own natural main-axis (vertical) extent, in pixels: a single
 * wrapped text block at `fontSizePx` within `crossExtentPx` (the item's own,
 * still-uniform cross-axis width), plus its role's own real margins and any
 * `roundRect`-family corner inset. When the summed extents (plus
 * `(n-1)*gap`) exceed `usableMain`, ECMA's own fallback applies: scale EVERY
 * extent down by the SAME factor so the set exactly fills `usableMain` -
 * "the declared/content extent wins unless it would overflow the box."
 */
export function resolveContentSizedExtents(
	texts: readonly string[],
	crossExtentPx: number,
	fontSizePx: number,
	table: FontAdvanceTable,
	lineSpacingFactor: number,
	fontRole: string,
	index: ConstraintIndex,
	cornerInsetPx: number,
	usableMain: number,
	gap: number,
): number[] {
	const margins = proportionalMarginFraction(index, fontRole);
	const marginVerticalPx = margins
		? margins.vertical * fontSizePx
		: itemMarginsPx(index, fontRole, table).vertical;
	const availWidthPx = Math.max(1, crossExtentPx - 2 * cornerInsetPx);
	const natural = texts.map((text) => {
		const lines = Math.max(1, wrappedLineCount(text, availWidthPx, fontSizePx, table));
		return Math.max(
			12,
			lines * fontSizePx * table.lineHeightRatio * lineSpacingFactor +
				marginVerticalPx +
				2 * cornerInsetPx,
		);
	});
	const n = natural.length;
	const gapTotal = Math.max(0, n - 1) * gap;
	const total = natural.reduce((sum, extent) => sum + extent, 0) + gapTotal;
	if (total <= usableMain || total - gapTotal <= 0) {
		return natural;
	}
	const scale = Math.max(0, (usableMain - gapTotal) / (total - gapTotal));
	return natural.map((extent) => extent * scale);
}
