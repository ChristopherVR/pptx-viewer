import { mayLeaveSlideShow } from 'pptx-viewer-shared';

import type { EditorController } from '../editor/editor-controller.svelte';
import type { EditorState } from '../editor/editor-state.svelte';
import { PresentationController, usePresentationEffects } from '../presentation';
import type { PresenterSession } from '../presentation';
import { providePresentationElementStates } from './presentation-element-states-context';
import type { PresentationLoader } from './presentation-loader.svelte';
import type { ViewerOptionsState } from './viewer-options.svelte';
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
	/** The audience-display link, driven by the B/W blackout and Ctrl+M ink keys. */
	presenterSession: PresenterSession;
	/** File > Options, read for Advanced > "End with black slide". */
	optionsState: ViewerOptionsState;
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
	const { editor, viewer, loader, parityUi, controller, presenterSession, optionsState } = deps;

	const presentation = new PresentationController({
		getSlides: () => editor.renderedSlides,
		getCurrentIndex: () => viewer.current,
		navigate: (index) => viewer.goTo(index),
		getShowWithAnimation: () => loader.presentationProperties.showWithAnimation,
		// Past the last slide the controller raises the black end screen; a further
		// forward input (or a click on it) ends the show, like PowerPoint.
		exit: () => {
			// Never in an audience display: it has no editor to fall back to.
			if (mayLeaveSlideShow()) {
				viewer.isFullscreen = false;
			}
		},
		getFrameRoot: () => deps.getStageHolderEl()?.querySelector('.pptx-svelte-stage') ?? null,
		// File > Options > Advanced > "End with black slide". Off means the show
		// exits straight to the editor instead of raising the black end screen.
		getEndWithBlackSlide: () => optionsState.options.advanced.slideShowEndWithBlackSlide,
		// Slide Show > Custom Shows: restrict playback to the selected show's
		// members. Resolved fresh on every read so a show edited (or deleted) mid
		// session is honoured without re-creating the controller.
		getActiveCustomShow: () =>
			parityUi.activeCustomShowId
				? (editor.customShows.find(({ id }) => id === parityUi.activeCustomShowId) ?? null)
				: null,
		// Resolve a native-animation `p:stSnd` action sound's archive path to
		// its pre-resolved Blob/data URL and play it. Without this,
		// `onPlayActionSound` was never passed at all and every animation
		// sound was silently dropped.
		onPlayActionSound: (soundPath: string) => {
			const url = loader.mediaDataUrls.get(soundPath);
			if (!url || typeof Audio === 'undefined') {
				return;
			}
			const audio = new Audio(url);
			void audio.play().catch(() => {
				/* ignore autoplay restrictions */
			});
		},
	});
	// Publish the per-element native-animation state map so the chart / SmartArt /
	// connector / shape renderers can reveal staged builds and relinquish animated
	// fill / stroke (mirrors Vue's `providePresentationElementStates`).
	providePresentationElementStates(() => presentation.elementStates);
	usePresentationEffects({
		controller: presentation,
		getPresenting: () => viewer.isFullscreen,
		getCurrentIndex: () => viewer.current,
		getActiveSlide: () => editor.renderedSlides[viewer.current],
		getStageRoot: () => deps.getStageHolderEl()?.querySelector('.pptx-svelte-stage') ?? null,
		// `p:showPr/@useTimings`: "manual" turns every slide's authored advTm off.
		// Read from the EDITOR, not the loader: the loader holds the as-parsed
		// snapshot, so a change made after load (the Slide Show tab's Use Timings
		// box, or Set Up Slide Show's Advance Slides radios) would never reach
		// playback. The editor's copy is seeded from the loader's on every load.
		getUseTimings: () => editor.presentationProperties.advanceMode !== 'manual',
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

	// `onEndShow` re-enters the toggle these handlers themselves expose; the
	// closure only runs on a key press, long after this assignment completes.
	const handlers: ViewportHandlers = createViewportHandlers({
		getRootEl: deps.getRootEl,
		viewer,
		controller,
		getEditingActive: deps.getEditingActive,
		presentation,
		onEndShow: () => handlers.onFullscreenToggle(),
		setPointerTool: (tool) => {
			parityUi.annotations.tool = tool;
		},
		eraseAnnotations: () => parityUi.annotations.clear(),
		toggleInkMarkup: () =>
			presenterSession.updateSnapshot({
				inkMarkupVisible: presenterSession.snapshot.inkMarkupVisible === false,
			}),
		toggleBlank: (value) =>
			presenterSession.updateSnapshot({
				blackout: presenterSession.snapshot.blackout === value ? 'none' : value,
			}),
		// PowerPoint's bare `J`. The same flag the ribbon's Subtitles command
		// writes, so the key and the menu entry cannot disagree.
		toggleSubtitles: () => {
			parityUi.subtitlesEnabled = !parityUi.subtitlesEnabled;
		},
		// PowerPoint's Ctrl+H. Drives the toolbar's own fade flag, the one
		// auto-hide writes, so the shortcut and the countdown cannot disagree.
		toggleChrome: () => parityUi.showChrome.toggleVisible(),
		// PowerPoint's Ctrl+S ("See All Slides"), laid over the show: the point of
		// the shortcut is reaching a backup slide WITHOUT leaving the show, so it
		// must not be a door into presenter view.
		showAllSlides: () => {
			parityUi.allSlidesOpen = true;
		},
	});

	return { presentation, ...handlers };
}
