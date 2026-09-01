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
 * There is no hard-coded family list: the API itself is the source of truth.
 * Each candidate family is probed with a `fetch` (the endpoint answers 400
 * for families it does not serve, and silently serves only the weights and
 * styles that DO exist for families it does, so one universal axis spec is
 * safe for every family). Verified families are combined into a single css2
 * URL. Probe results are cached for the page session, and a family that
 * fails both probe attempts is never re-requested.
 *
 * Families detected as locally installed are dropped BEFORE any network
 * request is made, so the API only ever learns the names of families the
 * reader's machine is actually missing. That residual disclosure is the
 * accepted cost of the dynamic probe (a family can only be matched against
 * the catalogue by naming it); a build-time-generated family list would avoid
 * it entirely at the price of losing every family the list does not know.
 *
 * Everything except the probe is pure; the DOM side effect (injecting /
 * updating / removing the managed `<link>` element) stays in each binding,
 * and the element id is binding-specific.
 */

import type { PptxElement, PptxEmbeddedFont, PptxSlide } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

/** Base URL of the Google Fonts CSS2 API. */
export const GOOGLE_FONTS_CSS2_BASE = 'https://fonts.googleapis.com/css2';

/**
 * Axis spec requested for every probed family. The API is lenient: it serves
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
 * Pick the referenced families this runtime should probe for: everything not
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

/** Text measured for the local-availability probe (mixed glyph widths). */
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
 * every fallback class) are safe: the caller then probes the API for a
 * family it may not have needed to, which is exactly the pre-check
 * behaviour.
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

/** Minimal shape of `fetch` the probe needs (lets tests stub it). */
export type FetchLike = (url: string) => Promise<{ status: number }>;

/** Session cache: family -> probe promise resolving to its fragment or null. */
const probeCache = new Map<string, Promise<string | null>>();

/** Reset the session probe cache (test isolation). */
export function resetGoogleWebfontProbeCache(): void {
	probeCache.clear();
}

function fetchLike(): FetchLike | undefined {
	return typeof fetch === 'function' ? fetch : undefined;
}

/**
 * Request `family` from the css2 API and return the query fragment that
 * worked: the full axis spec, a bare fallback (in case a future API change
 * makes the axis spec strict for some family), or `null` when the family is
 * not served at all. Network failures count as "not served": an offline
 * browser could not load the stylesheet either.
 */
async function probeFamily(family: string, doFetch: FetchLike): Promise<string | null> {
	const withAxis = buildGoogleFontsFragment(family);
	if (await probeUrl(doFetch, `family=${encodeURIComponent(withAxis)}`)) {
		return withAxis;
	}
	if (await probeUrl(doFetch, `family=${encodeURIComponent(family)}`)) {
		return family;
	}
	return null;
}

async function probeUrl(doFetch: FetchLike, familyParam: string): Promise<boolean> {
	try {
		const response = await doFetch(`${GOOGLE_FONTS_CSS2_BASE}?${familyParam}&${DISPLAY_PARAM}`);
		return response.status === 200;
	} catch {
		return false;
	}
}

/**
 * Probe the candidate families (in parallel, session-cached) and return the
 * query fragments the Google Fonts API serves.
 */
export function probeGoogleWebfontFragments(
	families: readonly string[],
	doFetch: FetchLike = fetchLike() as FetchLike,
): Promise<string[]> {
	const effective = typeof doFetch === 'function' ? doFetch : undefined;
	if (!effective) {
		return Promise.resolve([]);
	}
	const probes = families.map(async (family) => {
		let probe = probeCache.get(family);
		if (!probe) {
			probe = probeFamily(family, effective);
			probeCache.set(family, probe);
		}
		return probe;
	});
	return Promise.all(probes).then((fragments) => fragments.filter((f) => f !== null));
}

/**
 * One-stop helper the bindings call from their reactive wiring: resolve the
 * href for a loaded deck's slides + embedded fonts (`null` when no fetch is
 * needed). Families available locally are used as-is and never requested;
 * the rest are probed (session-cached), so repeated calls (every load /
 * edit) only fetch families never seen before.
 */
export async function resolveGoogleWebfontHref(
	slides: readonly PptxSlide[],
	embeddedFonts: readonly PptxEmbeddedFont[],
	doFetch?: FetchLike,
	isLocallyInstalled: (family: string) => boolean = isFontFamilyInstalledLocally,
): Promise<string | null> {
	const referenced = collectReferencedFontFamilies(slides);
	const candidates = selectGoogleWebfontFamilies(
		referenced,
		embeddedFonts.map((font) => font.name),
		isLocallyInstalled,
	);
	const fragments = await probeGoogleWebfontFragments(candidates, doFetch);
	return buildGoogleFontsHref(fragments);
}
