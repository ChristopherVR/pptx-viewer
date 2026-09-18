/**
 * Maps a VitePress site language (`useData().lang`, e.g. `'fr-FR'`) to the
 * viewer locale id understood by the embedded demo apps' `?locale=` param
 * (matching `pptx-viewer-locales`' `ViewerLocaleCode`: `'en' | 'fr' | 'es' |
 * 'de' | 'zh-CN'`).
 *
 * The docs site installs separately (see CLAUDE.md) and does not depend on
 * any workspace package at build time, so this is a small, self-contained
 * lookup rather than an import of `pptx-viewer-locales`. Keep the keys in
 * sync with the `lang` values configured per locale in
 * `docs/.vitepress/config.ts` and `docs/.vitepress/locales/zh.ts`.
 */
export type ViewerLocaleId = 'en' | 'fr' | 'es' | 'de' | 'zh-CN';

const VIEWER_LOCALE_BY_LANG: Record<string, ViewerLocaleId> = {
	'en-US': 'en',
	'fr-FR': 'fr',
	'es-ES': 'es',
	'de-DE': 'de',
	'zh-CN': 'zh-CN',
};

/** Resolves the embedded viewer's locale for the given VitePress site `lang`. */
export function resolveViewerLocale(lang: string): ViewerLocaleId {
	return VIEWER_LOCALE_BY_LANG[lang] ?? 'en';
}
