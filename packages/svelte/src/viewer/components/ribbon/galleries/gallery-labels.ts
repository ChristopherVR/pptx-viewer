import { keyToLabel } from 'pptx-viewer-shared/i18n';

import type { Translator } from '../../../../i18n/translator';

/** A translator in the shape shared's `galleryItemLabel` expects. */
export type StrictTranslator = (
	key: string,
	params?: Readonly<Record<string, string | number>>,
) => string;

/**
 * Shared's gallery label helpers detect a dictionary miss by the translator
 * returning the key itself. This binding's translator humanises a miss with
 * `keyToLabel` instead, so map that humanised form back to the key.
 */
export function strictTranslator(t: Translator): StrictTranslator {
	return (key, params) => {
		const out = t(key, params ? { ...params } : undefined);
		return out === keyToLabel(key) ? key : out;
	};
}

/** `key` translated, or `fallback` when the dictionary has no entry for it. */
export function translatedOr(t: Translator, key: string | undefined, fallback: string): string {
	if (!key) {
		return fallback;
	}
	const out = strictTranslator(t)(key);
	return out === key ? fallback : out;
}
