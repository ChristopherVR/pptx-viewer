/**
 * google-webfonts.ts: Google Fonts webfont fallback for referenced font
 * families, shared by every binding.
 *
 * A deck may reference a font family that is neither installed on the
 * reader's machine nor embedded in the .pptx itself. PowerPoint still renders
 * such decks correctly because Microsoft 365 silently downloads its "cloud
 * fonts" on demand; a browser has no equivalent mechanism. For referenced
 * families that the Google Fonts CSS2 API serves, each binding injects a
 * `<link rel="stylesheet">` so the text renders with the intended face
 * anyway.
 *
 * Which families the API serves is answered by the bundled catalogue
 * (`google-fonts-catalogue.ts`, regenerated from Google's own metadata feed
 * by `bun run fonts:catalogue`), never by probing the API per family: a
 * probe of an unknown family answers 400 without CORS headers, which the
 * browser reports as an uncatchable console error, and it discloses every
 * missing family name to Google. With the catalogue the only request ever
 * made is the stylesheet for families already known to be served. The API is
 * lenient about weights and styles (it serves only the ones a family has),
 * so one universal axis spec is safe for every catalogue family.
 *
 * Families detected as locally installed are dropped before the href is
 * built, so an installed face is used as-is. Everything here is pure; the DOM
 * side effect (injecting / updating / removing the managed `<link>` element)
 * stays in each binding, and the element id is binding-specific.
 */

import type { PptxElement, PptxEmbeddedFont, PptxSlide } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { GOOGLE_FONTS_FAMILIES } from './google-fonts-catalogue';

/** Base URL of the Google Fonts CSS2 API. */
export const GOOGLE_FONTS_CSS2_BASE = 'https://fonts.googleapis.com/css2';

/**
 * Axis spec requested for every catalogue family. The API is lenient: it serves
 * only the weights/styles the family actually has (verified for single-style
 * families), so this one fragment is safe to request universally and yields
 * real bold + italic faces where they exist.
 */
export const GOOGLE_WEBFONT_AXIS = 'ital,wght@0,400;0,700;1,400;1,700';

/** `display=swap` so text paints with the fallback and swaps when ready. */
const DISPLAY_PARAM = 'display=swap';

/**
 * Collect all unique font family names referenced across slide elements'
 * text segments, recursing into group children.
 */
export function collectReferencedFontFamilies(slides: readonly PptxSlide[]): Set<string> {
	const families = new Set<string>();
	const visit = (elements: readonly PptxElement[]): void => {
		for (const el of elements) {
			if (el.type === 'group') {
				visit(el.children);
			}
			if (hasTextProperties(el) && el.textSegments) {
				for (const seg of el.textSegments) {
					if (seg.style.fontFamily) {
						families.add(seg.style.fontFamily);
					}
				}
			}
		}
	};
	for (const slide of slides) {
		visit(slide.elements);
	}
	return families;
}

/**
 * Pick the referenced families this runtime should look up: everything not
 * already satisfied by an embedded font, and (when the caller supplies the
 * check) everything not available locally, so an installed family is used
 * as-is and its name never reaches the API.
 */
export function selectGoogleWebfontFamilies(
	referenced: Iterable<string>,
	embedded?: Iterable<string>,
	isLocallyInstalled?: (family: string) => boolean,
): string[] {
	const embeddedSet = new Set(embedded ?? []);
	const selected: string[] = [];
	for (const family of referenced) {
		if (embeddedSet.has(family)) {
			continue;
		}
		if (isLocallyInstalled?.(family)) {
			continue;
		}
		selected.push(family);
	}
	return selected;
}

/** Text measured for the local-availability check (mixed glyph widths). */
const INSTALLED_FONT_TEST_STRING = 'mmmmmmmmmmllww';

/**
 * Best-effort "is this family available without any network fetch?" check.
 *
 * `document.fonts.check` cannot be used here: Chromium answers `true` for any
 * quoted family name that matches no face at all (its "all matched faces are
 * loaded" condition holds vacuously), so it reports every missing font as
 * installed. Instead a test string is measured on a canvas with
 * `<family>, <fallback>` and with `<fallback>` alone: a family the OS
 * provides renders with different metrics for at least one common fallback
 * class, while a missing family renders exactly like the fallback and is
 * reported as absent. False negatives (a family metrically identical to
 * every fallback class) are safe: the caller then loads a catalogue face it
 * may not have needed to, which is exactly the pre-check behaviour.
 */
export function isFontFamilyInstalledLocally(family: string): boolean {
	if (typeof document === 'undefined') {
		return false;
	}
	try {
		const context = document.createElement('canvas').getContext('2d');
		if (!context) {
			return false;
		}
		// Quote the family so multi-word names parse as one identifier, and
		// escape quotes/backslashes inside it.
		const quoted = `"${family.replace(/[\\"]/gu, '\\$&')}"`;
		for (const fallback of ['monospace', 'serif', 'sans-serif']) {
			context.font = `72px ${fallback}`;
			const base = context.measureText(INSTALLED_FONT_TEST_STRING).width;
			context.font = `72px ${quoted}, ${fallback}`;
			if (context.measureText(INSTALLED_FONT_TEST_STRING).width !== base) {
				return true;
			}
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * The css2 query fragment for one family, with the universal axis spec.
 * Word separators MUST be literal spaces, never `+`: the fragment is passed
 * through `encodeURIComponent`, which would turn an intended `+` separator
 * into `%2B`, and after URL decoding Google then sees a literal plus inside
 * the family name and rejects it with 400 ("familyName can only contain
 * alphanumeric/space characters"). A space encodes to `%20`, which is what
 * the API expects.
 */
export function buildGoogleFontsFragment(family: string): string {
	return `${family}:${GOOGLE_WEBFONT_AXIS}`;
}

/**
 * Build the Google Fonts CSS2 `<link>` href for the supplied (already
 * verified) fragments, or `null` when there is nothing to load.
 */
export function buildGoogleFontsHref(fragments: readonly string[]): string | null {
	if (fragments.length === 0) {
		return null;
	}
	const query = fragments.map((fragment) => `family=${encodeURIComponent(fragment)}`).join('&');
	return `${GOOGLE_FONTS_CSS2_BASE}?${query}&${DISPLAY_PARAM}`;
}

/** Lower-cased catalogue name -> canonical Google Fonts spelling (lazy). */
let catalogueIndex: Map<string, string> | undefined;

/**
 * Canonical Google Fonts spelling for `family`, or `null` when the CSS2 API
 * does not serve it. Matching is case-insensitive and whitespace-normalised
 * because PowerPoint stores the name as the author typed it.
 */
export function findGoogleFontsFamily(family: string): string | null {
	if (!catalogueIndex) {
		catalogueIndex = new Map(GOOGLE_FONTS_FAMILIES.map((name) => [normaliseFamily(name), name]));
	}
	return catalogueIndex.get(normaliseFamily(family)) ?? null;
}

function normaliseFamily(family: string): string {
	return family.trim().replace(/\s+/gu, ' ').toLowerCase();
}

/**
 * Families this session has already resolved against the catalogue (by
 * their referenced spelling). Once the injected stylesheet has loaded, the
 * webfont itself satisfies the canvas measurement, so re-running the local
 * check would report the family as installed, drop it from the href, remove
 * the very `<link>` that made it available, and find it missing again on the
 * next call: an oscillation that re-fetches the stylesheet on every edit.
 */
const resolvedFamilies = new Set<string>();

/** Reset the session cache (test isolation). */
export function resetGoogleWebfontSessionCache(): void {
	resolvedFamilies.clear();
}

/**
 * The query fragments for the candidate families the catalogue knows,
 * requested under their canonical spelling. Unknown families are dropped
 * without any network request.
 */
export function matchGoogleWebfontFragments(families: readonly string[]): string[] {
	const fragments: string[] = [];
	for (const family of families) {
		const canonical = findGoogleFontsFamily(family);
		if (canonical !== null) {
			resolvedFamilies.add(family);
			fragments.push(buildGoogleFontsFragment(canonical));
		}
	}
	return fragments;
}

/**
 * One-stop helper the bindings call from their reactive wiring: resolve the
 * href for a loaded deck's slides + embedded fonts (`null` when no stylesheet
 * is needed). Families available locally are used as-is; the rest are matched
 * against the bundled catalogue. The local-install check is skipped for
 * families the session already resolved (see `resolvedFamilies`).
 *
 * Async only so the bindings' `.then` wiring is the same whether resolution
 * is a lookup or, one day, something slower.
 */
export async function resolveGoogleWebfontHref(
	slides: readonly PptxSlide[],
	embeddedFonts: readonly PptxEmbeddedFont[],
	isLocallyInstalled: (family: string) => boolean = isFontFamilyInstalledLocally,
): Promise<string | null> {
	const referenced = collectReferencedFontFamilies(slides);
	const candidates = selectGoogleWebfontFamilies(
		referenced,
		embeddedFonts.map((font) => font.name),
		(family) => !resolvedFamilies.has(family) && isLocallyInstalled(family),
	);
	return buildGoogleFontsHref(matchGoogleWebfontFragments(candidates));
}
