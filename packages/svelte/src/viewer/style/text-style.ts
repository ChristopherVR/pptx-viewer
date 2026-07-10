import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import type { CssStyleMap } from 'pptx-viewer-shared';
import {
	DEFAULT_TEXT_COLOR,
	isVerticalTextDirection,
	px,
	resolveCssTextAlign,
	resolveLineHeight,
	toCssTextOrientation,
	toCssVerticalDirection,
	toCssWritingMode,
} from 'pptx-viewer-shared';

/**
 * Text-block style for elements that carry text. Port of the Vue binding's
 * `getTextBlockStyle` (itself the essentials of React's
 * `getTextStyleForElement`).
 */

/**
 * Default text-body insets in px (PowerPoint defaults: 0.1" left/right,
 * 0.05" top/bottom, converted EMU -> px).
 */
const DEFAULT_BODY_INSET_LR_PX = 91440 / 9525;
const DEFAULT_BODY_INSET_TB_PX = 45720 / 9525;

export function getTextBlockStyle(el: PptxElement): CssStyleMap {
	if (!hasTextProperties(el)) {
		return {};
	}
	const ts = el.textStyle;
	const style: CssStyleMap = {
		display: 'flex',
		flexDirection: 'column',
		width: '100%',
		height: '100%',
		overflow: 'visible',
		whiteSpace: 'pre-wrap',
		wordBreak: 'break-word',
		paddingTop: px(ts?.bodyInsetTop ?? DEFAULT_BODY_INSET_TB_PX),
		paddingBottom: px(ts?.bodyInsetBottom ?? DEFAULT_BODY_INSET_TB_PX),
		paddingLeft: px(ts?.bodyInsetLeft ?? DEFAULT_BODY_INSET_LR_PX),
		paddingRight: px(ts?.bodyInsetRight ?? DEFAULT_BODY_INSET_LR_PX),
	};
	if (!ts) {
		style.color = DEFAULT_TEXT_COLOR;
		return style;
	}

	style.color = ts.color ?? DEFAULT_TEXT_COLOR;
	if (ts.fontFamily) {
		style.fontFamily = ts.fontFamily;
	}
	// Font size renders in CSS px (the parsed value already IS the px size).
	if (typeof ts.fontSize === 'number') {
		style.fontSize = px(ts.fontSize);
	}
	// Line spacing: the browser's font-dependent `normal` would loosen
	// multi-line text and push it out of its box.
	style.lineHeight = resolveLineHeight(ts, Boolean(ts.italic));
	if (ts.bold) {
		style.fontWeight = 'bold';
	}
	if (ts.italic) {
		style.fontStyle = 'italic';
	}

	const decorations: string[] = [];
	if (ts.underline) {
		decorations.push('underline');
	}
	if (ts.strikethrough) {
		decorations.push('line-through');
	}
	if (decorations.length > 0) {
		style.textDecoration = decorations.join(' ');
	}

	// Alignment (justLow/dist/thaiDist -> justify; unset defaults right for RTL).
	const isRtl = ts.rtl === true;
	style.textAlign = resolveCssTextAlign(ts.align, isRtl) ?? 'left';

	// Vertical text direction: writing-mode / text-orientation / direction.
	if (isVerticalTextDirection(ts.textDirection)) {
		const writingMode = toCssWritingMode(ts.textDirection);
		const textOrientation = toCssTextOrientation(ts.textDirection);
		const verticalDirection = toCssVerticalDirection(ts.textDirection);
		if (writingMode) {
			style.writingMode = writingMode;
		}
		if (textOrientation) {
			style.textOrientation = textOrientation;
		}
		if (verticalDirection) {
			style.direction = verticalDirection;
		} else if (isRtl) {
			style.direction = 'rtl';
		}
	} else if (isRtl) {
		style.direction = 'rtl';
	}

	switch (ts.vAlign) {
		case 'middle':
			style.justifyContent = 'center';
			break;
		case 'bottom':
			style.justifyContent = 'flex-end';
			break;
		default:
			style.justifyContent = 'flex-start';
	}

	return style;
}
