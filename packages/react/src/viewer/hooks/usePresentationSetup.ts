import type { PptxElement, PptxHandler, PptxSlide } from 'pptx-viewer-core';
/**
 * usePresentationSetup: Wires up `usePresentationAnnotations` and
 * `usePresentationMode` together with the annotation-aware mode-switching
 * logic.  Returns both hook results plus the shared `actionSoundHandlerRef`.
 */
import { useRef } from 'react';

import type { ViewerMode } from '../types-core';
import { playAnimationSound, stopAnimationSound } from '../utils/animation-sound';
import { stopAllPersistentAudio } from '../utils/media';
import { mayLeaveSlideShow } from './presentation-mode/audience-content-store';
import type { EditorHistoryResult } from './useEditorHistory';
import { usePresentationAnnotations } from './usePresentationAnnotations';
import type { UsePresentationAnnotationsResult } from './usePresentationAnnotations';
import { usePresentationMode } from './usePresentationMode';
import type { UsePresentationModeResult } from './usePresentationMode';
import { shouldLoopContinuously, applyRehearsalTimings } from './usePresentationSetup-helpers';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UsePresentationSetupInput {
	mode: ViewerMode;
	slides: PptxSlide[];
	/** Master/layout shapes painted beneath each slide, by slide id (see `usePresentationMode`). */
	templateElementsBySlideId?: Record<string, PptxElement[]>;
	visibleSlideIndexes: number[];
	/**
	 * The slide canvas size (px), in the same unit the elements' own
	 * `x`/`y`/`width`/`height` are authored in. Threaded to `useAnimationPlayback`
	 * so a `p:anim` formula that needs the animated shape's real box (e.g. Grow
	 * And Turn's `-#ppt_w/2` fly-in) can be resolved instead of falling back.
	 */
	canvasSize?: { width: number; height: number };
	/** The deck's resolved theme colour map, for a scheme-colour (`a:schemeClr`) animation stop. */
	themeColorMap?: Readonly<Record<string, string>>;
	activeSlideIndex: number;
	containerRef: React.RefObject<HTMLElement | null>;
	/** Raw PPTX bytes: forwarded to audience window for content sharing. */
	content?: ArrayBuffer | Uint8Array | null;
	mediaDataUrls: Map<string, string>;
	presentationProperties: {
		loopContinuously?: boolean;
		showType?: string;
		showWithAnimation?: boolean;
		advanceMode?: 'manual' | 'useTimings';
	};
	setMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
	setActiveSlideIndex: React.Dispatch<React.SetStateAction<number>>;
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
	history: EditorHistoryResult;
	/** Custom shows defined in the presentation, for `ppaction://customshow`. */
	customShows?: Array<{ id: string; name: string; slideRIds: string[] }>;
	/** The custom show currently driving the show order, if any. */
	activeCustomShowId?: string | null;
	/** Switch the active custom show (does not itself navigate). */
	onSetActiveCustomShowId?: (id: string | null) => void;
	/** Options > Advanced > "End with black slide" (default true). */
	endWithBlackSlide?: boolean;
	/**
	 * Options > Advanced > "Prompt to keep ink annotations when exiting"
	 * (default true). When false, exits skip the keep/discard dialog.
	 */
	promptKeepInkAnnotations?: boolean;
	/** Options > Advanced > "Show popup toolbar" (default true). */
	popupToolbarEnabled?: boolean;
	/**
	 * Show or hide live captions. PowerPoint toggles them on a bare `J` during a
	 * show, and the shared slide-show keymap resolves that key for every binding;
	 * without this callback the key is mapped and then lands nowhere.
	 */
	onToggleSubtitles?: () => void;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface PresentationSetupResult {
	presentation: UsePresentationModeResult;
	annotations: UsePresentationAnnotationsResult;
	actionSoundHandlerRef: React.MutableRefObject<PptxHandler | null>;
	/**
	 * Wire the caller's own exit-mode handler (typically
	 * `useAnnotationHandlers`'s `handleSetMode`) so keyboard/end-of-show exits
	 * (Escape, the timed end-of-show advance) share the exact same
	 * keep/discard-ink-annotations dialog as the toolbar's exit button,
	 * instead of a second, independently-diverging implementation. Safe to
	 * call on every render (a plain ref write); the handler is only read
	 * later, from the async keyboard/timer callbacks below.
	 */
	setExitModeHandler: (handler: ((nextMode: ViewerMode) => void) | null) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePresentationSetup(input: UsePresentationSetupInput): PresentationSetupResult {
	const {
		mode,
		slides,
		templateElementsBySlideId,
		visibleSlideIndexes,
		canvasSize,
		themeColorMap,
		activeSlideIndex,
		containerRef,
		content,
		mediaDataUrls,
		presentationProperties,
		setMode,
		setActiveSlideIndex,
		setSlides,
		history,
		endWithBlackSlide = true,
		promptKeepInkAnnotations = true,
		popupToolbarEnabled = true,
		onToggleSubtitles,
		customShows = [],
		activeCustomShowId = null,
		onSetActiveCustomShowId,
	} = input;

	const actionSoundHandlerRef = useRef<PptxHandler | null>(null);

	// See `setExitModeHandler` on the return type: lets the caller route
	// keyboard/end-of-show exits through the same annotation-prompt dialog as
	// its own toolbar exit handler.
	const exitModeHandlerRef = useRef<((nextMode: ViewerMode) => void) | null>(null);

	const annotations = usePresentationAnnotations({
		isActive: mode === 'present',
		activeSlideIndex,
		popupToolbarEnabled,
	});

	const presentation = usePresentationMode({
		mode,
		slides,
		templateElementsBySlideId,
		visibleSlideIndexes,
		canvasSize,
		themeColorMap,
		activeSlideIndex,
		containerRef,
		content,
		onSetMode: (nextMode: ViewerMode) => {
			// An audience display mirrors the presenter's screen: Escape, the exit
			// button and the advance past the end-of-show screen must never drop it
			// into the editor in front of the room.
			if (mode === 'present' && nextMode !== 'present' && !mayLeaveSlideShow()) {
				return;
			}
			if (mode === 'present' && nextMode !== 'present') {
				stopAllPersistentAudio();
				stopAnimationSound();
				const exitHandler = exitModeHandlerRef.current;
				if (exitHandler) {
					exitHandler(nextMode);
					return;
				}
				// No external handler wired (e.g. a headless consumer that never
				// calls `setExitModeHandler`): fall back to the option's own
				// non-dialog behavior rather than getting stuck with unresolved
				// annotations blocking the exit.
				if (annotations.hasAnyAnnotations && !promptKeepInkAnnotations) {
					annotations.clearAllAnnotations();
				}
			}
			setMode(nextMode);
		},
		onSetActiveSlideIndex: setActiveSlideIndex,
		// `p:sndAc/p:endSnd` ("Stop Previous Sound"): silences whatever transition
		// sound is currently looping. A non-looping transition sound plays through
		// its own ad hoc `Audio` below rather than this singleton (it finishes on
		// its own in a few seconds either way), so only the loop case is stoppable
		// here - matching the common "Loop Until Next Sound... then Stop" pairing.
		onStopActionSound: () => stopAnimationSound(),
		onPlayActionSound: (soundPath: string, options?: { loop?: boolean }) => {
			void (async () => {
				if (!soundPath) {
					return;
				}
				// Looping sounds route through the animation-sound singleton so
				// they stop when the next sound plays or the show exits
				// (stopAnimationSound is called on mode change); a stray
				// fire-and-forget Audio would otherwise loop forever.
				const loop = options?.loop === true;
				const cachedSound = mediaDataUrls.get(soundPath);
				if (cachedSound) {
					try {
						if (loop) {
							playAnimationSound(cachedSound, true);
						} else {
							const audio = new Audio(cachedSound);
							void audio.play().catch(() => {
								/* ignore */
							});
						}
					} catch {
						/* ignore */
					}
					return;
				}
				const sharedHandler = actionSoundHandlerRef.current;
				if (!sharedHandler) {
					return;
				}
				try {
					const dataUrl = await sharedHandler.getImageData(soundPath);
					if (!dataUrl) {
						return;
					}
					mediaDataUrls.set(soundPath, dataUrl);
					if (loop) {
						playAnimationSound(dataUrl, true);
					} else {
						const audio = new Audio(dataUrl);
						void audio.play().catch(() => {
							/* ignore */
						});
					}
				} catch {
					/* ignore */
				}
			})();
		},
		// PowerPoint's Ctrl+A "arrow" is the plain pointer, i.e. no active tool.
		onSetPointerTool: (tool) => annotations.setPresentationTool(tool === 'arrow' ? 'none' : tool),
		onEraseAnnotations: () => annotations.clearAnnotations(),
		onToggleInkMarkup: () => annotations.setInkMarkupVisible(!annotations.inkMarkupVisible),
		onToggleToolbar: () => annotations.setToolbarVisible(!annotations.toolbarVisible),
		onToggleSubtitles,
		onSaveRehearsalTimings: (timings: Record<number, number>) => {
			setSlides((prev) => applyRehearsalTimings(prev, timings));
			history.markDirty();
		},
		loopContinuously: shouldLoopContinuously(presentationProperties),
		showWithAnimation: presentationProperties.showWithAnimation,
		useTimings: presentationProperties.advanceMode !== 'manual',
		endWithBlackSlide,
		customShows,
		activeCustomShowId,
		onSetActiveCustomShowId,
	});

	return {
		presentation,
		annotations,
		actionSoundHandlerRef,
		setExitModeHandler: (handler) => {
			exitModeHandlerRef.current = handler;
		},
	};
}
