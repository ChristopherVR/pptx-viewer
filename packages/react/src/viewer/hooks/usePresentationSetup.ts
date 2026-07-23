import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
/**
 * usePresentationSetup: Wires up `usePresentationAnnotations` and
 * `usePresentationMode` together with the annotation-aware mode-switching
 * logic.  Returns both hook results plus the shared `actionSoundHandlerRef`.
 */
import { useRef, useState } from 'react';

import type { ViewerMode } from '../types-core';
import { playAnimationSound, stopAnimationSound } from '../utils/animation-sound';
import { stopAllPersistentAudio } from '../utils/media';
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
	visibleSlideIndexes: number[];
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
	/** Options > Advanced > "End with black slide" (default true). */
	endWithBlackSlide?: boolean;
	/**
	 * Options > Advanced > "Prompt to keep ink annotations when exiting"
	 * (default true). When false, exits skip the keep/discard dialog.
	 */
	promptKeepInkAnnotations?: boolean;
	/** Options > Advanced > "Show popup toolbar" (default true). */
	popupToolbarEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface PresentationSetupResult {
	presentation: UsePresentationModeResult;
	annotations: UsePresentationAnnotationsResult;
	actionSoundHandlerRef: React.MutableRefObject<PptxHandler | null>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePresentationSetup(input: UsePresentationSetupInput): PresentationSetupResult {
	const {
		mode,
		slides,
		visibleSlideIndexes,
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
	} = input;

	const actionSoundHandlerRef = useRef<PptxHandler | null>(null);

	// Annotations dialog state (shared between annotations & presentation)
	const [, setShowKeepAnnotationsDialog] = useState(false);
	const pendingModeRef = useRef<ViewerMode>('edit');

	const annotations = usePresentationAnnotations({
		isActive: mode === 'present',
		activeSlideIndex,
		popupToolbarEnabled,
	});

	const presentation = usePresentationMode({
		mode,
		slides,
		visibleSlideIndexes,
		activeSlideIndex,
		containerRef,
		content,
		onSetMode: (nextMode: ViewerMode) => {
			if (
				mode === 'present' &&
				nextMode !== 'present' &&
				annotations.hasAnyAnnotations &&
				promptKeepInkAnnotations
			) {
				pendingModeRef.current = nextMode;
				setShowKeepAnnotationsDialog(true);
			} else {
				if (mode === 'present' && nextMode !== 'present') {
					stopAllPersistentAudio();
					stopAnimationSound();
				}
				setMode(nextMode);
			}
		},
		onSetActiveSlideIndex: setActiveSlideIndex,
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
		onToggleLaser: () => annotations.setPresentationTool('laser'),
		onTogglePen: () => annotations.setPresentationTool('pen'),
		onToggleEraser: () => annotations.setPresentationTool('eraser'),
		onToggleToolbar: () => annotations.setToolbarVisible(!annotations.toolbarVisible),
		onSaveRehearsalTimings: (timings: Record<number, number>) => {
			setSlides((prev) => applyRehearsalTimings(prev, timings));
			history.markDirty();
		},
		loopContinuously: shouldLoopContinuously(presentationProperties),
		showWithAnimation: presentationProperties.showWithAnimation,
		useTimings: presentationProperties.advanceMode !== 'manual',
		endWithBlackSlide,
	});

	return { presentation, annotations, actionSoundHandlerRef };
}
