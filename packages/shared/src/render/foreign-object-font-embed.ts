/**
 * Font embedding for the SVG `foreignObject` raster export path.
 *
 * Every binding already injects the deck's embedded fonts as `@font-face`
 * rules with `data:font/...;base64,...` sources (`render/embedded-fonts.ts`'s
 * `buildEmbeddedFontStyles`, mounted into a managed `<style>` element by each
 * binding's font-injection hook/composable) so the live on-screen render uses
 * the deck's real typefaces. Rather than re-deriving font sources from
 * `document.fonts` (which exposes no way to read back a `FontFace`'s
 * original source bytes/URL once constructed), this module reuses exactly
 * that CSS: it is already present in the live document, already
 * self-contained (`data:`/`blob:` URLs, no further fetch needed), and is by
 * construction the same font mapping the on-screen slide used, so the raster
 * output can only match what is visible.
 *
 * Any `<style>` element containing an `@font-face` rule is picked up,
 * independent of which id a given binding happens to use for its managed
 * style tag (a per-binding constant not currently shared; this module stays
 * correct even if those ids diverge).
 *
 * A deck that references a family neither embedded nor installed locally
 * falls back to a Google Fonts webfont (`google-webfonts.ts`'s
 * `resolveGoogleWebfontHref`), injected by every binding as a real
 * cross-origin `<link rel="stylesheet" href="https://fonts.googleapis.com/...">`.
 * That `<link>` is loaded without CORS mode (a plain stylesheet fetch, not
 * `fetch()`), so per the HTML/CSS Fonts spec, drawing text with a font it
 * supplies taints any canvas the text is rasterised onto - which is exactly
 * what a `foreignObject` export does when the captured region includes any
 * text in that family. This showed up as "Canvas tainted by an un-embedded
 * cross-origin resource" on essentially every real deck, since most decks
 * reference at least one non-embedded family. {@link collectExternalFontFaceCss}
 * closes that gap the same way `foreign-object-image-embed.ts` closes it for
 * images: fetch the stylesheet text and every font file it references (both
 * `fonts.googleapis.com` and `fonts.gstatic.com` send permissive CORS
 * headers) and inline them as `data:` URIs, so the exported SVG document
 * never references anything cross-origin at all.
 */

/** The subset of `Document` this module needs, so tests can pass a fake. */
export interface FontStyleDocumentLike {
	querySelectorAll(selector: 'style'): ArrayLike<{ textContent: string | null }>;
}

/**
 * Concatenate the CSS text of every `<style>` element in `doc` that declares
 * at least one `@font-face` rule.
 *
 * @returns The combined `@font-face` CSS text, empty when the deck embeds no
 *   fonts and injects no font `<style>` element.
 */
export function collectFontFaceCss(doc: FontStyleDocumentLike): string {
	const blocks: string[] = [];
	const styles = doc.querySelectorAll('style');
	for (let i = 0; i < styles.length; i++) {
		const text = styles[i].textContent ?? '';
		if (text.includes('@font-face')) {
			blocks.push(text);
		}
	}
	return blocks.join('\n\n');
}

/** The subset of `Document` {@link collectExternalFontFaceCss} needs. */
export interface LinkStyleDocumentLike {
	querySelectorAll(
		selector: 'link[rel="stylesheet"]',
	): ArrayLike<{ getAttribute(name: string): string | null }>;
}

async function fetchTextIfCrossOriginSafe(url: string): Promise<string | null> {
	try {
		const response = await fetch(url, { mode: 'cors' });
		if (!response.ok) {
			return null;
		}
		return await response.text();
	} catch {
		return null;
	}
}

/**
 * Every distinct `url(...)` reference inside a `@font-face` CSS block's `src`
 * list, as a double-quoted, single-quoted, or bare token. The three forms are
 * separate alternatives (rather than one `["']?...["']?` wrapped around a
 * single content group) so the surrounding `\s*` never shares characters with
 * the content group: a naive `\s*["']?([^"')]+)["']?\s*` lets whitespace be
 * split between the leading `\s*` and the content group in exponentially many
 * equivalent ways, which is polynomial-time (`js/polynomial-redos`) on an
 * unclosed `url(` followed by many tabs/spaces (this stylesheet text can come
 * from a fetched cross-origin `@font-face` CSS file, see
 * `fetchTextIfCrossOriginSafe`). Each alternative here has a fixed,
 * non-overlapping character class, so there is only one way to match.
 */
const FONT_FACE_URL_PATTERN = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^"')\s]+))\s*\)/gu;

/** {@link inlineFontFaceUrls}'s result: the (partially) inlined CSS, plus whether every `url(...)` inlined cleanly. */
interface InlinedFontFaceCss {
	css: string;
	allEmbedded: boolean;
}

/**
 * Replace every `url(https://...)` reference in `css` with a `data:` URI of
 * the fetched resource, dropping (leaving as-is) any reference that fails to
 * fetch rather than throwing: a partially-inlined stylesheet is still
 * reported back to the caller (`allEmbedded: false`), the same "don't ship an
 * export with a hole in it silently" contract `foreign-object-image-embed.ts`
 * uses for images.
 */
async function inlineFontFaceUrls(
	css: string,
	fetchDataUrl: (url: string) => Promise<string | null>,
): Promise<InlinedFontFaceCss> {
	const urls = new Set<string>();
	for (const match of css.matchAll(FONT_FACE_URL_PATTERN)) {
		const raw = match[1] ?? match[2] ?? match[3];
		if (raw && (raw.startsWith('http:') || raw.startsWith('https:'))) {
			urls.add(raw);
		}
	}
	if (urls.size === 0) {
		return { css, allEmbedded: true };
	}
	const resolved = await Promise.all(
		Array.from(urls, async (url) => [url, await fetchDataUrl(url)] as const),
	);
	let inlined = css;
	let allEmbedded = true;
	for (const [url, dataUrl] of resolved) {
		if (dataUrl) {
			inlined = inlined.split(url).join(dataUrl);
		} else {
			allEmbedded = false;
		}
	}
	return { css: inlined, allEmbedded };
}

/** {@link collectExternalFontFaceCss}'s result. */
export interface ExternalFontFaceCssResult {
	/** The combined, self-contained `@font-face` CSS text (empty when nothing needed embedding). */
	css: string;
	/** `false` when at least one external stylesheet or font file could not be fetched. */
	allEmbedded: boolean;
}

/**
 * Fetch and inline every external font `<link rel="stylesheet">` in `doc`
 * (the Google Fonts webfont fallback `resolveGoogleWebfontHref` injects, or a
 * self-hosted CSS2-API mirror) as self-contained `@font-face` CSS, so the
 * `foreignObject` export never references a cross-origin font resource that
 * would otherwise taint the raster.
 *
 * @param fetchDataUrl - Injectable for tests / reuse; pass
 *   `foreign-object-image-embed.ts`'s `fetchAsDataUrl` in production (plain
 *   `fetch(url, {mode:'cors'})` + base64 read-back).
 */
export async function collectExternalFontFaceCss(
	doc: LinkStyleDocumentLike,
	fetchDataUrl: (url: string) => Promise<string | null>,
): Promise<ExternalFontFaceCssResult> {
	const links = doc.querySelectorAll('link[rel="stylesheet"]');
	const blocks: string[] = [];
	let allEmbedded = true;
	for (let i = 0; i < links.length; i++) {
		const href = links[i].getAttribute('href');
		if (!href || !(href.startsWith('http:') || href.startsWith('https:'))) {
			continue;
		}
		const css = await fetchTextIfCrossOriginSafe(href);
		if (!css) {
			allEmbedded = false;
			continue;
		}
		const inlined = await inlineFontFaceUrls(css, fetchDataUrl);
		blocks.push(inlined.css);
		if (!inlined.allEmbedded) {
			allEmbedded = false;
		}
	}
	return { css: blocks.join('\n\n'), allEmbedded };
}
