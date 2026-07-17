/** One selectable entry in the viewer chrome's built-in language picker (File > Options > Language). */
export interface LocaleCatalogEntry {
	/** BCP-47-ish locale code, e.g. `'en'`, `'fr'`. Matches `pptx-viewer-locales`' exports. */
	code: string;
	/** English display name, used before a translation dictionary for the target locale is loaded. */
	label: string;
	/** The locale's own name for itself, e.g. `'Français'` for `fr`. */
	nativeLabel: string;
}

/**
 * Built-in language choices offered by File > Options > Language when a host
 * doesn't supply its own `availableLocales`. Mirrors the locales shipped by
 * the optional `pptx-viewer-locales` package (English needs no dictionary,
 * it's the viewer's own baseline).
 */
export const LOCALE_CATALOG: readonly LocaleCatalogEntry[] = [
	{ code: 'en', label: 'English', nativeLabel: 'English' },
	{ code: 'fr', label: 'French', nativeLabel: 'Français' },
	{ code: 'es', label: 'Spanish', nativeLabel: 'Español' },
	{ code: 'de', label: 'German', nativeLabel: 'Deutsch' },
];
