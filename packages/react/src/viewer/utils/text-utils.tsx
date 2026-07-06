import { PptxElement, TextSegment, TextStyle, hasTextProperties } from 'pptx-viewer-core';
import {
	computeAutoFitTextStyle,
	resolveLineHeight,
	toCssTextOrientation,
	toCssVerticalDirection,
	toCssWritingMode,
} from 'pptx-viewer-shared';
import React from 'react';

import {
	DEFAULT_TEXT_FONT_SIZE,
	DEFAULT_FONT_FAMILY,
	HYPERLINK_COLOR,
	DEFAULT_BODY_INSET_LR_PX,
	DEFAULT_BODY_INSET_TB_PX,
} from '../constants';
import { cloneTextStyle } from './clone';
import { normalizeHexColor } from './color';

// Vertical-text writing-mode helpers + line-height + auto-fit scaling now live
// in pptx-viewer-shared (render/text-style-helpers). Re-exported here so
// existing React import paths (`./text-utils`) keep working.
export {
	toCssWritingMode,
	toCssTextOrientation,
	toCssVerticalDirection,
	isVerticalTextDirection,
} from 'pptx-viewer-shared';

export type ListMode = 'none' | 'bullet' | 'number';

export function createUniformTextSegments(
	text: string,
	style: TextStyle | undefined,
): TextSegment[] {
	return [
		{
			text,
			style: cloneTextStyle(style) || {},
		},
	];
}

export function getElementTextContent(element: PptxElement): string {
	if (!hasTextProperties(element)) {
		return '';
	}
	if (typeof element.text === 'string') {
		return element.text;
	}
	if (!element.textSegments || element.textSegments.length === 0) {
		return '';
	}
	return element.textSegments.map((segment: TextSegment) => String(segment.text || '')).join('');
}

export function stripListPrefix(line: string): string {
	return line.replace(/^\s*(?:[-*•◦▪]\s+|\d+[.)]\s+)/u, '');
}

export function detectListMode(text: string): ListMode {
	const lines = text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	if (lines.length === 0) {
		return 'none';
	}
	const allBullets = lines.every((line) => /^[-*•◦▪]\s+/u.test(line));
	if (allBullets) {
		return 'bullet';
	}
	const allNumbers = lines.every((line) => /^\d+[.)]\s+/u.test(line));
	if (allNumbers) {
		return 'number';
	}
	return 'none';
}

export function formatTextAsList(text: string, mode: ListMode): string {
	const lines = text.split('\n');
	if (mode === 'none') {
		return lines.map((line) => stripListPrefix(line)).join('\n');
	}
	if (mode === 'bullet') {
		return lines
			.map((line) => {
				if (line.trim().length === 0) {
					return line;
				}
				return `• ${stripListPrefix(line)}`;
			})
			.join('\n');
	}
	let visibleIndex = 0;
	return lines
		.map((line) => {
			if (line.trim().length === 0) {
				return line;
			}
			visibleIndex += 1;
			return `${visibleIndex}. ${stripListPrefix(line)}`;
		})
		.join('\n');
}

export function createEditorId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function getTextStyleForElement(
	element: PptxElement,
	fallbackColor: string,
): React.CSSProperties {
	if (!hasTextProperties(element)) {
		return { color: fallbackColor };
	}
	const textDecorationTokens: string[] = [];
	if (element.textStyle?.underline || element.textStyle?.hyperlink) {
		textDecorationTokens.push('underline');
	}
	if (element.textStyle?.strikethrough) {
		textDecorationTokens.push('line-through');
	}
	const isDoubleStrike =
		element.textStyle?.strikethrough && element.textStyle?.strikeType === 'dblStrike';
	const textDecorationStyle: React.CSSProperties['textDecorationStyle'] = isDoubleStrike
		? 'double'
		: undefined;
	const hasItalicRuns =
		element.textStyle?.italic ||
		Boolean(element.textSegments?.some((segment: TextSegment) => segment.style?.italic));
	const isRtl = element.textStyle?.rtl === true;
	const resolvedTextColor = element.textStyle?.hyperlink
		? normalizeHexColor(element.textStyle?.color, HYPERLINK_COLOR)
		: normalizeHexColor(element.textStyle?.color, fallbackColor);
	const bodyTop = element.textStyle?.bodyInsetTop ?? DEFAULT_BODY_INSET_TB_PX;
	const bodyBottom = element.textStyle?.bodyInsetBottom ?? DEFAULT_BODY_INSET_TB_PX;
	const bodyLeft = element.textStyle?.bodyInsetLeft ?? DEFAULT_BODY_INSET_LR_PX;
	const bodyRight = element.textStyle?.bodyInsetRight ?? DEFAULT_BODY_INSET_LR_PX;

	// Vertical text direction
	const writingMode = toCssWritingMode(element.textStyle?.textDirection);
	const textOrientation = toCssTextOrientation(element.textStyle?.textDirection);
	const verticalDirection = toCssVerticalDirection(element.textStyle?.textDirection);

	// Direction: vertical RTL modes (e.g. wordArtVertRtl) take priority,
	// then paragraph-level RTL, then default LTR.
	const resolvedDirection: React.CSSProperties['direction'] =
		verticalDirection || (isRtl ? 'rtl' : 'ltr');
	const resolvedUnicodeBidi: React.CSSProperties['unicodeBidi'] = isRtl ? 'plaintext' : undefined;

	// Element-level highlight only applies as a fallback for segmentless text;
	// with segments each run carries its own backgroundColor.
	const hasSegments = (element.textSegments?.length ?? 0) > 0;
	return {
		color: resolvedTextColor,
		backgroundColor:
			!hasSegments && element.textStyle?.highlightColor
				? normalizeHexColor(element.textStyle.highlightColor, undefined)
				: undefined,
		textAlign: ((): React.CSSProperties['textAlign'] => {
			const a = element.textStyle?.align;
			if (a === 'justLow' || a === 'dist' || a === 'thaiDist') {
				return 'justify';
			}
			return a || (isRtl ? 'right' : 'left');
		})(),
		direction: resolvedDirection,
		unicodeBidi: resolvedUnicodeBidi,
		fontSize: element.textStyle?.fontSize || DEFAULT_TEXT_FONT_SIZE,
		fontWeight: element.textStyle?.bold ? 700 : 400,
		fontStyle: element.textStyle?.italic ? 'italic' : 'normal',
		textDecorationLine: textDecorationTokens.length > 0 ? textDecorationTokens.join(' ') : 'none',
		textDecorationStyle,
		fontFamily: element.textStyle?.fontFamily || DEFAULT_FONT_FAMILY,
		lineHeight: resolveLineHeight(element.textStyle, hasItalicRuns),
		paddingTop: bodyTop + (hasItalicRuns ? 1 : 0),
		paddingBottom: bodyBottom + (hasItalicRuns ? 1 : 0),
		paddingLeft: bodyLeft + (element.textStyle?.paragraphMarginLeft || 0),
		paddingRight: bodyRight + (element.textStyle?.paragraphMarginRight || 0),
		textIndent: element.textStyle?.paragraphIndent || 0,
		overflow: 'visible',
		writingMode,
		textOrientation,
		...(element.textStyle?.textWrap === 'none'
			? { whiteSpace: 'nowrap' as const, overflow: 'visible' as const }
			: {}),
		// Auto-fit: use OOXML-provided fontScale/lnSpcReduction when available,
		// otherwise fall back to heuristic estimation. The pure font-scale maths
		// now lives in pptx-viewer-shared (computeAutoFitTextStyle).
		...computeAutoFitTextStyle({
			textStyle: element.textStyle,
			text: element.text ?? '',
			width: element.width,
			height: element.height,
			bodyInsetVertical: bodyTop + bodyBottom,
			hasItalicRuns,
			defaultFontSize: DEFAULT_TEXT_FONT_SIZE,
		}),
	};
}
