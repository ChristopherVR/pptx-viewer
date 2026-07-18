import type { ViewerProfile } from './account';
import type { StoredViewerOptions } from './options/viewer-options';

/**
 * `localStorage`-backed viewer chrome preferences (theme/locale/profile),
 * shared by every binding.
 *
 * This is the persistence layer behind File > Options' Appearance/Language
 * tabs and File > Account's profile editor when a host doesn't supply its
 * own `onThemeChange`/`onLocaleChange`/`onProfileChange` callbacks - i.e. the
 * "standalone" fallback path. Hosts that do wire those callbacks own
 * persistence themselves and this module is never touched.
 */

export const VIEWER_PREFS_STORAGE_KEY = 'pptx-viewer-prefs';

export interface StoredViewerPrefs {
	/** Key into the shared `THEME_CATALOG` (or a host-supplied `availableThemes` catalog). */
	themeKey?: string;
	/** Locale code, e.g. `'fr'`. */
	localeCode?: string;
	/** Local-only display profile shown in File > Account. */
	profile?: ViewerProfile;
	/** Sparse File > Options diff against `DEFAULT_VIEWER_OPTIONS`. */
	options?: StoredViewerOptions;
}

function hasLocalStorage(): boolean {
	return typeof localStorage !== 'undefined';
}

/** Read all persisted viewer preferences. Returns `{}` when unavailable, unset, or corrupt. */
export function readStoredViewerPrefs(): StoredViewerPrefs {
	if (!hasLocalStorage()) {
		return {};
	}
	try {
		const raw = localStorage.getItem(VIEWER_PREFS_STORAGE_KEY);
		if (!raw) {
			return {};
		}
		const parsed: unknown = JSON.parse(raw);
		return parsed && typeof parsed === 'object' ? (parsed as StoredViewerPrefs) : {};
	} catch {
		return {};
	}
}

/** Merge `patch` into the persisted viewer preferences. Silently no-ops when storage is unavailable. */
export function writeStoredViewerPrefs(patch: Partial<StoredViewerPrefs>): void {
	if (!hasLocalStorage()) {
		return;
	}
	try {
		const next = { ...readStoredViewerPrefs(), ...patch };
		localStorage.setItem(VIEWER_PREFS_STORAGE_KEY, JSON.stringify(next));
	} catch {
		// Ignore (private browsing, quota exceeded, etc.)
	}
}

/** Remove all persisted viewer preferences. Silently no-ops when storage is unavailable. */
export function clearStoredViewerPrefs(): void {
	if (!hasLocalStorage()) {
		return;
	}
	try {
		localStorage.removeItem(VIEWER_PREFS_STORAGE_KEY);
	} catch {
		// Ignore
	}
}
