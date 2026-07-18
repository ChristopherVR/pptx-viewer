import { getContext, setContext } from 'svelte';

import { ViewerOptionsState } from './viewer-options.svelte';

/**
 * Svelte context for the File > Options state. `PowerPointViewer` provides a
 * single persisted {@link ViewerOptionsState}; chrome components (ribbon tab
 * bar, quick access strip, backstage, print dialog, notes panel) consume it
 * without prop threading. Mirrors the i18n / render-context idiom.
 */
const VIEWER_OPTIONS_CONTEXT_KEY = Symbol('pptx-svelte-viewer-options');

/** Provide the options state to the component subtree (root component only). */
export function provideViewerOptions(state: ViewerOptionsState): void {
	setContext(VIEWER_OPTIONS_CONTEXT_KEY, state);
}

/**
 * Consume the nearest provided options state. Falls back to a fresh,
 * non-persisted default state so components stay renderable when mounted
 * stand-alone (tests).
 */
export function useViewerOptions(): ViewerOptionsState {
	const fromContext = getContext<ViewerOptionsState | undefined>(VIEWER_OPTIONS_CONTEXT_KEY);
	return fromContext ?? new ViewerOptionsState({ persist: false });
}
