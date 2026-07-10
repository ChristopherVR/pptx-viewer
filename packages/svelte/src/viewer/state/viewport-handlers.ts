import type { EditorController } from '../editor/editor-controller.svelte';
import { isFullscreenActive, toggleFullscreen } from './fullscreen';
import type { ViewerState } from './viewer-state.svelte';

export interface ViewportHandlersDeps {
	getRootEl(): HTMLDivElement | undefined;
	viewer: ViewerState;
	controller: EditorController;
	getEditingActive(): boolean;
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
			if (deps.viewer.handleNavigationKey(event.key)) {
				event.preventDefault();
			}
		},
	};
}
