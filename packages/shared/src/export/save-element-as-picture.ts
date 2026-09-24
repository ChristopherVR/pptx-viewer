/**
 * "Save as Picture" (the element context-menu command PowerPoint offers on
 * pictures, shapes, charts and SmartArt alike): rasterise one already-mounted
 * element node to PNG and hand it straight to the browser's download
 * mechanism.
 *
 * Every binding already rasterises a single element for other purposes
 * (export-to-PNG, "copy slide as image"): this module is the same
 * `rasterizeElement` + `rasterResultToPngBlob` + `downloadBlob` pipeline, with
 * the one extra step (a default file name) a context-menu command needs and a
 * plain export button does not. Kept here, once, instead of five bindings
 * each re-deriving the tiled/untiled branch and the download call.
 *
 * @module export/save-element-as-picture
 */
import { downloadBlob, sanitizeDownloadFilename } from './download-helpers';
import { rasterResultToPngBlob, rasterResultToPngDataUrl } from './raster-result-to-blob';
import type { RasterizeElementOptions } from './rasterize-element';
import { rasterizeElement } from './rasterize-element';

/**
 * Build the default download name for a saved element picture, e.g.
 * `My Shape.png` or `Picture 1.png` when the element has no display name.
 *
 * @param elementName - The element's own name/title, when the host tracks one.
 * @param fallbackLabel - A translated generic label ("Picture", "Shape", ...)
 *   used when `elementName` is empty; each binding supplies its own
 *   translator so the fallback is localised without this module importing i18n.
 */
export function elementPictureFilename(
	elementName: string | undefined,
	fallbackLabel: string,
): string {
	const base = elementName?.trim() || fallbackLabel;
	return sanitizeDownloadFilename(`${base}.png`);
}

/**
 * Rasterise `node` (an attached element, `naturalWidth` x `naturalHeight` CSS
 * pixels) and immediately download it as a PNG.
 *
 * @param node - The mounted DOM node for the single element (not the whole slide).
 * @param naturalWidth - The element's un-scaled width in CSS pixels.
 * @param naturalHeight - The element's un-scaled height in CSS pixels.
 * @param doc - The owner document (matches `rasterizeElement`'s signature; a
 *   presentation-mode or popped-out window may render into a different one).
 * @param filename - The suggested download name; sanitized by `downloadBlob`.
 * @param options - Forwarded to `rasterizeElement` (scale, background,
 *   the binding's `html2canvasFallback` driver, etc.).
 */
export async function saveElementAsPicture(
	node: HTMLElement,
	naturalWidth: number,
	naturalHeight: number,
	doc: Document,
	filename: string,
	options: RasterizeElementOptions,
): Promise<void> {
	const result = await rasterizeElement(node, naturalWidth, naturalHeight, doc, options);
	const blob = await rasterResultToPngBlob(result);
	downloadBlob(blob, filename);
}

/**
 * Rasterise `node` to a PNG data URL rather than downloading it: the same
 * pipeline as {@link saveElementAsPicture}, for Paste Special / Paste
 * Options's "Picture" format, which needs the pixels as an embeddable
 * `imageData` string, not a file on disk.
 *
 * @param node - The mounted DOM node for the single element (not the whole slide).
 * @param naturalWidth - The element's un-scaled width in CSS pixels.
 * @param naturalHeight - The element's un-scaled height in CSS pixels.
 * @param doc - The owner document.
 * @param options - Forwarded to `rasterizeElement`.
 */
export async function rasterizeElementToDataUrl(
	node: HTMLElement,
	naturalWidth: number,
	naturalHeight: number,
	doc: Document,
	options: RasterizeElementOptions,
): Promise<string> {
	const result = await rasterizeElement(node, naturalWidth, naturalHeight, doc, options);
	return rasterResultToPngDataUrl(result);
}
