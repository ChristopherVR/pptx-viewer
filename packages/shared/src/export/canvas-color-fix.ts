/**
 * Modern-colour-space normalisation for html2canvas capture, shared by every
 * binding's export pipeline. Pure DOM helpers (no framework, no html2canvas
 * import) so each binding's thin `renderToCanvas` wrapper consumes one copy.
 *
 * html2canvas <= 1.x includes its own CSS parser that cannot handle newer
 * colour spaces (oklch/oklab/lch/lab/color()), causing "Attempting to parse an
 * unsupported color function" errors. Modern Chrome (111+) returns oklch/oklab
 * from `getComputedStyle()` rather than converting to rgb, so re-setting
 * computed values is not sufficient. Instead we convert every unsupported
 * colour value to sRGB via the Canvas 2D API (`ctx.fillStyle` always serialises
 * to `#rrggbb`/`rgba()`), then inline the result.
 *
 * The driver applies three passes over the cloned document:
 *   1. patch `<style>` elements (Tailwind v4 declares `--color-*` as oklch()),
 *   2. resolve `:root` / `<body>` inline custom properties,
 *   3. walk every element and convert computed colour values to sRGB.
 * It also converts `blob:` URLs to `data:` URLs so html2canvas can load them.
 */

/* ------------------------------------------------------------------ */
/*  Blob URL -> data URL conversion                                   */
/* ------------------------------------------------------------------ */

/**
 * Extract a `blob:` URL from an arbitrary CSS value (e.g. the contents of a
 * `background-image: url("blob:...")` declaration).
 *
 * Implemented as a plain `indexOf` scan plus a single anchored regex match
 * rather than a single backtracking search across the whole string. A naive
 * `/url\(["']?(blob:[^"')]+)["']?\)/` pattern is retried by the regex engine
 * at every character offset; on a crafted string containing many repeated
 * `url(blob:` substrings with no closing quote/paren, each retry rescans to
 * the end of the string, giving quadratic (polynomial-ReDoS) behaviour. This
 * version locates `blob:` once (linear) and then matches only from that
 * fixed offset (`^` anchor, single attempt), so it stays linear regardless
 * of how many `blob:` occurrences the input contains.
 */
function extractBlobUrl(cssValue: string): string | null {
	const startIndex = cssValue.indexOf('blob:');
	if (startIndex === -1) {
		return null;
	}
	const match = /^[^"')]+/.exec(cssValue.slice(startIndex));
	return match ? match[0] : null;
}

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
 * which reports `protocol = "blob:"` instead of the nested origin. This
 * makes blob URLs appear cross-origin, so `useCORS: true` causes
 * `crossOrigin = "anonymous"` to be set on the Image loader. Blob URLs
 * don't serve CORS headers, so the image load fails silently.
 *
 * Additionally, for `<img>` elements html2canvas reads
 * `img.currentSrc || img.src`. The cloned img may have already loaded
 * the blob URL before onclone fires, so `currentSrc` still returns the
 * old blob URL even after we update `src`. To defeat this, we replace the
 * element entirely so the new element has an empty `currentSrc`.
 */
export async function convertBlobUrlsToDataUrls(root: HTMLElement): Promise<void> {
	const promises: Promise<void>[] = [];

	const images = root.querySelectorAll<HTMLImageElement>('img[src^="blob:"]');
	for (const img of images) {
		const blobUrl = img.src;
		promises.push(
			blobUrlToDataUrl(blobUrl).then((dataUrl) => {
				if (!dataUrl) {
					return undefined;
				}
				const replacement = img.ownerDocument.createElement('img');
				for (const attr of Array.from(img.attributes)) {
					if (attr.name !== 'src') {
						replacement.setAttribute(attr.name, attr.value);
					}
				}
				replacement.src = dataUrl;
				replacement.style.cssText = img.style.cssText;
				img.parentNode?.replaceChild(replacement, img);
				return undefined;
			}),
		);
	}

	const allElements = root.querySelectorAll('*');
	for (const el of allElements) {
		const htmlEl = el as HTMLElement;
		const bg = htmlEl.style.backgroundImage;
		if (bg && bg.includes('blob:')) {
			const blobUrl = extractBlobUrl(bg);
			if (blobUrl) {
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

	const rootBg = root.style.backgroundImage;
	if (rootBg && rootBg.includes('blob:')) {
		const blobUrl = extractBlobUrl(rootBg);
		if (blobUrl) {
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
const UNSUPPORTED_COLOR_RE = /oklch|oklab|lch\(|lab\(|color\(/iu;

/**
 * Matches full colour-function calls for regex replacement inside
 * complex CSS values (gradients, shadows, stylesheet text).
 * Handles one level of nested parentheses (e.g. `calc()` inside
 * colour functions).
 */
const UNSUPPORTED_COLOR_FN_RE = /(?:oklch|oklab|lch|lab|color)\([^)]*(?:\([^)]*\)[^)]*)*\)/giu;

/* ------------------------------------------------------------------ */
/*  Canvas 2D colour conversion                                      */
/* ------------------------------------------------------------------ */

/**
 * Lazily-created scratch Canvas 2D context. The Canvas API always
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
	return result === SENTINEL ? value : result;
}

/**
 * Replace every unsupported colour-function call inside an arbitrary
 * CSS value string (gradients, box-shadow, stylesheet text, etc.).
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
 * more complex syntax (gradients, shadows, images). We use regex
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

		for (const prop of COLOR_PROPERTIES) {
			const value = computed.getPropertyValue(prop);
			if (value && UNSUPPORTED_COLOR_RE.test(value)) {
				htmlEl.style.setProperty(prop, resolveColorToSrgb(value));
			}
		}

		for (const prop of COMPLEX_COLOR_PROPERTIES) {
			const value = computed.getPropertyValue(prop);
			if (value && UNSUPPORTED_COLOR_RE.test(value)) {
				htmlEl.style.setProperty(prop, replaceUnsupportedColors(value));
			}
		}

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
/*  Combined onclone driver                                           */
/* ------------------------------------------------------------------ */

/**
 * Apply the full colour-normalisation pipeline to a cloned document, ready for
 * html2canvas to capture. Designed to run inside the `onclone` callback.
 *
 * 1. Convert blob: URLs to data: URLs (so html2canvas can load them).
 * 2. Patch `<style>` elements + resolve `:root`/`<body>` custom properties.
 * 3. Walk every element and convert computed colour values to sRGB.
 */
export async function normalizeColorsForCapture(
	doc: Document,
	clonedEl: HTMLElement,
): Promise<void> {
	await convertBlobUrlsToDataUrls(clonedEl);
	patchStylesheets(doc);
	resolveRootCustomProperties(doc);
	resolveUnsupportedColours(clonedEl);
}

/* ------------------------------------------------------------------ */
/*  Test-only exports                                                 */
/* ------------------------------------------------------------------ */

/**
 * @internal Exported for unit testing only; not part of the public API.
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
	extractBlobUrl,
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
