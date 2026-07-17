import { keyToLabel, translationsEn } from 'pptx-viewer-shared/i18n';

/**
 * Minimal, dependency-free translation layer for the Svelte binding.
 *
 * The canonical English dictionary lives in `pptx-viewer-shared/i18n` (shared
 * with the React, Vue, and Angular bindings, which each plug it into their
 * framework's i18n library). Svelte has no blessed i18n runtime, so this
 * module implements the small subset the viewer needs: dictionary lookup by
 * locale with English fallback, `{{name}}` interpolation, and the shared
 * `keyToLabel` humanised fallback for missing keys.
 */

/** A flat dictionary of dotted `pptx.*` keys to display strings. */
export type TranslationDictionary = Record<string, string>;

/** Translate `key`, interpolating `{{name}}` placeholders from `params`. */
export type Translator = (key: string, params?: Record<string, string | number>) => string;

const registry = new Map<string, TranslationDictionary>([['en', translationsEn]]);

/**
 * Register (or extend) the dictionary for a locale. Later registrations are
 * merged over earlier ones, so hosts can override individual keys.
 */
export function registerTranslations(locale: string, dictionary: TranslationDictionary): void {
	const existing = registry.get(locale);
	registry.set(locale, existing ? { ...existing, ...dictionary } : { ...dictionary });
}

/**
 * List every locale code with a registered dictionary: `en` (built in) plus
 * anything added via {@link registerTranslations}. Used by File > Options'
 * Language tab to offer only locales the host has actually wired up.
 */
export function getRegisteredLocales(): string[] {
	return [...registry.keys()];
}

/** Interpolate `{{name}}` placeholders (the shared-dictionary convention). */
export function interpolate(
	message: string,
	params: Record<string, string | number> | undefined,
): string {
	if (!params) {
		return message;
	}
	return message.replace(/\{\{(?<name>\w+)\}\}/gu, (match, name: string) => {
		const value = params[name];
		return value === undefined ? match : String(value);
	});
}

/**
 * Translate a key for a locale: exact locale dictionary, then its base
 * language (`fr-CA` falls back to `fr`), then English, then the humanised
 * `keyToLabel` fallback so missing keys never render as raw dotted paths.
 */
export function translate(
	locale: string,
	key: string,
	params?: Record<string, string | number>,
): string {
	const base = locale.split('-')[0];
	const message = registry.get(locale)?.[key] ?? registry.get(base)?.[key] ?? translationsEn[key];
	if (message !== undefined) {
		return interpolate(message, params);
	}
	return keyToLabel(key);
}

/** Build a {@link Translator} bound to a (lazily-read) locale. */
export function createTranslator(getLocale: () => string): Translator {
	return (key, params) => translate(getLocale(), key, params);
}
