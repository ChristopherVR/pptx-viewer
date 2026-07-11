import type { EditorController } from '../editor/editor-controller.svelte';
import type { PresentationController } from '../presentation/presentation-controller.svelte';
import { isFullscreenActive, toggleFullscreen } from './fullscreen';
import { resolveNavigationKey } from './navigation';
import type { ViewerState } from './viewer-state.svelte';

export interface ViewportHandlersDeps {
	getRootEl(): HTMLDivElement | undefined;
	viewer: ViewerState;
	controller: EditorController;
	getEditingActive(): boolean;
	/** Presentation-mode playback controller (drives on-click animation steps). */
	presentation: PresentationController;
}

export interface ViewportHandlers {
	onFullscreenToggle(): void;
	onFullscreenChange(): void;
	onKeydown(event: KeyboardEvent): void;
}

/**
 * Fullscreen toggle + document `fullscreenchange` sync + the root keydown
 * handler (gates slide navigation while a selection or inline edit owns the
 * keyboard, mirroring the vanilla binding). Extracted to keep
 * `PowerPointViewer.svelte` under the file-size budget.
 */
export function createViewportHandlers(deps: ViewportHandlersDeps): ViewportHandlers {
	return {
		onFullscreenToggle(): void {
			const root = deps.getRootEl();
			if (root) {
				void toggleFullscreen(root);
			}
		},
		onFullscreenChange(): void {
			deps.viewer.isFullscreen = isFullscreenActive();
		},
		onKeydown(event: KeyboardEvent): void {
			if (deps.getEditingActive()) {
				deps.controller.onKeyDown(event);
				// While a selection or inline edit owns the keyboard, arrows nudge and
				// navigation is suppressed (mirrors the vanilla binding's gating).
				if (event.defaultPrevented || deps.controller.capturesKeyboard()) {
					return;
				}
			}
			// While presenting, an advance key first steps through the current
			// slide's element-animation builds; only once they are exhausted does
			// the controller advance the slide. Backwards / first / last keys fall
			// through to plain slide navigation (playback resets on slide change).
			if (deps.viewer.isFullscreen && resolveNavigationKey(event.key) === 'next') {
				event.preventDefault();
				deps.presentation.advance();
				return;
			}
			if (deps.viewer.handleNavigationKey(event.key)) {
				event.preventDefault();
			}
		},
	};
}
