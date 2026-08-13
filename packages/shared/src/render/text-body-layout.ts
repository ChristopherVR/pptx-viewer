/**
 * `text-body-layout`: the `a:bodyPr` LAYOUT decisions, for all five bindings.
 *
 * `buildTextBlockStyle` owns the text body's typography (colour, font, line
 * height, insets). This module owns the box it is laid out in: how many columns
 * it has (`@numCol` / `@spcCol`), how tab characters advance (`a:tabLst` /
 * `@defTabSz`), where the text sits vertically (`@anchor`) and horizontally
 * (`@anchorCtr`), the CJK break rules (`@eaLnBrk` / `@latinLnBrk` /
 * `@hangingPunct`), and whether an overflowing body clips (`@vertOverflow` /
 * `@horzOverflow`).
 *
 * Why it exists: every one of those reached React ONLY. React composed them in
 * its private `getTextLayoutStyle`, while Vue / Angular / Svelte / Vanilla went
 * through `buildTextBlockStyle`, which had no branch for any of them. A
 * two-column body rendered as one column in four of five bindings, tabbed text
 * fell back to the browser's 8-character default in four, and `anchorCtr` and
 * `vertOverflow` were honoured by nobody at all - Vanilla even shipped a
 * "Column Spacing" inspector control whose value its renderer never read.
 *
 * The function returns a neutral CSS record; `buildTextBlockStyle` folds it in
 * for the four bindings that ask for `bodyLayout`, and React's
 * `getTextLayoutStyle` is a thin wrapper over it. One implementation, five
 * bindings.
 *
 * @module render/text-body-layout
 */

import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { getKinsokuLineBreakStyles } from './kinsoku-styles';

/** A neutral CSS record: camelCase property names, plain CSS values. */
export type TextBodyLayoutStyle = Record<string, string | number>;

/** ECMA-376 caps `a:bodyPr/@numCol` at 16 (`ST_TextColumnCount`). */
const MAX_COLUMNS = 16;

/**
 * Resolved column layout for a text body.
 *
 * `count` is 1 for the overwhelmingly common single-column body, in which case
 * `gap` is `undefined` and a caller emits no multi-column CSS at all.
 */
export interface TextBodyColumns {
	/** `a:bodyPr/@numCol`, clamped to the schema's 1..16 range. */
	count: number;
	/**
	 * `a:bodyPr/@spcCol` as a CSS length, or `undefined` for a single column.
	 *
	 * The schema default is 0 (`ST_PositiveCoordinate32`, "Specifies the space
	 * between text columns... Default 0"), and 0 is what we emit for an omitted
	 * attribute. React used to invent a `0.75em` gap here, which is neither the
	 * authored value nor the spec default.
	 */
	gap?: string;
}

/**
 * Resolve `a:bodyPr/@numCol` + `@spcCol` into a column count and CSS gap.
 *
 * @param textStyle The element's resolved text style, or `undefined`.
 * @returns The column decision; `count` is 1 when the body is single-column.
 */
export function resolveTextBodyColumns(textStyle: TextStyle | undefined): TextBodyColumns {
	const parsed = Number(textStyle?.columnCount);
	const count = Number.isFinite(parsed)
		? Math.max(1, Math.min(MAX_COLUMNS, Math.round(parsed)))
		: 1;
	if (count <= 1) {
		return { count: 1 };
	}
	const spacing = Number(textStyle?.columnSpacing);
	const gap = Number.isFinite(spacing) && spacing > 0 ? `${spacing}px` : '0px';
	return { count, gap };
}

/**
 * Compute a CSS `tab-size` from parsed tab stops.
 *
 * CSS can only express ONE uniform advance, so a body with several stops is
 * approximated by the average distance between consecutive stops (a single stop
 * is used verbatim). When no stop is authored, `a:pPr/@defTabSz` (already in px)
 * supplies the interval, which is the value PowerPoint actually advances by; the
 * browser default of 8 characters is never right for a deck.
 *
 * Per-stop ALIGNMENT (`@algn="ctr"|"r"|"dec"`) and leader glyphs cannot be
 * expressed as `tab-size`; those need a measured inline layout (React has one in
 * `text-tab-layout`).
 *
 * @param tabStops    Parsed `a:tabLst` entries (positions in px).
 * @param defaultTabSize `a:pPr/@defTabSz` in px.
 * @returns A CSS `tab-size` value, or `undefined` when nothing is authored.
 */
export function computeTabSize(
	tabStops: TextStyle['tabStops'],
	defaultTabSize?: number,
): string | undefined {
	const fromDefault =
		typeof defaultTabSize === 'number' && defaultTabSize > 0
			? `${Math.round(defaultTabSize)}px`
			: undefined;

	if (!tabStops || tabStops.length === 0) {
		return fromDefault;
	}
	if (tabStops.length === 1) {
		const pos = tabStops[0].position;
		return typeof pos === 'number' && pos > 0 ? `${Math.round(pos)}px` : fromDefault;
	}

	const positions = tabStops
		.map((t) => t.position)
		.filter((p) => typeof p === 'number' && p > 0)
		.sort((a, b) => a - b);
	if (positions.length < 2) {
		return positions.length === 1 ? `${Math.round(positions[0])}px` : fromDefault;
	}
	let totalGap = 0;
	for (let i = 1; i < positions.length; i++) {
		totalGap += positions[i] - positions[i - 1];
	}
	const avgGap = totalGap / (positions.length - 1);
	return avgGap > 0 ? `${Math.round(avgGap)}px` : fromDefault;
}

/**
 * `a:bodyPr/@vertOverflow` / `@horzOverflow` as a CSS overflow decision.
 *
 * The spec's `clip` and `ellipsis` both mean "do not let the text escape the
 * shape"; `overflow` (and an omitted attribute) mean it may spill, which is what
 * PowerPoint does by default and what every binding already did.
 *
 * Both axes are clipped together even when only one is authored, because CSS
 * forbids the mixed state: setting one axis to `hidden` while the other stays
 * `visible` computes the visible one to `auto`, which paints a scrollbar inside
 * the shape. Clipping the other axis as well is the lesser deviation, and only
 * reachable on a body that authored a clip in the first place.
 *
 * @returns `'hidden'` when the body must clip, otherwise `undefined`.
 */
export function resolveTextOverflowClip(textStyle: TextStyle | undefined): 'hidden' | undefined {
	const vert = textStyle?.vertOverflow;
	const horz = textStyle?.hOverflow;
	return vert === 'clip' || vert === 'ellipsis' || horz === 'clip' ? 'hidden' : undefined;
}

/**
 * Build the CSS for one element's text-body BOX (as opposed to its typography).
 *
 * Emits, in this order so a later rule can override an earlier one:
 *
 *  1. the column box (`display: block` + `column-count` + `column-gap`) when
 *     `@numCol > 1`, otherwise the flex column with the `@anchor` justification;
 *  2. `align-items: center` for `@anchorCtr="1"`;
 *  3. `tab-size`;
 *  4. the kinsoku rules, last, because `@latinLnBrk` legitimately overrides the
 *     default `word-break`.
 *
 * `@vertOverflow` is deliberately NOT here: it has to beat the `wrap="none"` and
 * linked-text-box overflow rules `buildTextBlockStyle` applies afterwards, so it
 * is folded in there (see {@link resolveTextOverflowClip}).
 *
 * @param element The element whose text body is being laid out.
 * @returns A neutral CSS record, empty for an element with no text properties.
 *          Every length is already a unit-suffixed string, so no `pxLengths`
 *          conversion applies to it.
 */
export function buildTextBodyLayoutStyle(element: PptxElement): TextBodyLayoutStyle {
	if (!hasTextProperties(element)) {
		return {};
	}
	const ts = element.textStyle;
	const style: TextBodyLayoutStyle = {};

	const columns = resolveTextBodyColumns(ts);
	if (columns.count > 1) {
		// A multi-column body is a BLOCK: CSS multi-column does not apply to a
		// flex container, so the flex-column box the single-column path uses
		// would silently swallow `column-count` entirely.
		style.display = 'block';
		style.columnCount = columns.count;
		if (columns.gap !== undefined) {
			style.columnGap = columns.gap;
		}
	} else {
		style.display = 'flex';
		style.flexDirection = 'column';
		style.justifyContent =
			ts?.vAlign === 'middle' ? 'center' : ts?.vAlign === 'bottom' ? 'flex-end' : 'flex-start';
	}

	// `a:bodyPr/@anchorCtr="1"`: "determine the smallest possible bounding box
	// for the text and then centre that bounding box". In a flex column that is
	// `align-items: center`, which shrink-wraps each paragraph and centres it -
	// the closest CSS gets without measuring, and independent of `@algn`, which
	// still positions the text INSIDE the shrink-wrapped box. It is a no-op on
	// the multi-column block, where there is no flex line to align.
	if (ts?.anchorCenter === true && columns.count <= 1) {
		style.alignItems = 'center';
	}

	const tabSize = computeTabSize(ts?.tabStops, ts?.defaultTabSize);
	if (tabSize !== undefined) {
		style.tabSize = tabSize;
	}

	Object.assign(style, getKinsokuLineBreakStyles(ts));
	return style;
}

/**
 * `a:bodyPr/@rot` as a CSS `transform` value.
 *
 * The attribute rotates the text body inside an otherwise unrotated shape
 * (PowerPoint's "Text Options > Text Box > custom angle"). Core stores it in
 * degrees, clockwise positive, which is also CSS's sense, so the mapping is
 * direct. Returns `undefined` for an absent or zero rotation so a caller can
 * compose it with its own transforms without emitting `rotate(0deg)`.
 *
 * @param element The element whose text body may be rotated.
 * @returns e.g. `'rotate(45deg)'`, or `undefined`.
 */
export function getTextBodyRotationTransform(element: PptxElement): string | undefined {
	if (!hasTextProperties(element)) {
		return undefined;
	}
	const rotation = element.textStyle?.textBodyRotation;
	return typeof rotation === 'number' && Number.isFinite(rotation) && rotation !== 0
		? `rotate(${rotation}deg)`
		: undefined;
}
