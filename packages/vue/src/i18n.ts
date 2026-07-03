import { keyToLabel, translationsEn as sharedTranslationsEn } from 'pptx-viewer-shared/i18n';
import type { TranslationKey } from 'pptx-viewer-shared/i18n';

export type { TranslationKey };

/**
 * vue-i18n's message compiler only supports single-brace `{var}` named
 * interpolation and throws a fatal "Not allowed nest placeholder" parse
 * error on `{{var}}` (the i18next/ngx-translate convention the shared
 * dictionary uses, since React and Angular both expect double braces).
 * Adapt the syntax once here so every Vue consumer gets a working
 * dictionary without needing to know about the mismatch.
 */
function toVueI18nSyntax(messages: Record<string, string>): Record<string, string> {
	const converted: Record<string, string> = {};
	for (const [key, value] of Object.entries(messages)) {
		converted[key] = value.replace(/\{\{(?<name>\w+)\}\}/gu, '{$<name>}');
	}
	return converted;
}

export const translationsEn: Record<string, string> = toVueI18nSyntax(sharedTranslationsEn);
export { keyToLabel };
