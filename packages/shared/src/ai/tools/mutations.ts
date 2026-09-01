/**
 * Pure, in-place mutation helpers used inside slides updaters. Each operates on
 * a single (already cloned) element or slide so it is safe to call from an
 * updater passed to {@link PptxAiBridge.applySlidesUpdate} / the proposal store.
 *
 * The field vocabulary mirrors the `pptx-viewer-mcp` element tools so behaviour
 * is consistent between the MCP server and the in-viewer assistant.
 */

import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxElementWithText, TextStyle } from 'pptx-viewer-core';

import type { PptxAiElementUpdate } from '../bridge';

interface MutableShapeStyle {
	fillColor?: string;
	strokeColor?: string;
	strokeWidth?: number;
}

/** Apply geometry + style updates to one element in place. */
export function applyElementUpdate(el: PptxElement, u: PptxAiElementUpdate): void {
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

/** Apply text + font updates when the element carries text. */
export function applyTextUpdate(el: PptxElement, u: PptxAiElementUpdate): void {
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
	const textStyle: Partial<TextStyle> = {};
	if (u.fontSize !== undefined) {
		textStyle.fontSize = u.fontSize;
	}
	if (u.fontFamily !== undefined) {
		textStyle.fontFamily = u.fontFamily;
	}
	if (u.fontColor !== undefined) {
		textStyle.color = u.fontColor;
	}
	if (u.bold !== undefined) {
		textStyle.bold = u.bold;
	}
	if (u.italic !== undefined) {
		textStyle.italic = u.italic;
	}
	if (u.underline !== undefined) {
		textStyle.underline = u.underline;
	}
	if (u.align !== undefined) {
		textStyle.align = u.align;
	}
	// Set the element-level default AND merge onto every run so multi-run text
	// visibly restyles instead of only the (unused) element-level fallback.
	textEl.textStyle = { ...textEl.textStyle, ...textStyle };
	if (textEl.textSegments) {
		textEl.textSegments = textEl.textSegments.map((seg) => ({
			...seg,
			style: { ...seg.style, ...textStyle },
		}));
	}
}

/** Apply fill/stroke updates when the element carries a shape style. */
export function applyShapeStyleUpdate(el: PptxElement, u: PptxAiElementUpdate): void {
	if (u.fillColor === undefined && u.strokeColor === undefined && u.strokeWidth === undefined) {
		return;
	}
	// `hasShapeProperties` narrows by `element.type` (text/shape/connector/image/
	// picture). A raw `'shapeStyle' in el` check is unsound here: `shapeStyle` is
	// an optional field, so an element parsed with no fill/stroke never gets the
	// key assigned and the check silently drops the update.
	if (!hasShapeProperties(el)) {
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

/** Renumber slides 1..n after an insertion / deletion / reorder. */
export function renumberSlides(slides: { slideNumber: number }[]): void {
	slides.forEach((s, i) => {
		s.slideNumber = i + 1;
	});
}
