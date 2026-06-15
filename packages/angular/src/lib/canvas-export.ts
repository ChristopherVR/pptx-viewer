/**
 * Canvas Export Utilities
 *
 * Provides a safe wrapper around html2canvas that resolves modern CSS colour
 * functions (oklch, oklab, lch, lab, color()) into rgb()/hex before rendering.
 *
 * html2canvas ≤ 1.x includes its own CSS parser that cannot handle these
 * newer colour spaces, causing "Attempting to parse an unsupported color
 * function" errors.
 *
 * Modern Chrome (111+) returns oklch/oklab values from `getComputedStyle()`
 * rather than converting them to rgb, so simply re-setting computed values
 * as inline styles is *not* sufficient. Instead we convert every unsupported
 * colour value to sRGB via the Canvas 2D API (`ctx.fillStyle` always
 * serialises to `#rrggbb` or `rgba()`), then inline the result.
 *
 * Additionally, Tailwind CSS v4 declares all colour tokens as oklch() custom
 * properties on :root, so we patch `<style>` elements in the cloned document
 * to replace those definitions as well.
 *
 * CSS preprocessing: Beyond colour conversion, the onclone callback also
 * applies a full CSS preprocessing pipeline to flatten backdrop-filter,
 * mix-blend-mode, 3D transforms, and other CSS features that html2canvas
 * cannot handle.
 */
/* eslint-disable require-unicode-regexp, prefer-named-capture-group -- these
   are ASCII-only CSS-token regexes (colour functions, transform tokens,
   units); the `u` flag and named groups are stylistic noise here, and the
   React source omits them too. */
import html2canvasPro from 'html2canvas-pro';
import type { Options as Html2CanvasOptions } from 'html2canvas-pro';

/* ------------------------------------------------------------------ */
/*  Blob URL → data URL conversion                                    */
/* ------------------------------------------------------------------ */

/**
 * Convert a single `blob:` URL to a `data:` URL via fetch + FileReader.
 * Returns `null` if the conversion fails (e.g. revoked blob).
 */
async function blobUrlToDataUrl(blobUrl: string): Promise<string | null> {
	try {
		const response = await fetch(blobUrl);
		const blob = await response.blob();
		return await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
}

/**
 * Find all `blob:` URLs in the cloned DOM and replace them with `data:` URLs.
 *
 * Why this is needed:
 * html2canvas-pro's OriginChecker parses blob URLs via an `<a>` element,
 * which reports `protocol = "blob:"` instead of the nested origin.  This
 * makes blob URLs appear cross-origin, so `useCORS: true` causes
 * `crossOrigin = "anonymous"` to be set on the Image loader.  Blob URLs
 * don't serve CORS headers → the image load fails silently.
 *
 * Additionally, for `<img>` elements html2canvas reads
 * `img.currentSrc || img.src`.  The cloned img may have already loaded
 * the blob URL before onclone fires, so `currentSrc` still returns the
 * old blob URL even after we update `src`.  To defeat this, we must
 * **replace** the element entirely so the new element has an empty
 * `currentSrc`.
 *
 * Data URLs are recognised as inline images by html2canvas and bypass
 * the CORS/origin machinery entirely.
 */
async function convertBlobUrlsToDataUrls(root: HTMLElement): Promise<void> {
	const promises: Promise<void>[] = [];

	// 1. <img> elements with blob: src — REPLACE the element to clear currentSrc
	const images = root.querySelectorAll<HTMLImageElement>('img[src^="blob:"]');
	for (const img of images) {
		const blobUrl = img.src;
		promises.push(
			blobUrlToDataUrl(blobUrl).then((dataUrl) => {
				if (!dataUrl) {
					return undefined;
				}
				// Build a fresh <img> so that currentSrc is empty and html2canvas
				// reads our data URL from .src instead.
				const replacement = img.ownerDocument.createElement('img');
				for (const attr of Array.from(img.attributes)) {
					if (attr.name !== 'src') {
						replacement.setAttribute(attr.name, attr.value);
					}
				}
				replacement.src = dataUrl;
				// Preserve inline styles
				replacement.style.cssText = img.style.cssText;
				img.parentNode?.replaceChild(replacement, img);
				return undefined;
			}),
		);
	}

	// 2. Elements with background-image containing blob: URLs
	//    (CSS background-image has no currentSrc issue — style replacement works)
	const allElements = root.querySelectorAll('*');
	for (const el of allElements) {
		const htmlEl = el as HTMLElement;
		const bg = htmlEl.style.backgroundImage;
		if (bg && bg.includes('blob:')) {
			const match = bg.match(/url\(["']?(blob:[^"')]+)["']?\)/);
			if (match) {
				const blobUrl = match[1];
				promises.push(
					blobUrlToDataUrl(blobUrl).then((dataUrl) => {
						if (dataUrl) {
							htmlEl.style.backgroundImage = bg.replace(blobUrl, dataUrl);
						}
						return undefined;
					}),
				);
			}
		}
	}

	// 3. Check the root element itself for background-image blob URLs
	const rootBg = root.style.backgroundImage;
	if (rootBg && rootBg.includes('blob:')) {
		const match = rootBg.match(/url\(["']?(blob:[^"')]+)["']?\)/);
		if (match) {
			const blobUrl = match[1];
			promises.push(
				blobUrlToDataUrl(blobUrl).then((dataUrl) => {
					if (dataUrl) {
						root.style.backgroundImage = rootBg.replace(blobUrl, dataUrl);
					}
					return undefined;
				}),
			);
		}
	}

	await Promise.all(promises);
}

/* ------------------------------------------------------------------ */
/*  Colour detection                                                  */
/* ------------------------------------------------------------------ */

/** Matches colour functions that html2canvas cannot parse. */
const UNSUPPORTED_COLOR_RE = /oklch|oklab|lch\(|lab\(|color\(/i;

/**
 * Matches full colour-function calls for regex replacement inside
 * complex CSS values (gradients, shadows, stylesheet text).
 * Handles one level of nested parentheses (e.g. `calc()` inside
 * colour functions).
 */
const UNSUPPORTED_COLOR_FN_RE = /(?:oklch|oklab|lch|lab|color)\([^)]*(?:\([^)]*\)[^)]*)*\)/gi;

/* ------------------------------------------------------------------ */
/*  Canvas 2D colour conversion                                      */
/* ------------------------------------------------------------------ */

/**
 * Lazily-created scratch Canvas 2D context.  The Canvas API always
 * serialises colours in sRGB, so any modern colour space round-trips
 * to `#rrggbb` (opaque) or `rgba(r,g,b,a)` (translucent).
 */
let _scratchCtx: CanvasRenderingContext2D | null | undefined;

function getScratchCtx(): CanvasRenderingContext2D | null {
	if (_scratchCtx === undefined) {
		_scratchCtx = document.createElement('canvas').getContext('2d');
	}
	return _scratchCtx;
}

/**
 * Convert a single CSS colour value to an sRGB hex or `rgba()` string.
 * Returns the original value unchanged when the input is invalid or the
 * Canvas API is unavailable.
 */
function resolveColorToSrgb(value: string): string {
	const ctx = getScratchCtx();
	if (!ctx) {
		return value;
	}

	const SENTINEL = '#020304';
	ctx.fillStyle = SENTINEL;
	ctx.fillStyle = value.trim();
	const result = ctx.fillStyle;
	// Canvas ignores invalid colours — fillStyle stays at the sentinel.
	return result === SENTINEL ? value : result;
}

/**
 * Replace every unsupported colour-function call inside an arbitrary
 * CSS value string (gradients, box-shadow, stylesheet text, …).
 */
function replaceUnsupportedColors(value: string): string {
	if (!UNSUPPORTED_COLOR_RE.test(value)) {
		return value;
	}
	return value.replace(UNSUPPORTED_COLOR_FN_RE, (match) => resolveColorToSrgb(match));
}

/* ------------------------------------------------------------------ */
/*  Property lists                                                    */
/* ------------------------------------------------------------------ */

/**
 * Simple colour properties whose computed value is a single colour.
 * We convert the entire value via `resolveColorToSrgb`.
 */
const COLOR_PROPERTIES: readonly string[] = [
	'color',
	'background-color',
	'border-top-color',
	'border-right-color',
	'border-bottom-color',
	'border-left-color',
	'outline-color',
	'text-decoration-color',
	'column-rule-color',
	'caret-color',
	'accent-color',
	'text-emphasis-color',
	'fill',
	'stroke',
	'stop-color',
	'flood-color',
	'lighting-color',
] as const;

/**
 * Properties whose computed values may embed colour functions inside
 * more complex syntax (gradients, shadows, images).  We use regex
 * replacement within the value string.
 */
const COMPLEX_COLOR_PROPERTIES: readonly string[] = [
	'box-shadow',
	'text-shadow',
	'background-image',
	'background',
	'border-image',
] as const;

/* ------------------------------------------------------------------ */
/*  Walk the cloned DOM and convert colours to sRGB                   */
/* ------------------------------------------------------------------ */

/**
 * Walks every element inside `root` and converts any computed colour
 * value that uses an unsupported colour function into sRGB, then
 * inlines the result so html2canvas only sees rgb()/hex.
 */
function resolveUnsupportedColours(root: HTMLElement): void {
	const elements = root.querySelectorAll('*');

	const resolve = (el: Element) => {
		const htmlEl = el as HTMLElement;
		if (!htmlEl.style) {
			return;
		}

		const computed = window.getComputedStyle(htmlEl);

		// Simple colour properties — convert the whole value.
		for (const prop of COLOR_PROPERTIES) {
			const value = computed.getPropertyValue(prop);
			if (value && UNSUPPORTED_COLOR_RE.test(value)) {
				htmlEl.style.setProperty(prop, resolveColorToSrgb(value));
			}
		}

		// Complex properties — replace colour functions in-place.
		for (const prop of COMPLEX_COLOR_PROPERTIES) {
			const value = computed.getPropertyValue(prop);
			if (value && UNSUPPORTED_COLOR_RE.test(value)) {
				htmlEl.style.setProperty(prop, replaceUnsupportedColors(value));
			}
		}

		// CSS custom properties on this element (inline `--*` vars).
		const inlineStyle = htmlEl.style;
		for (let i = 0; i < inlineStyle.length; i++) {
			const prop = inlineStyle[i];
			if (!prop.startsWith('--')) {
				continue;
			}
			const value = inlineStyle.getPropertyValue(prop);
			if (value && UNSUPPORTED_COLOR_RE.test(value)) {
				inlineStyle.setProperty(prop, replaceUnsupportedColors(value));
			}
		}
	};

	resolve(root);
	elements.forEach(resolve);
}

/* ------------------------------------------------------------------ */
/*  CSS custom-property cleanup on <html> / <body> / :root            */
/* ------------------------------------------------------------------ */

/**
 * Tailwind v4 themes define colour tokens as oklch() on :root / <body>.
 * Resolve any inline custom properties whose values are unsupported
 * colour functions to sRGB equivalents.
 */
function resolveRootCustomProperties(doc: Document): void {
	const targets = [doc.documentElement, doc.body];

	for (const target of targets) {
		if (!target) {
			continue;
		}
		const inlineStyle = target.style;

		for (let i = 0; i < inlineStyle.length; i++) {
			const prop = inlineStyle[i];
			if (!prop.startsWith('--')) {
				continue;
			}

			const value = inlineStyle.getPropertyValue(prop);
			if (value && UNSUPPORTED_COLOR_RE.test(value)) {
				inlineStyle.setProperty(prop, replaceUnsupportedColors(value));
			}
		}
	}
}

/* ------------------------------------------------------------------ */
/*  Stylesheet patching                                               */
/* ------------------------------------------------------------------ */

/**
 * Patch `<style>` elements in the cloned document, replacing oklch()
 * and other unsupported colour-function calls with sRGB equivalents.
 *
 * This catches CSS custom-property declarations on :root (e.g. from
 * Tailwind v4's `--color-*` tokens) that are defined in stylesheets
 * and thus not reachable via `element.style`.
 */
function patchStylesheets(doc: Document): void {
	const styles = doc.querySelectorAll('style');
	for (const style of styles) {
		const text = style.textContent ?? '';
		if (!UNSUPPORTED_COLOR_RE.test(text)) {
			continue;
		}
		style.textContent = text.replace(UNSUPPORTED_COLOR_FN_RE, (match) => resolveColorToSrgb(match));
	}
}

/* ------------------------------------------------------------------ */
/*  CSS preprocessing — flatten html2canvas-incompatible features     */
/* ------------------------------------------------------------------ */

/** Matches 3D transform functions in a CSS transform value. */
const TRANSFORM_3D_RE =
	/(?:translate3d|rotate3d|scale3d|matrix3d|perspective|translateZ|rotateX|rotateY|scaleZ)\s*\([^)]*\)/gi;

/** Mapping of blend modes to approximate opacity values. */
const BLEND_MODE_OPACITY_MAP: Record<string, number> = {
	multiply: 0.85,
	screen: 0.9,
	overlay: 0.8,
	darken: 0.9,
	lighten: 0.9,
	'color-dodge': 0.85,
	'color-burn': 0.85,
	'hard-light': 0.8,
	'soft-light': 0.9,
	difference: 0.7,
	exclusion: 0.75,
	hue: 0.85,
	saturation: 0.85,
	color: 0.85,
	luminosity: 0.85,
};

/**
 * Flatten a 3D CSS transform string to its 2D equivalent.
 * Returns `"none"` if all 3D parts are removed and nothing 2D remains.
 */
function flatten3dTransform(transformValue: string): string {
	if (!transformValue || transformValue === 'none') {
		return transformValue;
	}

	TRANSFORM_3D_RE.lastIndex = 0;
	if (!TRANSFORM_3D_RE.test(transformValue)) {
		return transformValue;
	}
	TRANSFORM_3D_RE.lastIndex = 0;

	let result = transformValue;

	result = result.replace(
		/translate3d\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)/gi,
		'translate($1, $2)',
	);
	result = result.replace(/translateZ\([^)]*\)/gi, '');
	result = result.replace(/scale3d\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)/gi, 'scale($1, $2)');
	result = result.replace(/scaleZ\([^)]*\)/gi, '');
	result = result.replace(/rotate[XY]\([^)]*\)/gi, '');
	result = result.replace(/rotate3d\([^)]*\)/giu, '');
	result = result.replace(/perspective\([^)]*\)/giu, '');
	result = result.replace(/matrix3d\(([^)]*)\)/giu, (_match, args: string) => {
		const vals = args.split(',').map((v: string) => parseFloat(v.trim()));
		if (vals.length === 16 && vals.every((v: number) => !isNaN(v))) {
			return `matrix(${vals[0]}, ${vals[1]}, ${vals[4]}, ${vals[5]}, ${vals[12]}, ${vals[13]})`;
		}
		return '';
	});

	result = result.replace(/\s{2,}/gu, ' ').trim();
	if (!result || result === 'matrix(1, 0, 0, 1, 0, 0)') {
		return 'none';
	}
	return result;
}

/**
 * Apply all CSS preprocessing steps to a cloned DOM subtree so that
 * html2canvas can render it correctly.
 *
 * Steps applied:
 * 1. Resolve `var()` references for common colour/layout properties.
 * 2. Flatten `backdrop-filter` to a background-colour approximation.
 * 3. Replace `mix-blend-mode` with an opacity fallback.
 * 4. Flatten 3D transforms to 2D equivalents.
 * 5. Remove/approximate CSS features html2canvas cannot handle.
 */
function preprocessCssForCapture(root: HTMLElement): void {
	const view = root.ownerDocument?.defaultView ?? window;
	const elements = root.querySelectorAll('*');

	const VAR_DEPENDENT_PROPERTIES: readonly string[] = [
		'color',
		'background-color',
		'background',
		'background-image',
		'border-color',
		'border-top-color',
		'border-right-color',
		'border-bottom-color',
		'border-left-color',
		'outline-color',
		'box-shadow',
		'text-shadow',
		'opacity',
		'font-size',
		'line-height',
		'letter-spacing',
		'border-radius',
		'padding',
		'margin',
		'gap',
		'width',
		'height',
		'max-width',
		'max-height',
		'min-width',
		'min-height',
		'fill',
		'stroke',
		'stop-color',
	] as const;

	const processEl = (el: Element) => {
		const htmlEl = el as HTMLElement;
		if (!htmlEl.style) {
			return;
		}

		const computed = view.getComputedStyle(htmlEl);

		// Step 1: Resolve var() references.
		for (const prop of VAR_DEPENDENT_PROPERTIES) {
			const inlineValue = htmlEl.style.getPropertyValue(prop);
			if (inlineValue && inlineValue.includes('var(')) {
				const computedValue = computed.getPropertyValue(prop);
				if (computedValue) {
					htmlEl.style.setProperty(prop, computedValue);
				}
			}
		}

		// Step 2: Flatten backdrop-filter.
		const backdropFilter =
			computed.getPropertyValue('backdrop-filter') ||
			computed.getPropertyValue('-webkit-backdrop-filter');
		if (backdropFilter && backdropFilter !== 'none') {
			const blurMatch = backdropFilter.match(/blur\(\s*([\d.]+)\s*px\s*\)/iu);
			const blurPx = blurMatch ? parseFloat(blurMatch[1]) : 0;
			htmlEl.style.setProperty('backdrop-filter', 'none');
			htmlEl.style.setProperty('-webkit-backdrop-filter', 'none');
			if (blurPx > 0) {
				const currentBg = computed.getPropertyValue('background-color');
				if (!currentBg || currentBg === 'transparent' || currentBg === 'rgba(0, 0, 0, 0)') {
					const opacity = Math.min(0.85, 0.4 + blurPx * 0.02);
					htmlEl.style.setProperty(
						'background-color',
						`rgba(255, 255, 255, ${opacity.toFixed(2)})`,
					);
				}
			}
		}

		// Step 3: Replace mix-blend-mode with opacity fallback.
		const blendMode = computed.getPropertyValue('mix-blend-mode');
		if (blendMode && blendMode !== 'normal') {
			htmlEl.style.setProperty('mix-blend-mode', 'normal');
			const currentOpacity = parseFloat(computed.getPropertyValue('opacity') || '1');
			const blendOpacity = BLEND_MODE_OPACITY_MAP[blendMode] ?? 1;
			const combinedOpacity = currentOpacity * blendOpacity;
			if (combinedOpacity < 1) {
				htmlEl.style.setProperty('opacity', combinedOpacity.toFixed(2));
			}
		}

		// Step 4: Flatten 3D transforms.
		const transform = computed.getPropertyValue('transform');
		if (transform && transform !== 'none') {
			TRANSFORM_3D_RE.lastIndex = 0;
			if (TRANSFORM_3D_RE.test(transform)) {
				TRANSFORM_3D_RE.lastIndex = 0;
				htmlEl.style.setProperty('transform', flatten3dTransform(transform));
			}
		}

		// Step 5: Remove/approximate unsupported CSS features.
		const maskImage =
			computed.getPropertyValue('mask-image') || computed.getPropertyValue('-webkit-mask-image');
		if (maskImage && maskImage !== 'none') {
			if (maskImage.includes('url(') && !maskImage.includes('data:')) {
				htmlEl.style.setProperty('mask-image', 'none');
				htmlEl.style.setProperty('-webkit-mask-image', 'none');
			}
		}

		const boxReflect = computed.getPropertyValue('-webkit-box-reflect');
		if (boxReflect && boxReflect !== 'none') {
			htmlEl.style.setProperty('-webkit-box-reflect', 'none');
		}

		const textStroke = computed.getPropertyValue('-webkit-text-stroke');
		if (textStroke && textStroke !== '0px' && textStroke !== '0px rgb(0, 0, 0)') {
			const strokeMatch = textStroke.match(/([\d.]+)px\s+(.*)/u);
			if (strokeMatch) {
				const width = parseFloat(strokeMatch[1]);
				const colour = strokeMatch[2] || 'black';
				const offsets = [
					[width, 0],
					[-width, 0],
					[0, width],
					[0, -width],
				];
				const shadows = offsets.map(([x, y]) => `${x}px ${y}px 0 ${colour}`).join(', ');
				const existing = computed.getPropertyValue('text-shadow');
				const combined = existing && existing !== 'none' ? `${existing}, ${shadows}` : shadows;
				htmlEl.style.setProperty('text-shadow', combined);
				htmlEl.style.setProperty('-webkit-text-stroke', '0');
			}
		}
	};

	processEl(root);
	elements.forEach(processEl);
}

/* ------------------------------------------------------------------ */
/*  Test-only exports                                                 */
/* ------------------------------------------------------------------ */

/**
 * @internal Exported for unit testing only — not part of the public API.
 */
export const _testing = {
	UNSUPPORTED_COLOR_RE,
	UNSUPPORTED_COLOR_FN_RE,
	resolveColorToSrgb,
	replaceUnsupportedColors,
	resolveUnsupportedColours,
	resolveRootCustomProperties,
	patchStylesheets,
	convertBlobUrlsToDataUrls,
	blobUrlToDataUrl,
	COLOR_PROPERTIES,
	COMPLEX_COLOR_PROPERTIES,
	/** Reset the lazily-cached scratch context (useful in tests). */
	resetScratchCtx() {
		_scratchCtx = undefined;
	},
	/** Override the scratch context with a mock (useful in tests). */
	setScratchCtx(ctx: CanvasRenderingContext2D | null) {
		_scratchCtx = ctx;
	},
} as const;

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * A drop-in replacement for `html2canvas(element, options)` that first
 * resolves any oklch / oklab / lch / lab / color() values in the cloned
 * DOM to rgb()/hex, preventing parse errors in html2canvas ≤ 1.x.
 *
 * Three-pronged approach:
 * 1. Patch `<style>` elements to replace oklch in CSS custom properties.
 * 2. Resolve `:root` / `<body>` inline custom properties.
 * 3. Walk every element and convert computed colour values to sRGB.
 *
 * Usage:
 * ```ts
 * import { renderToCanvas } from '../lib/canvas-export';
 * const canvas = await renderToCanvas(element, { scale: 2 });
 * ```
 */
export async function renderToCanvas(
	element: HTMLElement,
	options: Partial<Html2CanvasOptions> = {},
): Promise<HTMLCanvasElement> {
	const userOnClone = options.onclone;

	return html2canvasPro(element, {
		...options,
		onclone: async (doc: Document, clonedEl: HTMLElement) => {
			// Phase 0: Convert blob: URLs to data: URLs so html2canvas can load them.
			// blob: URLs fail when useCORS is true because they don't serve CORS headers.
			await convertBlobUrlsToDataUrls(clonedEl);

			// Phase 1: Patch stylesheets and root custom properties (colour fix)
			patchStylesheets(doc);
			resolveRootCustomProperties(doc);
			resolveUnsupportedColours(clonedEl);

			// Phase 2: CSS preprocessing — flatten backdrop-filter, mix-blend-mode,
			// 3D transforms, and remove unsupported features
			preprocessCssForCapture(clonedEl);

			// Honour any caller-provided onclone as well.
			if (typeof userOnClone === 'function') {
				userOnClone(doc, clonedEl);
			}
		},
	});
}
