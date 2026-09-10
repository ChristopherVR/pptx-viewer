/**
 * Fetches the actual font-file bytes for a Google Fonts catalogue webfont, so
 * `text-warp-outline-font-cache.ts` can parse a real outline for it.
 *
 * `google-webfonts.ts` already resolves which catalogue family to load and
 * injects a `<link rel=stylesheet>` for on-screen text, but a CSS stylesheet
 * carries no glyph geometry: only a `src: url(...)` pointing at the actual
 * `.woff2` file does. This module re-parses that same stylesheet text (a
 * second, cheap `fetch` of a small text response; browsers already cache the
 * first one from the `<link>`) to find the `@font-face` block matching the
 * requested family/weight/style, then fetches ITS `url()` for the binary.
 *
 * Best-effort throughout: Google's CSS2 API can return several `@font-face`
 * blocks per family (subset by `unicode-range`, e.g. separate blocks for
 * `latin`, `latin-ext`, `cyrillic`, ...); this picks the block whose
 * `unicode-range` covers Basic Latin (`U+00..`, present in every WordArt
 * caption in practice) or, failing that, the first matching block. Any
 * failure (network, parse, no match) resolves to `undefined`; the caller
 * simply keeps the existing affine-transform fallback for that glyph.
 */
import { findGoogleFontsFamily } from './google-fonts-lookup';
import { findMetricCompatibleGoogleFontsFamily } from './google-webfonts-metric-clones';

interface ParsedFontFaceBlock {
	family: string;
	weight: number;
	italic: boolean;
	url: string;
	unicodeRange?: string;
}

function unquote(value: string): string {
	return value.trim().replace(/^['"]|['"]$/gu, '');
}

/** Parse every `@font-face { ... }` block out of a CSS2 stylesheet response. */
function parseFontFaceBlocks(css: string): ParsedFontFaceBlock[] {
	const blocks: ParsedFontFaceBlock[] = [];
	const blockRe = /@font-face\s*\{([^}]*)\}/gu;
	let match: RegExpExecArray | null;
	while ((match = blockRe.exec(css)) !== null) {
		const body = match[1];
		const familyMatch = /font-family:\s*([^;]+);/u.exec(body);
		const weightMatch = /font-weight:\s*([0-9]+)/u.exec(body);
		const styleMatch = /font-style:\s*(\w+)/u.exec(body);
		const urlMatch = /src:\s*url\(([^)]+)\)/u.exec(body);
		const rangeMatch = /unicode-range:\s*([^;]+);/u.exec(body);
		if (!familyMatch || !weightMatch || !urlMatch) {
			continue;
		}
		blocks.push({
			family: unquote(familyMatch[1]),
			weight: Number(weightMatch[1]),
			italic: styleMatch?.[1] === 'italic',
			url: unquote(urlMatch[1]),
			unicodeRange: rangeMatch?.[1]?.trim(),
		});
	}
	return blocks;
}

/** Basic Latin (U+0000-00FF) is the range covering ordinary caption text. */
function coversBasicLatin(unicodeRange: string | undefined): boolean {
	return !unicodeRange || /U\+00/iu.test(unicodeRange);
}

function pickBlock(
	blocks: readonly ParsedFontFaceBlock[],
	family: string,
	bold: boolean,
	italic: boolean,
): ParsedFontFaceBlock | undefined {
	const targetWeight = bold ? 700 : 400;
	const byFamily = blocks.filter((b) => b.family.toLowerCase() === family.toLowerCase());
	const pool = byFamily.length > 0 ? byFamily : blocks;
	const byStyle = pool.filter((b) => b.weight === targetWeight && b.italic === italic);
	const candidates = byStyle.length > 0 ? byStyle : pool.filter((b) => b.italic === italic);
	if (candidates.length === 0) {
		return pool[0];
	}
	return candidates.find((b) => coversBasicLatin(b.unicodeRange)) ?? candidates[0];
}

/** `fetch`-shaped dependency, injected so this stays testable without a real network. */
export type FetchLike = (
	url: string,
) => Promise<{ ok: boolean; text: () => Promise<string>; arrayBuffer: () => Promise<ArrayBuffer> }>;

/**
 * Fetch the outline-ready bytes for `referencedFamily` (the family as
 * referenced in the deck, e.g. "Calibri") at `cssHref` (the same href
 * `resolveGoogleWebfontHref` built), resolving through the same
 * canonical/metric-clone lookup `matchGoogleWebfontFragments` used to decide
 * what the stylesheet actually serves.
 *
 * Returns `undefined` on any failure; never throws.
 */
export async function fetchGoogleWebfontOutlineBytes(
	cssHref: string,
	referencedFamily: string,
	bold: boolean,
	italic: boolean,
	fetchImpl: FetchLike,
): Promise<Uint8Array | undefined> {
	const canonical =
		findGoogleFontsFamily(referencedFamily) ??
		findMetricCompatibleGoogleFontsFamily(referencedFamily);
	if (!canonical) {
		return undefined;
	}
	try {
		const cssResponse = await fetchImpl(cssHref);
		if (!cssResponse.ok) {
			return undefined;
		}
		const css = await cssResponse.text();
		const block = pickBlock(parseFontFaceBlocks(css), canonical, bold, italic);
		if (!block) {
			return undefined;
		}
		const fontResponse = await fetchImpl(block.url);
		if (!fontResponse.ok) {
			return undefined;
		}
		return new Uint8Array(await fontResponse.arrayBuffer());
	} catch {
		return undefined;
	}
}
