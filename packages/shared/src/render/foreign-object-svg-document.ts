import { collectExternalFontFaceCss, collectFontFaceCss } from './foreign-object-font-embed';
import type { FontStyleDocumentLike, LinkStyleDocumentLike } from './foreign-object-font-embed';
/**
 * Assemble a self-contained SVG `foreignObject` document from a live slide
 * DOM subtree: the "does not depend on html2canvas's CSS subset" raster
 * path. Combines three already-shared primitives:
 *
 * - {@link inlineComputedStylesOnClone} (`foreign-object-style-inline.ts`):
 *   copies every computed style onto a detached clone, so custom properties,
 *   `backdrop-filter` and 3D transforms survive as concrete values the
 *   browser's own layout/paint engine (not html2canvas's) rasterises.
 * - {@link collectFontFaceCss} (`foreign-object-font-embed.ts`): reuses the
 *   deck's already-`data:`-URI `@font-face` CSS every binding injects for
 *   on-screen rendering.
 * - {@link embedImagesOnClone} (`foreign-object-image-embed.ts`): inlines any
 *   `blob:`/`http(s):` image reference that isn't already a `data:` URI.
 *
 * The result is split into a `bodyMarkup` (the `<defs>` + background rect +
 * `foreignObject` content, independent of output size) and a cheap
 * {@link wrapForeignObjectSvg} step that wraps it in an outer `<svg>` sized
 * for one export tile. Splitting the two means a tiled export pays the
 * (relatively) expensive clone/style/font/image work exactly once per slide,
 * then only re-wraps a viewBox window per tile.
 */
import { embedImagesOnClone, fetchAsDataUrl } from './foreign-object-image-embed';
import { inlineComputedStylesOnClone } from './foreign-object-style-inline';
import type { ComputedStyleReader } from './foreign-object-style-inline';

/** Options for {@link buildForeignObjectSvgBody}. */
export interface ForeignObjectSvgBodyOptions {
	/** Natural (unscaled, CSS px) content width. */
	width: number;
	/** Natural (unscaled, CSS px) content height. */
	height: number;
	/** Optional solid background painted behind the foreignObject content. */
	backgroundColor?: string;
	/** Defaults to `window.getComputedStyle`; injectable for tests. */
	readComputedStyle?: ComputedStyleReader;
}

/** The reusable, size-independent SVG body, plus whether every image embedded cleanly. */
export interface ForeignObjectSvgBody {
	/** `<defs>` (font-faces) + optional background rect + `<foreignObject>` markup. */
	bodyMarkup: string;
	/** `false` when at least one image reference could not be inlined as `data:`. */
	allEmbedded: boolean;
	naturalWidth: number;
	naturalHeight: number;
}

function escapeAttr(value: string): string {
	return value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;');
}

/**
 * Build the reusable SVG body for `element`: clone it, inline every computed
 * style, embed fonts and images, and return the `<defs>` + background +
 * `foreignObject` markup ready to be wrapped by {@link wrapForeignObjectSvg}.
 *
 * `element` must be attached to `doc` so `getComputedStyle` resolves real
 * values; the clone this function produces is fully detached and never
 * mutates the live tree.
 */
export async function buildForeignObjectSvgBody(
	element: HTMLElement,
	doc: Document & FontStyleDocumentLike & LinkStyleDocumentLike,
	options: ForeignObjectSvgBodyOptions,
): Promise<ForeignObjectSvgBody> {
	const {
		width,
		height,
		backgroundColor,
		readComputedStyle = (el) => window.getComputedStyle(el),
	} = options;

	const clone = element.cloneNode(true) as HTMLElement;
	inlineComputedStylesOnClone(element, clone, readComputedStyle);

	const [{ allEmbedded: imagesEmbedded }, externalFonts] = await Promise.all([
		embedImagesOnClone(clone),
		collectExternalFontFaceCss(doc, fetchAsDataUrl),
	]);
	const allEmbedded = imagesEmbedded && externalFonts.allEmbedded;

	const fontFaceCss = [collectFontFaceCss(doc), externalFonts.css].filter(Boolean).join('\n\n');
	const defs = fontFaceCss
		? `<defs><style type="text/css"><![CDATA[${fontFaceCss}]]></style></defs>`
		: '';
	const bgRect = backgroundColor
		? `<rect width="${width}" height="${height}" fill="${escapeAttr(backgroundColor)}" />`
		: '';

	const bodyMarkup = [
		defs,
		bgRect,
		`<foreignObject x="0" y="0" width="${width}" height="${height}">`,
		`<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;">`,
		clone.outerHTML,
		'</div>',
		'</foreignObject>',
	].join('');

	return { bodyMarkup, allEmbedded, naturalWidth: width, naturalHeight: height };
}

/** A viewBox window into the body's natural coordinate space, for one output tile. */
export interface ForeignObjectTileWindow {
	/** Left edge of the window, in the body's natural (unscaled) coordinates. */
	viewBoxX: number;
	/** Top edge of the window, in the body's natural (unscaled) coordinates. */
	viewBoxY: number;
	/** Window width, in the body's natural (unscaled) coordinates. */
	viewBoxWidth: number;
	/** Window height, in the body's natural (unscaled) coordinates. */
	viewBoxHeight: number;
	/** Output raster width in device pixels for this tile. */
	outputWidth: number;
	/** Output raster height in device pixels for this tile. */
	outputHeight: number;
}

/**
 * Wrap a {@link ForeignObjectSvgBody.bodyMarkup} in an outer `<svg>` sized and
 * windowed for one output tile. For the common non-tiled case, pass a window
 * covering the full natural size with `outputWidth`/`outputHeight` at the
 * desired export scale.
 */
export function wrapForeignObjectSvg(bodyMarkup: string, tile: ForeignObjectTileWindow): string {
	const { viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight, outputWidth, outputHeight } = tile;
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
		`width="${outputWidth}" height="${outputHeight}" ` +
		`viewBox="${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}">${bodyMarkup}</svg>`
	);
}
