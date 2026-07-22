import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import React from 'react';

import { DEFAULT_BODY_INSET_TB_PX } from '../constants';
import { getKinsokuLineBreakStyles } from './kinsoku-styles';
import { toCssWritingMode, toCssTextOrientation, toCssVerticalDirection } from './text-utils';

// ── Tab-size helper ──────────────────────────────────────────────────────

/**
 * Compute a CSS `tab-size` value from parsed tab stops.
 * If a single tab stop exists, use its position.
 * If multiple tab stops exist, use the average distance between consecutive stops.
 *
 * When no explicit tab stops are present, `defaultTabSize` (from
 * `a:pPr/@defTabSz`, already converted to px) is used so that plain tab
 * characters advance by the authored default interval rather than the browser
 * default (8 characters).
 */
export function computeTabSize(
	tabStops: Array<{ position: number; align: 'l' | 'ctr' | 'r' | 'dec' }> | undefined,
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

	// Sort positions ascending, then compute average gap
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

export function getTextLayoutStyle(element: PptxElement): React.CSSProperties {
	if (!hasTextProperties(element)) {
		return {};
	}
	const verticalAlign = element.textStyle?.vAlign || 'top';
	const writingMode = toCssWritingMode(element.textStyle?.textDirection);
	const textOrientation = toCssTextOrientation(element.textStyle?.textDirection);
	const verticalDirection = toCssVerticalDirection(element.textStyle?.textDirection);
	const parsedColumnCount = Number(element.textStyle?.columnCount);
	const columnCount = Number.isFinite(parsedColumnCount)
		? Math.max(1, Math.min(16, Math.round(parsedColumnCount)))
		: 1;
	const hasColumns = columnCount > 1;
	const justifyContent =
		verticalAlign === 'middle' ? 'center' : verticalAlign === 'bottom' ? 'flex-end' : 'flex-start';

	// Tab-size: if multiple tab stops, use average distance; else first position.
	// Falls back to the authored default tab interval (`a:pPr/@defTabSz`).
	const tabStops = element.textStyle?.tabStops;
	const tabSize = computeTabSize(tabStops, element.textStyle?.defaultTabSize);

	// Text wrapping mode
	const textWrapNone = element.textStyle?.textWrap === 'none';

	// Paragraph indentation: applied at global level only when no per-paragraph
	// indents are available (backward compat / single-level text).
	const hasParagraphIndents =
		hasTextProperties(element) && element.paragraphIndents && element.paragraphIndents.length > 0;
	const paragraphMarginLeft = element.textStyle?.paragraphMarginLeft;
	const paragraphIndent = element.textStyle?.paragraphIndent;
	const marginLeft =
		!hasParagraphIndents && typeof paragraphMarginLeft === 'number' && paragraphMarginLeft !== 0
			? paragraphMarginLeft
			: undefined;
	const textIndent =
		!hasParagraphIndents && typeof paragraphIndent === 'number' && paragraphIndent !== 0
			? paragraphIndent
			: undefined;

	const bodyTop = element.textStyle?.bodyInsetTop ?? DEFAULT_BODY_INSET_TB_PX;
	const bodyBottom = element.textStyle?.bodyInsetBottom ?? DEFAULT_BODY_INSET_TB_PX;

	const parsedColumnSpacing = Number(element.textStyle?.columnSpacing);
	const columnGap =
		Number.isFinite(parsedColumnSpacing) && parsedColumnSpacing > 0
			? `${parsedColumnSpacing}px`
			: '0.75em';

	// Kinsoku (East Asian line-breaking) CSS rules from element-level textStyle
	const kinsokuStyles = getKinsokuLineBreakStyles(element.textStyle);

	if (hasColumns) {
		return {
			display: 'block',
			columnCount,
			columnGap,
			// Body inset only. Paragraph spacing (spcBef/spcAft) is applied
			// per-paragraph by the paragraph renderer, not collapsed here.
			paddingTop: bodyTop,
			paddingBottom: bodyBottom,
			writingMode,
			textOrientation,
			direction: verticalDirection,
			tabSize: tabSize as string | undefined,
			marginLeft,
			textIndent,
			...kinsokuStyles,
			...(textWrapNone
				? {
						whiteSpace: 'nowrap' as const,
						overflow: 'visible' as const,
					}
				: {}),
		};
	}
	return {
		display: 'flex',
		flexDirection: 'column',
		justifyContent,
		// Body inset only. Paragraph spacing (spcBef/spcAft) is applied
		// per-paragraph by the paragraph renderer, not collapsed here.
		paddingTop: bodyTop,
		paddingBottom: bodyBottom,
		writingMode,
		textOrientation,
		direction: verticalDirection,
		tabSize: tabSize as string | undefined,
		marginLeft,
		textIndent,
		...kinsokuStyles,
		...(textWrapNone
			? {
					whiteSpace: 'nowrap' as const,
					overflow: 'visible' as const,
				}
			: {}),
	};
}
