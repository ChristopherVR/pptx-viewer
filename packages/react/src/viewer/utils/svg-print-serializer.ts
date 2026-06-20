/**
 * SVG Print Serializer
 *
 * Provides a direct DOM-to-SVG serialization path for high-fidelity
 * print output, bypassing html2canvas entirely. This produces vector
 * output that remains sharp at any DPI.
 *
 * Strategy:
 * - Uses SVG `<foreignObject>` to embed HTML slide content
 * - Inlines all computed styles to make the SVG self-contained
 * - Embeds images as base64 data URIs
 * - Produces an SVG that can be rendered to PDF via the browser's
 *   native print pipeline or converted with a lightweight library
 *
 * @module svg-print-serializer
 */

/*
 * The pure string-assembly / escaping helpers (escapeXml, buildPrintStyleSheet,
 * buildPrintDocument, svgToDataUrl) plus the SvgPrintOptions / SvgPrintResult
 * shapes now live once in `pptx-viewer-shared` (`export/svg-print`); they are
 * re-exported here so consumers keep their historical import path. Only the
 * DOM-bound driver code (style collection, image fetching, element cloning /
 * serialization, Blob wrapping) remains local below.
 */
import {
	buildPrintDocument,
	buildPrintStyleSheet,
	escapeXml,
	svgToDataUrl,
} from 'pptx-viewer-shared';
import type { SvgPrintOptions, SvgPrintResult } from 'pptx-viewer-shared';

export { escapeXml, buildPrintStyleSheet, buildPrintDocument, svgToDataUrl };
export type { SvgPrintOptions, SvgPrintResult };

/* ------------------------------------------------------------------ */
/*  Style Collection                                                   */
/* ------------------------------------------------------------------ */

/**
 * CSS properties to inline for self-contained SVG output.
 * This is a subset of commonly needed visual properties.
 */
const INLINE_STYLE_PROPERTIES: readonly string[] = [
	'display',
	'position',
	'top',
	'right',
	'bottom',
	'left',
	'width',
	'height',
	'min-width',
	'min-height',
	'max-width',
	'max-height',
	'margin',
	'padding',
	'border',
	'border-radius',
	'background',
	'background-color',
	'background-image',
	'background-size',
	'background-position',
	'background-repeat',
	'color',
	'font-family',
	'font-size',
	'font-weight',
	'font-style',
	'line-height',
	'letter-spacing',
	'text-align',
	'text-decoration',
	'text-transform',
	'text-shadow',
	'white-space',
	'word-break',
	'overflow',
	'overflow-x',
	'overflow-y',
	'opacity',
	'visibility',
	'z-index',
	'transform',
	'transform-origin',
	'box-shadow',
	'clip-path',
	'filter',
	'flex',
	'flex-direction',
	'flex-wrap',
	'align-items',
	'justify-content',
	'gap',
	'grid-template-columns',
	'grid-template-rows',
	'grid-column',
	'grid-row',
	'object-fit',
	'object-position',
	'vertical-align',
	'fill',
	'stroke',
	'stroke-width',
] as const;

/**
 * Collect computed styles for an element, returning only properties
 * that differ from the defaults (to minimize SVG size).
 */
export function collectInlineStyles(
	element: HTMLElement,
	properties: readonly string[] = INLINE_STYLE_PROPERTIES,
): string {
	const computed = window.getComputedStyle(element);
	const styles: string[] = [];

	for (const prop of properties) {
		const value = computed.getPropertyValue(prop);
		if (
			value &&
			value !== 'initial' &&
			value !== 'normal' &&
			value !== 'auto' &&
			value !== 'none' &&
			value !== '0px'
		) {
			styles.push(`${prop}: ${value}`);
		}
	}

	return styles.join('; ');
}

/* ------------------------------------------------------------------ */
/*  Image Embedding                                                    */
/* ------------------------------------------------------------------ */

/**
 * Convert an image URL to a base64 data URI.
 * Returns the original URL if conversion fails (e.g. CORS).
 */
export async function imageToBase64(url: string): Promise<string> {
	// Skip already-embedded images
	if (url.startsWith('data:')) {
		return url;
	}
	// Skip blob URLs (can't fetch cross-origin)
	if (url.startsWith('blob:')) {
		return url;
	}

	try {
		const response = await fetch(url, { mode: 'cors' });
		const blob = await response.blob();
		return new Promise<string>((resolve) => {
			const reader = new FileReader();
			reader.onloadend = () => {
				resolve((reader.result as string) || url);
			};
			reader.onerror = () => resolve(url);
			reader.readAsDataURL(blob);
		});
	} catch {
		return url;
	}
}

/**
 * Find all images in an element subtree and return their src URLs.
 */
export function collectImageUrls(root: HTMLElement): string[] {
	const urls: string[] = [];
	const images = root.querySelectorAll('img');

	for (const img of images) {
		if (img.src) {
			urls.push(img.src);
		}
	}

	// Also check for background-image URLs
	const allElements = root.querySelectorAll('*');
	for (const el of allElements) {
		const htmlEl = el as HTMLElement;
		const computed = window.getComputedStyle(htmlEl);
		const bgImage = computed.getPropertyValue('background-image');
		if (bgImage && bgImage !== 'none') {
			const urlMatch = bgImage.match(/url\(["']?(?<bgUrl>[^"')]+)["']?\)/u);
			if (urlMatch?.groups?.bgUrl) {
				urls.push(urlMatch.groups.bgUrl);
			}
		}
	}

	return [...new Set(urls)];
}

/* ------------------------------------------------------------------ */
/*  SVG Print Document Construction                                    */
/* ------------------------------------------------------------------ */

/**
 * Serialize an HTML element subtree to a self-contained SVG string
 * using `<foreignObject>` for HTML embedding.
 *
 * The resulting SVG can be:
 * - Rendered in a browser at any zoom level without quality loss
 * - Printed via the browser's native print pipeline
 * - Converted to PDF with SVG-to-PDF tools
 *
 * @param element - The slide stage HTML element to serialize.
 * @param options - Serialization options.
 * @returns An SvgPrintResult with the SVG string and dimensions.
 */
export function serializeElementToSvg(
	element: HTMLElement,
	options: SvgPrintOptions,
): SvgPrintResult {
	const { width, height, backgroundColor, inlineStyles = true, customCss } = options;

	// Clone the element to avoid mutating the live DOM
	const clone = element.cloneNode(true) as HTMLElement;

	// Optionally inline computed styles on each element
	if (inlineStyles) {
		inlineComputedStyles(element, clone);
	}

	// Serialize the clone to HTML
	const htmlContent = clone.outerHTML;

	// Build the stylesheet for the foreignObject
	const printCss = buildPrintStyleSheet(width, height, customCss);

	// Construct the SVG document
	const bgRect = backgroundColor
		? `<rect width="${width}" height="${height}" fill="${escapeXml(backgroundColor)}" />`
		: '';

	const svg = [
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
		`     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
		`  <defs>`,
		`    <style type="text/css"><![CDATA[${printCss}]]></style>`,
		`  </defs>`,
		bgRect ? `  ${bgRect}` : '',
		`  <foreignObject x="0" y="0" width="${width}" height="${height}">`,
		`    <div xmlns="http://www.w3.org/1999/xhtml" style="width: ${width}px; height: ${height}px; overflow: hidden;">`,
		`      ${htmlContent}`,
		`    </div>`,
		`  </foreignObject>`,
		`</svg>`,
	]
		.filter(Boolean)
		.join('\n');

	return { svg, width, height };
}

/**
 * Inline computed styles from the original element tree onto the cloned tree.
 *
 * Walks both trees in parallel, reading computed styles from the original
 * (which is in the live document) and writing them to the clone.
 */
function inlineComputedStyles(original: HTMLElement, clone: HTMLElement): void {
	const origChildren = original.querySelectorAll('*');
	const cloneChildren = clone.querySelectorAll('*');

	// PHASE 1: read pass.
	// Walk the live tree once, collect every getComputedStyle() result into a
	// Map keyed by element index. Doing all reads up-front avoids interleaving
	// layout reads with the writes in phase 2 (which would otherwise force
	// repeated style recalcs / forced reflows).
	const styleMap = new Map<number, string>();
	const rootStyle = collectInlineStyles(original);
	for (let i = 0; i < origChildren.length; i++) {
		const origEl = origChildren[i] as HTMLElement;
		if (!origEl.style) {
			continue;
		}
		styleMap.set(i, collectInlineStyles(origEl));
	}

	// PHASE 2: write pass.
	// The clone is detached from the live document, so setAttribute calls
	// here do not trigger layout on the original tree.
	if (rootStyle) {
		clone.setAttribute('style', rootStyle);
	}
	for (let i = 0; i < origChildren.length && i < cloneChildren.length; i++) {
		const cloneEl = cloneChildren[i] as HTMLElement;
		if (!cloneEl.setAttribute) {
			continue;
		}
		const styles = styleMap.get(i);
		if (styles) {
			cloneEl.setAttribute('style', styles);
		}
	}
}

/* ------------------------------------------------------------------ */
/*  Utility: SVG to Blob                                               */
/* ------------------------------------------------------------------ */

/**
 * Convert an SVG string to a Blob. (DOM-bound; stays in the binding.)
 */
export function svgToBlob(svg: string): Blob {
	return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}
