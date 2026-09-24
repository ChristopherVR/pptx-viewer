/**
 * Paste Special (Ctrl+Alt+V) and the Paste Options mini-toolbar PowerPoint
 * shows right after an ordinary paste. Both surfaces offer the same four
 * choices, applied to the just-pasted clone: Keep Source Formatting, Use
 * Destination Theme, Picture, Keep Text Only.
 *
 * This viewer's clipboard is an in-memory element snapshot (see
 * `element-clipboard.ts`), not real OS clipboard formats, so "Paste Special"
 * here means "how should the clone that `cloneElementForPaste` already
 * produced be reshaped", not "which of several MIME payloads to decode".
 * Three of the four formats are pure element transforms and live here; the
 * fourth (Picture) needs a DOM rasterization step only a binding can perform,
 * so this module only builds the resulting element once the binding hands it
 * a rendered data URL (see {@link buildRasterPictureElement}).
 *
 * @module render/paste-special
 */
import type { PptxElement } from 'pptx-viewer-core';

/** The four paste formats PowerPoint's Paste Options / Paste Special offer. */
export type PasteSpecialFormat =
	| 'keep-source-formatting'
	| 'use-destination-theme'
	| 'picture'
	| 'keep-text-only';

/** One entry in the Paste Special dialog / Paste Options toolbar. */
export interface PasteSpecialOption {
	id: PasteSpecialFormat;
	/** i18n key; the binding translates it with its own translator. */
	labelKey: string;
}

/**
 * The four options, in the order PowerPoint's Paste Options toolbar shows
 * them (Keep Source Formatting is the default/first icon).
 */
export const PASTE_SPECIAL_OPTIONS: readonly PasteSpecialOption[] = [
	{ id: 'keep-source-formatting', labelKey: 'pptx.pasteSpecial.keepSourceFormatting' },
	{ id: 'use-destination-theme', labelKey: 'pptx.pasteSpecial.useDestinationTheme' },
	{ id: 'picture', labelKey: 'pptx.pasteSpecial.picture' },
	{ id: 'keep-text-only', labelKey: 'pptx.pasteSpecial.keepTextOnly' },
];

/** Whether `element` carries any text "Keep Text Only" could keep. */
export function pasteElementHasText(element: PptxElement): boolean {
	return 'text' in element && typeof element.text === 'string' && element.text.trim().length > 0;
}

/**
 * Strip the explicit colour/font overrides "Use Destination Theme" should
 * drop, so the normal Element -> Placeholder -> Layout -> Master -> Theme
 * resolution cascade supplies the destination deck's own theme colours and
 * fonts instead of the ones the source deck baked in.
 *
 * This clears solid fill/stroke colours and their theme-colour references
 * (both are "the source's opinion") and any explicit run/paragraph font
 * family override, but leaves gradient stops, images and non-colour effects
 * alone: PowerPoint's own "Use Destination Theme" only ever changes colour
 * scheme and font scheme, never geometry or imagery.
 */
function stripSourceThemeOverrides(element: PptxElement): PptxElement {
	const next = structuredClone(element);
	if ('shapeStyle' in next && next.shapeStyle) {
		const style = { ...next.shapeStyle };
		delete style.fillColor;
		delete style.fillColorRef;
		delete style.strokeColor;
		delete style.strokeColorRef;
		next.shapeStyle = style;
	}
	if ('textStyle' in next && next.textStyle) {
		const style = { ...next.textStyle };
		delete style.color;
		delete style.fontFamily;
		next.textStyle = style;
	}
	if ('textSegments' in next && Array.isArray(next.textSegments)) {
		next.textSegments = next.textSegments.map((segment) => {
			const style = segment.style ? { ...segment.style } : undefined;
			if (!style) {
				return segment;
			}
			delete style.color;
			delete style.fontFamily;
			return { ...segment, style };
		});
	}
	return next;
}

/** Reduce `element` to a bare text box holding only its plain text content. */
function toTextOnly(element: PptxElement): PptxElement {
	if (!pasteElementHasText(element)) {
		// Nothing to keep: PowerPoint disables this choice for a picture/media/
		// table with no text of its own, so a caller should not have offered it,
		// but degrading to an unchanged clone (rather than an empty text box) is
		// the safer fallback if it did.
		return element;
	}
	return {
		type: 'text',
		id: element.id,
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
		rotation: element.rotation,
		text: 'text' in element ? element.text : undefined,
	};
}

/**
 * Apply `format` to an already-cloned pasted element (fresh id and cascade
 * offset already applied by `cloneElementForPaste`). `keep-source-formatting`
 * and `picture` are no-ops here: the former is the clone as-is, the latter is
 * built separately by {@link buildRasterPictureElement} once the binding has
 * rasterized it.
 */
export function applyPasteSpecialFormat(
	element: PptxElement,
	format: PasteSpecialFormat,
): PptxElement {
	switch (format) {
		case 'use-destination-theme':
			return stripSourceThemeOverrides(element);
		case 'keep-text-only':
			return toTextOnly(element);
		case 'keep-source-formatting':
		case 'picture':
		default:
			return element;
	}
}

/**
 * Build the "Picture" paste result: the pasted element's own id/position/
 * rotation, but reduced to a flattened raster image. The binding rasterizes
 * the mounted clone's DOM node (the same `rasterizeElement` pipeline
 * `save-as-picture.ts` uses) and hands the resulting data URL here; this
 * function only assembles the resulting element so the decision of what a
 * "Picture" paste contains stays in one place for all five bindings.
 */
export function buildRasterPictureElement(element: PptxElement, dataUrl: string): PptxElement {
	return {
		type: 'picture',
		id: element.id,
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
		rotation: element.rotation,
		imageData: dataUrl,
	};
}
