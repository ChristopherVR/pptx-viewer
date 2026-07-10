/**
 * Public i18n entry point (`pptx-svelte-viewer/i18n`).
 *
 * Re-exports the shared English dictionary plus the Svelte binding's
 * translator helpers so hosts can register additional locales or override
 * individual strings.
 */
export { keyToLabel, translationsEn } from 'pptx-viewer-shared/i18n';
export type { TranslationKey } from 'pptx-viewer-shared/i18n';
export { createTranslator, interpolate, registerTranslations, translate } from './i18n/translator';
export type { TranslationDictionary, Translator } from './i18n/translator';
