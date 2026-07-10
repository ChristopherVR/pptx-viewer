import { keyToLabel, translationsEn } from 'pptx-viewer-shared/i18n';

/**
 * Minimal i18n for the vanilla binding.
 *
 * The other bindings delegate to their framework's i18n runtime (react-i18next,
 * vue-i18n, ngx-translate) fed by the shared `pptx.*` dictionary. The vanilla
 * binding has no framework, so this module provides the one missing piece: a
 * `t(key, params)` lookup with `{{param}}` interpolation over the same shared
 * English dictionary, plus per-locale overrides supplied by the host.
 *
 * Resolution order: host dictionary for the active locale, then the built-in
 * English dictionary, then a humanised fallback derived from the key (shared
 * `keyToLabel`), so a missing key never renders as a raw `pptx.*` string.
 */

/** Translate a dotted `pptx.*` key with optional `{{param}}` interpolation. */
export type Translator = (key: string, params?: Record<string, string | number>) => string;

/** Locale to flat `key: message` dictionary map supplied by the host. */
export type TranslationMessages = Record<string, Record<string, string>>;

function interpolate(template: string, params?: Record<string, string | number>): string {
	if (!params) {
		return template;
	}
	return template.replace(/\{\{\s*(\w+)\s*\}\}/gu, (match, name: string) => {
		const value = params[name];
		return value === undefined ? match : String(value);
	});
}

/**
 * Build a {@link Translator} for a locale. `messages[locale]` (when provided)
 * wins over the built-in English dictionary; English is always the fallback.
 */
export function createTranslator(locale = 'en', messages?: TranslationMessages): Translator {
	const localeDict = messages?.[locale];
	const baseDict = locale !== 'en' ? messages?.en : undefined;
	return (key, params) => {
		const template = localeDict?.[key] ?? baseDict?.[key] ?? translationsEn[key] ?? keyToLabel(key);
		return interpolate(template, params);
	};
}
