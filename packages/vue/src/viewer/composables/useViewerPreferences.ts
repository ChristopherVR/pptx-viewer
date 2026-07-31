/**
 * useViewerPreferences: the two host-overridable UI preferences (appearance
 * theme + interface language) that File > Options exposes.
 *
 * Extracted from `PowerPointViewer.vue` so the SFC keeps only presentation.
 * Both preferences follow the same three-tier resolution, which is the reason
 * this is one composable rather than two: an explicit host prop wins, then a
 * persisted `localStorage` choice, then the built-in default. When the host
 * supplies the matching `on*Change` callback it also owns persistence, so the
 * viewer must NOT write `localStorage` behind its back.
 */
import { readStoredViewerPrefs, writeStoredViewerPrefs } from 'pptx-viewer-shared';
import type { ComputedRef, Ref } from 'vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { LocaleCatalogEntry } from '../../i18n';
import { LOCALE_CATALOG } from '../../i18n';
import type { ThemeCatalogEntry, ViewerTheme } from '../../theme';
import { resolveThemeCatalogEntry, THEME_CATALOG } from '../../theme';

/**
 * The subset of `PowerPointViewerProps` this composable reads. Declared
 * structurally (rather than importing the full props interface) so the
 * composable stays unit-testable with a plain object.
 *
 * The whole object is passed in rather than snapshotted fields: `props` is a
 * reactive proxy, and reading `props.theme` into a plain const here would pin
 * the value taken during setup instead of tracking later host updates.
 */
export interface ViewerPreferenceProps {
	theme?: ViewerTheme;
	defaultThemeKey?: string;
	availableThemes?: ThemeCatalogEntry[];
	onThemeChange?: (key: string) => void;
	defaultLocale?: string;
	availableLocales?: LocaleCatalogEntry[];
	onLocaleChange?: (code: string) => void;
}

export interface UseViewerPreferencesResult {
	/** Current appearance-catalog key (File > Options > Appearance). */
	themeKey: Ref<string>;
	/**
	 * The theme actually applied: an explicit `theme` prop, else the catalog
	 * entry. `undefined` when the catalog has no entry for the key, which the
	 * theme provider treats as "use the built-in dark defaults".
	 */
	effectiveTheme: ComputedRef<ViewerTheme | undefined>;
	/** Apply a theme-catalog selection. */
	selectTheme: (key: string) => void;
	/** Current interface language code (File > Options > Language). */
	localeCode: Ref<string>;
	/** Apply a locale-catalog selection. */
	selectLocale: (code: string) => void;
	/** Every locale the host's `vue-i18n` instance has messages for, with display labels. */
	resolvedAvailableLocales: ComputedRef<LocaleCatalogEntry[]>;
}

export function useViewerPreferences(props: ViewerPreferenceProps): UseViewerPreferencesResult {
	const { availableLocales, locale } = useI18n();

	// `themeKey` drives the File > Options > Appearance picker; an explicit
	// `theme` prop still wins over it (fully backward compatible with hosts that
	// only ever passed `theme`). The initial key falls back to a persisted
	// `localStorage` choice, then the catalog's `'default'` entry.
	const themeKey = ref(props.defaultThemeKey ?? readStoredViewerPrefs().themeKey ?? 'default');
	const effectiveTheme = computed(
		() =>
			props.theme ??
			resolveThemeCatalogEntry(themeKey.value, props.availableThemes ?? THEME_CATALOG),
	);

	function selectTheme(key: string): void {
		themeKey.value = key;
		if (props.onThemeChange) {
			props.onThemeChange(key);
		} else {
			writeStoredViewerPrefs({ themeKey: key });
		}
	}

	// The host's `vue-i18n` instance is peer-supplied (this package never bundles
	// one); a persisted non-English choice is applied to it on mount unless the
	// host owns locale switching itself via `onLocaleChange`.
	const localeCode = ref(props.defaultLocale ?? readStoredViewerPrefs().localeCode ?? 'en');
	onMounted(() => {
		if (localeCode.value !== 'en' && !props.onLocaleChange) {
			locale.value = localeCode.value;
		}
	});

	const resolvedAvailableLocales = computed<LocaleCatalogEntry[]>(
		() =>
			props.availableLocales ??
			availableLocales.map(
				(code) =>
					LOCALE_CATALOG.find((entry) => entry.code === code) ?? {
						code,
						label: code,
						nativeLabel: code,
					},
			),
	);

	function selectLocale(code: string): void {
		localeCode.value = code;
		if (props.onLocaleChange) {
			props.onLocaleChange(code);
		} else {
			locale.value = code;
			writeStoredViewerPrefs({ localeCode: code });
		}
	}

	return {
		themeKey,
		effectiveTheme,
		selectTheme,
		localeCode,
		selectLocale,
		resolvedAvailableLocales,
	};
}
