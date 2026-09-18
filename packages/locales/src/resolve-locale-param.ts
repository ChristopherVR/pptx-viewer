/**
 * The viewer locale ids every binding's demo app can register a dictionary
 * for. `en` needs no dictionary from this package (it is built into
 * `pptx-viewer-shared`); the rest match this package's exports (`./fr`,
 * `./es`, `./de`, `./zh-CN`).
 */
export const VIEWER_LOCALE_CODES = ['en', 'fr', 'es', 'de', 'zh-CN'] as const;

export type ViewerLocaleCode = (typeof VIEWER_LOCALE_CODES)[number];

/** Case-insensitive aliases accepted in addition to the canonical codes. */
const LOCALE_ALIASES: Record<string, ViewerLocaleCode> = {
	zh: 'zh-CN',
};

/**
 * Resolves a `?locale=` query parameter to a {@link ViewerLocaleCode}, so all
 * five demo apps (react/vue/angular/svelte/vanilla) parse the docs site's
 * embed URL the same way instead of each hand-rolling the lookup.
 *
 * Used by the docs landing page's live demo embed
 * (`docs/.vitepress/theme/landing/useLiveDemo.ts`) to keep the embedded
 * viewer's language in sync with the active documentation locale.
 *
 * @param search - The page's query string, e.g. `window.location.search`
 *   (with or without the leading `?`).
 * @param fallback - Returned when `locale` is missing or unrecognised.
 *   Defaults to `'en'`; pass the demo's previously stored preference to let
 *   an explicit `?locale=` override it while an absent one keeps it.
 */
export function resolveLocaleParam(
	search: string,
	fallback: ViewerLocaleCode = 'en',
): ViewerLocaleCode {
	const params = new URLSearchParams(search);
	const raw = params.get('locale');
	if (!raw) {
		return fallback;
	}
	const normalized = raw.trim().toLowerCase();
	const exact = VIEWER_LOCALE_CODES.find((code) => code.toLowerCase() === normalized);
	if (exact) {
		return exact;
	}
	return LOCALE_ALIASES[normalized] ?? fallback;
}
