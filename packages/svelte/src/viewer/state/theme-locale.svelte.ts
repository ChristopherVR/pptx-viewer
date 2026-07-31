import {
	readStoredViewerPrefs,
	resolveThemeCatalogEntry,
	THEME_CATALOG,
	writeStoredViewerPrefs,
} from 'pptx-viewer-shared';
import type { ThemeCatalogEntry, ViewerTheme } from 'pptx-viewer-shared';
import { untrack } from 'svelte';

/** Host props the chrome's theme/locale selection reads (all read reactively). */
export interface ThemeLocaleStateDeps {
	/** Initial File > Options > Appearance key (host `defaultThemeKey` prop). */
	getDefaultThemeKey(): string | undefined;
	/** Host-supplied theme catalog, or the shared `THEME_CATALOG`. */
	getAvailableThemes(): readonly ThemeCatalogEntry[] | undefined;
	/** Host `theme` prop: still wins whenever the resolved key is `'default'`. */
	getThemeProp(): ViewerTheme | undefined;
	/**
	 * Host `onThemeChange`; when present the host owns persistence. Read through
	 * a getter, not captured, so a host that supplies (or drops) the callback on
	 * a later render is honoured.
	 */
	getOnThemeChange(): ((themeKey: string) => void) | undefined;
	/** Initial language (host `defaultLocale` prop). */
	getDefaultLocale(): string | undefined;
	/** Host `locale` prop, used until the user picks a language via Options. */
	getLocaleProp(): string;
	/** Host `onLocaleChange`; when present the host owns persistence. */
	getOnLocaleChange(): ((localeCode: string) => void) | undefined;
}

/**
 * Theme + locale selection for the viewer chrome (File > Options
 * Appearance/Language, plus the Design tab's swatch gallery).
 *
 * `themeKey` is the single source of truth for the chrome's theme; both entry
 * points funnel through {@link setThemeKey} so they stay in sync. Values are
 * persisted to the shared `pptx-viewer-prefs` localStorage key unless the host
 * wires `onThemeChange` / `onLocaleChange`, in which case persistence is the
 * host's responsibility.
 *
 * Extracted from `PowerPointViewer.svelte` to keep that file within the repo's
 * file-size budget. MUST be constructed during component initialization: the
 * initial reads are `untrack`ed exactly as the inline version was, so a later
 * prop change never clobbers a user selection.
 */
export class ThemeLocaleState {
	readonly #deps: ThemeLocaleStateDeps;

	themeKey = $state<string>('default');

	/**
	 * Unlike `theme`, there is no "host forces this locale no matter what" case
	 * in this binding, so once the user picks a language via Options the
	 * override always wins over the `locale` prop for the rest of the session
	 * (the opposite precedence direction from `theme`, where the host prop still
	 * wins over a `'default'` override).
	 */
	localeOverride = $state<string | undefined>(undefined);

	constructor(deps: ThemeLocaleStateDeps) {
		this.#deps = deps;
		this.themeKey =
			untrack(() => deps.getDefaultThemeKey()) ?? readStoredViewerPrefs().themeKey ?? 'default';
		this.localeOverride =
			untrack(() => deps.getDefaultLocale()) ?? readStoredViewerPrefs().localeCode;
	}

	get catalog(): readonly ThemeCatalogEntry[] {
		return this.#deps.getAvailableThemes() ?? THEME_CATALOG;
	}

	/**
	 * The theme actually applied to the chrome. The host `theme` prop still wins
	 * whenever the resolved key is `'default'` (that catalog entry maps to
	 * `undefined`), preserving the prop-over-preference precedence.
	 */
	get effectiveTheme(): ViewerTheme | undefined {
		return resolveThemeCatalogEntry(this.themeKey, this.catalog) ?? this.#deps.getThemeProp();
	}

	get effectiveLocale(): string {
		return this.localeOverride ?? this.#deps.getLocaleProp();
	}

	setThemeKey(key: string): void {
		this.themeKey = key;
		const onThemeChange = this.#deps.getOnThemeChange();
		if (onThemeChange) {
			onThemeChange(key);
		} else {
			writeStoredViewerPrefs({ themeKey: key });
		}
	}

	/**
	 * The Design tab's theme-preset gallery predates the Options catalog and
	 * passes a `ViewerTheme` value directly (its own small `THEME_SWATCHES`
	 * idiom); resolve it back to a catalog key so both entry points update the
	 * same `themeKey` and stay in sync with each other.
	 */
	setTheme(next: ViewerTheme | undefined): void {
		this.setThemeKey(this.catalog.find((entry) => entry.theme === next)?.key ?? 'default');
	}

	setLocale(code: string): void {
		this.localeOverride = code;
		const onLocaleChange = this.#deps.getOnLocaleChange();
		if (onLocaleChange) {
			onLocaleChange(code);
		} else {
			writeStoredViewerPrefs({ localeCode: code });
		}
	}
}
