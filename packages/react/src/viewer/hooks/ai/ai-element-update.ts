/**
 * Binding-side adapter that applies a flat {@link PptxAiElementUpdate} (the
 * model-friendly field vocabulary shared with the MCP element tools) to a live
 * {@link PptxElement} in place.
 *
 * The shared AI tool layer never calls {@link PptxAiBridge.updateElement}
 * directly (its edit tools route through `applySlidesUpdate` / the proposal
 * store), so this exists only to give the React bridge a faithful, undoable
 * implementation of that choke point for hosts that call it themselves. It
 * mirrors `pptx-viewer-shared`'s internal `applyElementUpdate` field-by-field.
 */
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, ShapeStyle, TextStyle } from 'pptx-viewer-core';
import type { PptxAiElementUpdate } from 'pptx-viewer-shared/ai';

function applyGeometry(el: PptxElement, u: PptxAiElementUpdate): void {
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
}

function applyText(el: PptxElement, u: PptxAiElementUpdate): void {
	if (!hasTextProperties(el)) {
		return;
	}
	if (typeof u.text === 'string') {
		el.text = u.text;
		if (el.textSegments && el.textSegments.length > 0) {
			el.textSegments = [{ text: u.text, style: el.textSegments[0].style }];
		} else {
			el.textSegments = [{ text: u.text, style: {} }];
		}
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
	if (Object.keys(textStyle).length === 0) {
		return;
	}
	el.textStyle = { ...el.textStyle, ...textStyle };
	el.textSegments = el.textSegments?.map((seg) => ({
		...seg,
		style: { ...seg.style, ...textStyle },
	}));
}

function applyShapeStyle(el: PptxElement, u: PptxAiElementUpdate): void {
	if (!hasShapeProperties(el)) {
		return;
	}
	const shapeStyle: Partial<ShapeStyle> = {};
	if (u.fillColor !== undefined) {
		shapeStyle.fillColor = u.fillColor;
	}
	if (u.strokeColor !== undefined) {
		shapeStyle.strokeColor = u.strokeColor;
	}
	if (u.strokeWidth !== undefined) {
		shapeStyle.strokeWidth = u.strokeWidth;
	}
	if (Object.keys(shapeStyle).length === 0) {
		return;
	}
	el.shapeStyle = { ...el.shapeStyle, ...shapeStyle };
}

/** Apply geometry + text + shape-style field updates to one element in place. */
export function applyAiElementUpdate(el: PptxElement, updates: PptxAiElementUpdate): void {
	applyGeometry(el, updates);
	applyText(el, updates);
	applyShapeStyle(el, updates);
}
