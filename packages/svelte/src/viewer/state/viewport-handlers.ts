import type { PresentationPointerTool } from 'pptx-viewer-shared';
import {
	acceptsPresentationInput,
	createPresentationKeyBuffer,
	createWheelStepBuffer,
	mapPresentationKey,
	mapPresentationWheel,
	mapSlideShowStartKey,
	mayLeaveSlideShow,
} from 'pptx-viewer-shared';

import type { EditorController } from '../editor/editor-controller.svelte';
import type { PresentationController } from '../presentation/presentation-controller.svelte';
import { isFullscreenActive, toggleFullscreen } from './fullscreen';
import type { ViewerState } from './viewer-state.svelte';

export interface ViewportHandlersDeps {
	getRootEl(): HTMLDivElement | undefined;
	viewer: ViewerState;
	controller: EditorController;
	getEditingActive(): boolean;
	/** Presentation-mode playback controller (drives on-click animation steps). */
	presentation: PresentationController;
	/** End the running show (Esc / `-`). */
	onEndShow?(): void;
	/** Select a pointer tool (Ctrl+L / Ctrl+P / Ctrl+A / Ctrl+E). */
	setPointerTool?(tool: PresentationPointerTool): void;
	/** Erase the show's ink annotations (E). */
	eraseAnnotations?(): void;
	/** Show or hide ink markup (Ctrl+M). */
	toggleInkMarkup?(): void;
	/** Blank the screen black or white (B / W, or `.` / `,`). */
	toggleBlank?(value: 'black' | 'white'): void;
	/** Show or hide live captions (PowerPoint's bare `J`). */
	toggleSubtitles?(): void;
	/** Show or hide the running show's own chrome (Ctrl+H). */
	toggleChrome?(): void;
	/** Raise PowerPoint's "See All Slides" navigator (Ctrl+S). */
	showAllSlides?(): void;
	/** Start the show from slide 1 (F5): the ribbon's "From Beginning" button. */
	onStartFromBeginning?(): void;
	/** Start the show on the active slide (Shift+F5): the ribbon's "From Current Slide" button. */
	onStartFromCurrent?(): void;
}

export interface ViewportHandlers {
	onFullscreenToggle(): void;
	onFullscreenChange(): void;
	onKeydown(event: KeyboardEvent): void;
	/** PowerPoint navigates a running show on the wheel; inert while editing. */
	onWheel(event: WheelEvent): void;
}

/**
 * Fullscreen toggle + document `fullscreenchange` sync + the root keydown
 * handler (gates slide navigation while a selection or inline edit owns the
 * keyboard, mirroring the vanilla binding). Extracted to keep
 * `PowerPointViewer.svelte` under the file-size budget.
 */
/** Digit buffer backing PowerPoint's "type a slide number, then Enter" jump. */
const keyBuffer = createPresentationKeyBuffer();

/**
 * Resolve one key against PowerPoint's slide-show map and perform it. Returns
 * true when the key was consumed.
 */
function handleShowKey(event: KeyboardEvent, deps: ViewportHandlersDeps): boolean {
	// An audience display mirrors the presenter's screen. If its own keyboard
	// navigated, a stray key moved it off the presenter's slide and the next
	// snapshot yanked it back, which reads as the display refusing to advance.
	if (!acceptsPresentationInput()) {
		return false;
	}
	const mapped = mapPresentationKey(event, keyBuffer);
	if (mapped.action === 'none') {
		return false;
	}
	event.preventDefault();

	switch (mapped.action) {
		case 'next':
			// An advance first steps through the current slide's element-animation
			// builds; only once they are exhausted does the slide itself advance.
			deps.presentation.advance();
			return true;
		case 'previous':
			// `retreat()` owns the end screen and the replay of a slide entered
			// backward; only when it declines does the show leave the slide.
			if (!deps.presentation.retreat()) {
				// The controller owns the show order, so a hidden slide is skipped
				// going back exactly as it is going forward.
				deps.presentation.previousSlide();
			}
			return true;
		case 'first':
			deps.presentation.firstSlide();
			return true;
		case 'last':
			deps.presentation.lastSlide();
			return true;
		case 'goto': {
			const index = mapped.slideNumber - 1;
			if (index >= 0 && index < deps.viewer.slideCount) {
				deps.viewer.goTo(index);
			}
			return true;
		}
		case 'end':
			deps.onEndShow?.();
			return true;
		case 'pointerTool':
			// PowerPoint's Ctrl+A "arrow" is the plain pointer: no active tool.
			deps.setPointerTool?.(mapped.tool === 'arrow' ? 'none' : mapped.tool);
			return true;
		case 'eraseAnnotations':
			deps.eraseAnnotations?.();
			return true;
		case 'toggleInkMarkup':
			deps.toggleInkMarkup?.();
			return true;
		case 'toggleBlackScreen':
			deps.toggleBlank?.('black');
			return true;
		case 'toggleWhiteScreen':
			deps.toggleBlank?.('white');
			return true;
		case 'toggleSubtitles':
			deps.toggleSubtitles?.();
			return true;
		// Both resolved in the shared map and were then dropped: `handleShowKey`
		// returned true for them via its `default`, so the show consumed the key
		// (after `preventDefault()`) and did nothing at all.
		case 'toggleChrome':
			deps.toggleChrome?.();
			return true;
		case 'showAllSlides':
			deps.showAllSlides?.();
			return true;
		default:
			return true;
	}
}

export function createViewportHandlers(deps: ViewportHandlersDeps): ViewportHandlers {
	// Partial wheel charge, so one trackpad flick is one slide step.
	const wheelBuffer = createWheelStepBuffer();
	return {
		onWheel(event: WheelEvent): void {
			// Only a running show navigates on the wheel; the editor lets the
			// viewport scroll natively.
			// `isFullscreen` is this binding's "a show is running" signal - the same
			// gate `onKeydown` uses below.
			if (!deps.viewer.isFullscreen || !acceptsPresentationInput()) {
				return;
			}
			const mapped = mapPresentationWheel(event, wheelBuffer);
			if (mapped.intent === 'next-slide') {
				event.preventDefault();
				deps.presentation.advance();
			} else if (mapped.intent === 'previous-slide') {
				event.preventDefault();
				if (!deps.presentation.retreat()) {
					deps.presentation.previousSlide();
				}
			}
		},
		onFullscreenToggle(): void {
			// An audience display mirrors the presenter's screen: Esc / `-` must not
			// drop it out of the show and expose the editing chrome to the room.
			if (deps.viewer.isFullscreen && !mayLeaveSlideShow()) {
				return;
			}
			// Entering the show (every path funnels through here: the status-bar
			// button, ribbon "From Current Slide", `setMode('present')`, the mobile
			// toolbar): open on a slide the show actually includes rather than the
			// raw active slide (wave-4 B1). "From Beginning" instead calls
			// `presentation.firstSlide()` before reaching this toggle, so the active
			// slide is already the show's first slide and this is a no-op there.
			if (!deps.viewer.isFullscreen) {
				const entry = deps.presentation.entryIndex(deps.viewer.current);
				if (entry !== deps.viewer.current) {
					deps.viewer.goTo(entry);
				}
			}
			const root = deps.getRootEl();
			if (root) {
				void toggleFullscreen(root);
			}
		},
		onFullscreenChange(): void {
			// The audience tab has no transient activation to enter real fullscreen,
			// so it presents as a full-viewport show instead; leaving the browser's
			// fullscreen must not end that show.
			if (!mayLeaveSlideShow()) {
				deps.viewer.isFullscreen = true;
				deps.getRootEl()?.focus();
				return;
			}
			deps.viewer.isFullscreen = isFullscreenActive();
			if (deps.viewer.isFullscreen) {
				deps.getRootEl()?.focus();
			}
		},
		onKeydown(event: KeyboardEvent): void {
			// PowerPoint starts the show with F5/Shift+F5 from ANYWHERE, including a
			// read-only viewer and with the caret sitting in a text box, so this must
			// run before the editing branch below, which gates on `getEditingActive()`
			// and swallows keys the inline editor or a text-input target owns.
			const startAction = mapSlideShowStartKey(event, { isPresenting: deps.viewer.isFullscreen });
			if (startAction) {
				event.preventDefault();
				if (startAction === 'fromBeginning') {
					deps.onStartFromBeginning?.();
				} else {
					deps.onStartFromCurrent?.();
				}
				return;
			}
			if (deps.getEditingActive()) {
				deps.controller.onKeyDown(event);
				// While a selection or inline edit owns the keyboard, arrows nudge and
				// navigation is suppressed (mirrors the vanilla binding's gating).
				if (event.defaultPrevented || deps.controller.capturesKeyboard()) {
					return;
				}
			}
			// A running show takes PowerPoint's full shortcut set. Outside one only
			// the arrows/paging keys navigate: the bare-letter commands (N, P, B, W,
			// E) belong to the show and would hijack typing in the editor.
			if (deps.viewer.isFullscreen && handleShowKey(event, deps)) {
				return;
			}
			if (deps.viewer.handleNavigationKey(event.key)) {
				event.preventDefault();
			}
		},
	};
}
