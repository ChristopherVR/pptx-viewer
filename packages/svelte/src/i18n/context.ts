import { getContext, setContext } from 'svelte';

import { translate } from './translator';
import type { Translator } from './translator';

/**
 * Svelte context wiring for the viewer's translator. The root
 * `PowerPointViewer` component provides a locale-bound translator; every
 * descendant chrome component consumes it via {@link useTranslator}.
 *
 * Exported (not just module-private) so the export module can seed it
 * directly via `mount(SlideStage, { context: new Map([[I18N_CONTEXT_KEY,
 * translator]]) })` when rendering the off-screen capture stage outside the
 * normal component tree; mirrors `SmartArt3DContextKey`.
 */
export const I18N_CONTEXT_KEY = Symbol('pptx-svelte-i18n');

/** Provide a translator to the component subtree (root component only). */
export function provideTranslator(translator: Translator): void {
	setContext(I18N_CONTEXT_KEY, translator);
}

/**
 * Consume the nearest provided translator. Falls back to a plain English
 * translator so components stay renderable when mounted stand-alone (tests).
 */
export function useTranslator(): Translator {
	const fromContext = getContext<Translator | undefined>(I18N_CONTEXT_KEY);
	return fromContext ?? ((key, params) => translate('en', key, params));
}
