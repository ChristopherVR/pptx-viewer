import { endAudienceDisplay } from 'pptx-viewer-shared';
import { onDestroy, onMount } from 'svelte';

import { PresenterSession } from '../presentation';
import type { CreateViewerStateOptions } from './create-viewer-state-types';
import type { ViewerState } from './viewer-state.svelte';

export interface PresenterClusterDeps {
	viewer: ViewerState;
	options: CreateViewerStateOptions;
	/**
	 * Raise the end-of-slide-show screen. A forward reference into the
	 * presentation cluster, which is built later (it needs the session for its
	 * blackout / ink-markup keys); only ever called from a live session event.
	 */
	showEndOfShow(): void;
}

export interface PresenterCluster {
	presenterSession: PresenterSession;
	/** Whether the presenter view (notes + next-slide preview) is up. */
	presenterMode: boolean;
	/** `Date.now()` of the last {@link enterPresenterView}; the elapsed-time display. */
	readonly presenterStartedAt: number;
	enterPresenterView(): void;
}

/**
 * The presenter/audience-display link: the cross-window `PresenterSession`,
 * its connect/dispose lifecycle, the slide-index mirror, and the presenter
 * view's own open flag. Split out of `createViewerState` to keep that file
 * under the repo's file-size budget. Named `use*`, not `build*`: it registers
 * `onMount` / `onDestroy` hooks and an `$effect`, so it must be called during
 * component initialization.
 */
export function usePresenterCluster(deps: PresenterClusterDeps): PresenterCluster {
	const { viewer, options } = deps;

	let presenterMode = $state(false);
	let presenterStartedAt = $state(Date.now());

	const presenterSession = new PresenterSession({
		getSource: options.getSource,
		getSlideIndex: () => viewer.current,
		onAudienceSlide: (index) => viewer.goTo(index),
		// The presenter ended the session: close this tab, and when the browser
		// refuses, leave the end-of-slide-show screen up instead of the editor.
		onAudienceExit: () => {
			if (endAudienceDisplay(window)) {
				deps.showEndOfShow();
			}
		},
	});
	onMount(() => {
		presenterSession.connect();
		if (presenterSession.isAudience) {
			viewer.isFullscreen = true;
		}
	});
	onDestroy(() => presenterSession.dispose());
	$effect(() => {
		presenterSession.sync(viewer.current);
	});

	return {
		presenterSession,
		get presenterMode() {
			return presenterMode;
		},
		set presenterMode(next: boolean) {
			presenterMode = next;
		},
		get presenterStartedAt() {
			return presenterStartedAt;
		},
		enterPresenterView(): void {
			presenterStartedAt = Date.now();
			presenterMode = true;
		},
	};
}
