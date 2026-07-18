/**
 * Apply an {@link PptxAiElementUpdate} to a single (already cloned) element in
 * place. Mirrors the field vocabulary of the shared AI mutation helper so the
 * vanilla bridge's {@link PptxAiBridge.updateElement} choke point behaves like
 * the MCP / in-viewer tools. Kept local because the shared helper is internal
 * to `pptx-viewer-shared/ai` and not re-exported from its barrel.
 */

import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxElementWithText } from 'pptx-viewer-core';
import type { PptxAiElementUpdate } from 'pptx-viewer-shared/ai';

interface MutableShapeStyle {
	fillColor?: string;
	strokeColor?: string;
	strokeWidth?: number;
}

/** Apply geometry + text + shape-style updates to one element in place. */
export function applyAiElementUpdate(el: PptxElement, u: PptxAiElementUpdate): void {
	if (u.x !== undefined) {
		el.x = u.x;
	}
	if (u.y !== undefined) {
		el.y = u.y;
	}
	if (u.width !== undefined) {
		el.width = u.width;
	}
	if (u.height !== undefined) {
		el.height = u.height;
	}
	if (u.rotation !== undefined) {
		el.rotation = u.rotation;
	}
	if (u.opacity !== undefined) {
		el.opacity = u.opacity;
	}
	if (u.hidden !== undefined) {
		el.hidden = u.hidden;
	}
	if (u.flipHorizontal !== undefined) {
		el.flipHorizontal = u.flipHorizontal;
	}
	if (u.flipVertical !== undefined) {
		el.flipVertical = u.flipVertical;
	}
	applyTextUpdate(el, u);
	applyShapeStyleUpdate(el, u);
}

function applyTextUpdate(el: PptxElement, u: PptxAiElementUpdate): void {
	if (!hasTextProperties(el)) {
		return;
	}
	const textEl = el as PptxElementWithText;
	if (u.text !== undefined) {
		textEl.text = u.text;
		if (textEl.textSegments && textEl.textSegments.length > 0) {
			textEl.textSegments[0].text = u.text;
		} else {
			textEl.textSegments = [{ text: u.text, style: {} }];
		}
	}
	if (
		u.fontSize === undefined &&
		u.fontFamily === undefined &&
		u.fontColor === undefined &&
		u.bold === undefined &&
		u.italic === undefined &&
		u.underline === undefined &&
		u.align === undefined
	) {
		return;
	}
	textEl.textStyle ??= {};
	const style = textEl.textStyle;
	if (u.fontSize !== undefined) {
		style.fontSize = u.fontSize;
	}
	if (u.fontFamily !== undefined) {
		style.fontFamily = u.fontFamily;
	}
	if (u.fontColor !== undefined) {
		style.color = u.fontColor;
	}
	if (u.bold !== undefined) {
		style.bold = u.bold;
	}
	if (u.italic !== undefined) {
		style.italic = u.italic;
	}
	if (u.underline !== undefined) {
		style.underline = u.underline;
	}
	if (u.align !== undefined) {
		style.align = u.align;
	}
}

function applyShapeStyleUpdate(el: PptxElement, u: PptxAiElementUpdate): void {
	if (u.fillColor === undefined && u.strokeColor === undefined && u.strokeWidth === undefined) {
		return;
	}
	if (!('shapeStyle' in el)) {
		return;
	}
	const holder = el as unknown as { shapeStyle?: MutableShapeStyle };
	holder.shapeStyle ??= {};
	const style = holder.shapeStyle;
	if (u.fillColor !== undefined) {
		style.fillColor = u.fillColor;
	}
	if (u.strokeColor !== undefined) {
		style.strokeColor = u.strokeColor;
	}
	if (u.strokeWidth !== undefined) {
		style.strokeWidth = u.strokeWidth;
	}
}
