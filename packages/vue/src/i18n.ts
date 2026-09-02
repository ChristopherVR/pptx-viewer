import {
	keyToLabel,
	LOCALE_CATALOG,
	translationsEn as sharedTranslationsEn,
} from 'pptx-viewer-shared/i18n';
import type { LocaleCatalogEntry, TranslationKey } from 'pptx-viewer-shared/i18n';

export type { LocaleCatalogEntry, TranslationKey };
export { LOCALE_CATALOG };

/**
 * vue-i18n's message compiler only supports single-brace `{var}` named
 * interpolation and throws a fatal "Not allowed nest placeholder" parse
 * error on `{{var}}` (the i18next/ngx-translate convention the shared
 * dictionary uses, since React and Angular both expect double braces).
 * Adapt the syntax once here so every Vue consumer gets a working
 * dictionary without needing to know about the mismatch.
 *
 * Exported so hosts registering their OWN non-English dictionaries (which
 * naturally follow the shared `{{var}}` convention, e.g. ported from the
 * other bindings' demos) can run them through the same conversion before
 * handing them to `createI18n`; passing a raw `{{var}}` message crashes
 * vue-i18n at first render of that message.
 *
 * A bare `@` is the other hazard: vue-i18n reads it as the start of a linked
 * message (`@:key`) and throws "Invalid linked format" at first render, so a
 * literal one (the comment mention hint, "Type @ to mention someone") is
 * emitted as the `{'@'}` literal-interpolation escape.
 */
export function toVueI18nSyntax(messages: Record<string, string>): Record<string, string> {
	const converted: Record<string, string> = {};
	for (const [key, value] of Object.entries(messages)) {
		converted[key] = value.replace(/\{\{(?<name>\w+)\}\}/gu, '{$<name>}').replace(/@/gu, "{'@'}");
	}
	return converted;
}

export const translationsEn: Record<string, string> = toVueI18nSyntax(sharedTranslationsEn);
export { keyToLabel };
