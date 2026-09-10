/**
 * Image self-containment for the SVG `foreignObject` raster export path.
 *
 * A `foreignObject` document is rasterised by drawing it into an `<img>`
 * loaded from a `blob:`/`data:` URL of the serialised SVG (see
 * `export/rasterize-foreign-object.ts`). Any image reference inside that SVG
 * that the browser cannot resolve on its own (a revoked/foreign `blob:` URL,
 * or a cross-origin `http(s):` URL without CORS headers) taints the canvas
 * once drawn, or fails to load at all. Most decks never hit this: embedded
 * media is already served as `data:` URLs by the load pipeline
 * (`mediaDataUrls`), so this module's job is mostly confirming that and
 * catching the exceptions (a `blob:` object URL for a just-exported preview,
 * or a user-supplied `http(s):` background image).
 *
 * `blob:` URLs are always same-origin re-fetchable (the tab that created
 * them can always read them back), so they are converted unconditionally.
 * `http(s):` URLs are attempted via a CORS fetch; a failure (network error,
 * missing `Access-Control-Allow-Origin`) is reported back as "unembeddable"
 * rather than silently left as a live URL, so the caller
 * (`rasterize-element.ts`) can fall back to the vector-SVG or html2canvas
 * path instead of shipping a raster with a hole in it.
 */

/** Result of attempting to make a clone's images self-contained. */
export interface ImageEmbedResult {
	/** `true` when every discovered image reference was inlined as a `data:` URI. */
	allEmbedded: boolean;
	/** Count of image references that could not be converted (network/CORS failure). */
	unembeddableCount: number;
}

/**
 * Fetch `url` and read it back as a `data:` URI. `mode: 'cors'` for any
 * non-`blob:` URL: a same-origin/CORS-permitting response is required for the
 * bytes to be readable at all, and this is also reused (see
 * `foreign-object-font-embed.ts`) to inline external font-stylesheet
 * resources (Google Fonts CSS2/gstatic.com both send permissive CORS
 * headers), where the same "readable or don't ship it" rule applies.
 */
export async function fetchAsDataUrl(url: string): Promise<string | null> {
	try {
		const response = await fetch(url, { mode: url.startsWith('blob:') ? 'same-origin' : 'cors' });
		if (!response.ok) {
			return null;
		}
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

/** Extract a `url(...)` reference from a CSS value; returns `null` when none is present. */
function extractCssUrl(value: string): string | null {
	const match = /url\(\s*["']?([^"')]+)["']?\s*\)/u.exec(value);
	return match ? match[1] : null;
}

function needsEmbedding(url: string): boolean {
	return url.startsWith('blob:') || url.startsWith('http:') || url.startsWith('https:');
}

/** One discovered embeddable reference, resolved after every element has been scanned. */
type EmbedTask = () => Promise<boolean>;

async function runImgTask(img: Element, src: string): Promise<boolean> {
	const dataUrl = await fetchAsDataUrl(src);
	if (!dataUrl) {
		return false;
	}
	img.setAttribute('src', dataUrl);
	return true;
}

async function runSvgImageTask(svgImg: Element, href: string): Promise<boolean> {
	const dataUrl = await fetchAsDataUrl(href);
	if (!dataUrl) {
		return false;
	}
	svgImg.setAttribute('href', dataUrl);
	svgImg.removeAttribute('xlink:href');
	return true;
}

async function runBackgroundTask(el: HTMLElement, bg: string, url: string): Promise<boolean> {
	const dataUrl = await fetchAsDataUrl(url);
	if (!dataUrl) {
		return false;
	}
	el.style.backgroundImage = bg.replace(url, dataUrl);
	return true;
}

/**
 * Walk `root` (a detached clone; safe to mutate) and inline every `<img src>`
 * and CSS `background-image: url(...)` that is not already a `data:` URI.
 * SVG `<image>` `href`/`xlink:href` references are handled too, since the
 * OOXML picture renderer may emit either.
 */
export async function embedImagesOnClone(root: HTMLElement): Promise<ImageEmbedResult> {
	const tasks: EmbedTask[] = [];

	for (const img of root.querySelectorAll('img')) {
		const src = img.getAttribute('src') ?? '';
		if (needsEmbedding(src)) {
			tasks.push(() => runImgTask(img, src));
		}
	}

	for (const svgImg of root.querySelectorAll('image')) {
		const href = svgImg.getAttribute('href') ?? svgImg.getAttribute('xlink:href') ?? '';
		if (needsEmbedding(href)) {
			tasks.push(() => runSvgImageTask(svgImg, href));
		}
	}

	const withBackground = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
	for (const el of withBackground) {
		const bg = el.style.backgroundImage;
		if (!bg || bg === 'none') {
			continue;
		}
		const url = extractCssUrl(bg);
		if (url && needsEmbedding(url)) {
			tasks.push(() => runBackgroundTask(el, bg, url));
		}
	}

	const results = await Promise.all(tasks.map((task) => task()));
	const unembeddableCount = results.filter((embedded) => !embedded).length;
	return { allEmbedded: unembeddableCount === 0, unembeddableCount };
}
