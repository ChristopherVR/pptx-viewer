import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import { buildTextBodyLayoutStyle } from 'pptx-viewer-shared';
import React from 'react';

import { DEFAULT_BODY_INSET_TB_PX } from '../constants';
import { toCssWritingMode, toCssTextOrientation, toCssVerticalDirection } from './text-utils';

/**
 * The text body's box: columns, vertical anchoring, tab advance, kinsoku rules
 * and the writing mode.
 *
 * The `a:bodyPr` decisions (`@numCol` / `@spcCol`, `@anchor`, `@anchorCtr`,
 * `a:tabLst` / `@defTabSz`, `@eaLnBrk` / `@latinLnBrk` / `@hangingPunct`) now
 * come from the shared `buildTextBodyLayoutStyle`, which `buildTextBlockStyle`
 * folds into the other four bindings' single body style. They used to live only
 * here, so a two-column body rendered as one column and tabbed text collapsed to
 * the browser's 8-character default everywhere except React.
 *
 * What stays React-specific is the composition: React layers this style under
 * `getTextStyleForElement`'s typography on the same element, so the padding and
 * writing-mode keys are duplicated between the two by design.
 */
export function getTextLayoutStyle(element: PptxElement): React.CSSProperties {
	if (!hasTextProperties(element)) {
		return {};
	}
	const writingMode = toCssWritingMode(element.textStyle?.textDirection);
	const textOrientation = toCssTextOrientation(element.textStyle?.textDirection);
	const verticalDirection = toCssVerticalDirection(element.textStyle?.textDirection);

	// Text wrapping mode
	const textWrapNone = element.textStyle?.textWrap === 'none';
	const shapeAutoFitTextBox =
		element.textStyle?.autoFitMode === 'shrink' &&
		(element.type === 'text' || element.locks?.txBox === true);

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

	return {
		// Columns / flex anchoring / anchorCtr / tab-size / kinsoku, from shared.
		...(buildTextBodyLayoutStyle(element) as React.CSSProperties),
		// Body inset only. Paragraph spacing (spcBef/spcAft) is applied
		// per-paragraph by the paragraph renderer, not collapsed here.
		paddingTop: bodyTop,
		paddingBottom: bodyBottom,
		writingMode,
		textOrientation,
		direction: verticalDirection,
		marginLeft,
		textIndent,
		...(shapeAutoFitTextBox
			? {
					width: textWrapNone ? ('max-content' as const) : '100%',
					minWidth: '100%',
					height: 'max-content',
					minHeight: '100%',
					whiteSpace: 'pre-wrap' as const,
					wordBreak: textWrapNone ? ('normal' as const) : ('break-word' as const),
					overflow: 'visible' as const,
				}
			: {}),
		...(textWrapNone
			? {
					whiteSpace: 'nowrap' as const,
					overflow: 'visible' as const,
				}
			: {}),
	};
}
