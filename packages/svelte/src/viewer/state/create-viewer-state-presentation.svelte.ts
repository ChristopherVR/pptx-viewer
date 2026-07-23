import type { EditorController } from '../editor/editor-controller.svelte';
import type { EditorState } from '../editor/editor-state.svelte';
import { PresentationController, usePresentationEffects } from '../presentation';
import type { PresentationLoader } from './presentation-loader.svelte';
import type { ViewerParityUiState } from './viewer-parity-ui.svelte';
import type { ViewerState } from './viewer-state.svelte';
import { createViewportHandlers } from './viewport-handlers';
import type { ViewportHandlers } from './viewport-handlers';

export interface PresentationClusterDeps {
	editor: EditorState;
	viewer: ViewerState;
	loader: PresentationLoader;
	parityUi: ViewerParityUiState;
	controller: EditorController;
	getEditingActive(): boolean;
	getStageHolderEl(): HTMLDivElement | undefined;
	getRootEl(): HTMLDivElement | undefined;
}

export interface PresentationCluster extends ViewportHandlers {
	presentation: PresentationController;
}

/**
 * Presentation-mode playback (click-stepped element animations + slide
 * transitions), the rehearse-timer effects, and the fullscreen/keyboard
 * viewport handlers. Split out of `createViewerState` to keep that file
 * under the repo's file-size budget. Named `use*`, not `build*`: it
 * registers several `$effect`s of its own (rehearse timer, annotations),
 * not just constructed objects.
 */
export function usePresentationCluster(deps: PresentationClusterDeps): PresentationCluster {
	const { editor, viewer, loader, parityUi, controller } = deps;

	const presentation = new PresentationController({
		getSlides: () => editor.renderedSlides,
		getCurrentIndex: () => viewer.current,
		navigate: (index) => viewer.goTo(index),
		getShowWithAnimation: () => loader.presentationProperties.showWithAnimation,
		getFrameRoot: () => deps.getStageHolderEl()?.querySelector('.pptx-svelte-stage') ?? null,
	});
	usePresentationEffects({
		controller: presentation,
		getPresenting: () => viewer.isFullscreen,
		getCurrentIndex: () => viewer.current,
		getActiveSlide: () => editor.renderedSlides[viewer.current],
		getStageRoot: () => deps.getStageHolderEl()?.querySelector('.pptx-svelte-stage') ?? null,
	});

	let wasPresenting = false;
	$effect(() => {
		const presenting = viewer.isFullscreen;
		if (wasPresenting && !presenting && parityUi.annotations.count > 0) {
			parityUi.keepAnnotationsOpen = true;
		}
		wasPresenting = presenting;
		if (!presenting && parityUi.rehearse.active) {
			parityUi.rehearse.finish();
		}
	});
	$effect(() => {
		parityUi.rehearse.move(viewer.current);
	});
	$effect(() => {
		if (!parityUi.rehearse.active || parityUi.rehearse.paused) {
			return;
		}
		const timer = window.setInterval(() => parityUi.rehearse.tick(), 250);
		return () => window.clearInterval(timer);
	});

	const { onFullscreenToggle, onFullscreenChange, onKeydown } = createViewportHandlers({
		getRootEl: deps.getRootEl,
		viewer,
		controller,
		getEditingActive: deps.getEditingActive,
		presentation,
	});

	return { presentation, onFullscreenToggle, onFullscreenChange, onKeydown };
}
