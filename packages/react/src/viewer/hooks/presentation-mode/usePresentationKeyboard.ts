import type { PresentationPointerTool } from 'pptx-viewer-shared';
import {
	createPresentationKeyBuffer,
	firstShowSlideIndex,
	lastShowSlideIndex,
	createWheelStepBuffer,
	mapPresentationKey,
	mapPresentationWheel,
} from 'pptx-viewer-shared';
import { useEffect, useRef } from 'react';

import type { ViewerMode } from '../../types';
import { acceptsPresentationInput } from './audience-content-store';

// ---------------------------------------------------------------------------
// Sub-hook interface
// ---------------------------------------------------------------------------

export interface UsePresentationKeyboardInput {
	mode: ViewerMode;
	movePresentationSlide: (direction: 1 | -1) => void;
	/** Jump to a 0-based slide index (Home / End / typed slide number). */
	navigateToSlide: (index: number) => void;
	/** Total slide count, bounding the typed "slide number + Enter" jump. */
	slideCount: number;
	/**
	 * Deck indexes the show visits, in show order (hidden slides removed).
	 * Home / End land on the show's first / last slide, so a deck whose first
	 * or last slide is hidden does not open one on a key PowerPoint treats as
	 * "go to the start / end of the show".
	 */
	showSlideIndexes: number[];
	onSetMode: (mode: ViewerMode) => void;
	/** Select a pointer tool (Ctrl+L / Ctrl+P / Ctrl+A / Ctrl+E). */
	onSetPointerTool?: (tool: PresentationPointerTool | 'arrow') => void;
	/** Erase this slide's ink annotations (E). */
	onEraseAnnotations?: () => void;
	/** Show or hide ink markup (Ctrl+M). */
	onToggleInkMarkup?: () => void;
	/** Show or hide the slide-show chrome (Ctrl+H). */
	onToggleToolbar?: () => void;
	/** Open the All Slides navigator (Ctrl+S). */
	onShowAllSlides?: () => void;
	/** Show or hide live captions (J). */
	onToggleSubtitles?: () => void;
	onToggleBlackScreen?: () => void;
	onToggleWhiteScreen?: () => void;
	rehearsing: boolean;
	recordCurrentSlideTime: (slideIndex: number) => void;
	presentationSlideIndex: number;
	setShowRehearsalSummary: (value: boolean) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Registers PowerPoint's slide-show shortcuts while a show is running.
 *
 * The key-to-action mapping lives in `pptx-viewer-shared` so every binding
 * resolves the same chords; this hook only performs the resulting actions.
 */
export function usePresentationKeyboard(input: UsePresentationKeyboardInput): void {
	// Partial wheel charge, so one trackpad flick is one slide step.
	const wheelBufferRef = useRef(createWheelStepBuffer());
	const {
		mode,
		movePresentationSlide,
		navigateToSlide,
		slideCount,
		showSlideIndexes,
		onSetMode,
		onSetPointerTool,
		onEraseAnnotations,
		onToggleInkMarkup,
		onToggleToolbar,
		onShowAllSlides,
		onToggleSubtitles,
		onToggleBlackScreen,
		onToggleWhiteScreen,
		rehearsing,
		recordCurrentSlideTime,
		presentationSlideIndex,
		setShowRehearsalSummary,
	} = input;

	// One digit buffer per running show, backing "type a slide number, Enter".
	const keyBufferRef = useRef(createPresentationKeyBuffer());

	useEffect(() => {
		// An audience display mirrors the presenter's screen. If its own keyboard
		// navigated, a stray key moved it off the presenter's slide and the next
		// snapshot yanked it back, which reads as the display refusing to advance.
		if (mode !== 'present' || !acceptsPresentationInput()) {
			keyBufferRef.current = createPresentationKeyBuffer();
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			const mapped = mapPresentationKey(event, keyBufferRef.current);
			if (mapped.action === 'none') {
				return;
			}

			event.preventDefault();

			switch (mapped.action) {
				case 'end':
					if (rehearsing) {
						recordCurrentSlideTime(presentationSlideIndex);
						setShowRehearsalSummary(true);
					}
					onSetMode('edit');
					return;
				case 'next':
					movePresentationSlide(1);
					return;
				case 'previous':
					movePresentationSlide(-1);
					return;
				case 'first': {
					const first = firstShowSlideIndex(showSlideIndexes);
					navigateToSlide(first ?? 0);
					return;
				}
				case 'last': {
					const last = lastShowSlideIndex(showSlideIndexes);
					navigateToSlide(last ?? Math.max(0, slideCount - 1));
					return;
				}
				case 'goto': {
					// Typed numbers are 1-based and bounded by the DECK, not the show:
					// PowerPoint reaches a hidden slide this way on purpose, which is
					// how a presenter pulls up a backup slide mid-show.
					const index = mapped.slideNumber - 1;
					if (index >= 0 && index < slideCount) {
						navigateToSlide(index);
					}
					return;
				}
				case 'pointerTool':
					onSetPointerTool?.(mapped.tool);
					return;
				case 'eraseAnnotations':
					onEraseAnnotations?.();
					return;
				case 'toggleInkMarkup':
					onToggleInkMarkup?.();
					return;
				case 'toggleChrome':
					onToggleToolbar?.();
					return;
				case 'showAllSlides':
					onShowAllSlides?.();
					return;
				case 'toggleSubtitles':
					onToggleSubtitles?.();
					return;
				case 'toggleBlackScreen':
					onToggleBlackScreen?.();
					return;
				case 'toggleWhiteScreen':
					onToggleWhiteScreen?.();
					break;
				// `buffering` (a pending slide number) and `contextMenu` are consumed
				// here so the browser does not act on them; nothing else to do.
				default:
					break;
			}
		};

		// PowerPoint navigates a running show on the wheel: down advances, up goes
		// back. The step buffer keeps one trackpad flick to one slide.
		const handleWheel = (event: WheelEvent): void => {
			if (mode !== 'present' || !acceptsPresentationInput()) {
				return;
			}
			const mapped = mapPresentationWheel(event, wheelBufferRef.current);
			if (mapped.intent === 'next-slide') {
				event.preventDefault();
				movePresentationSlide(1);
			} else if (mapped.intent === 'previous-slide') {
				event.preventDefault();
				movePresentationSlide(-1);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('wheel', handleWheel, { passive: false });
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('wheel', handleWheel);
		};
	}, [
		mode,
		movePresentationSlide,
		navigateToSlide,
		slideCount,
		showSlideIndexes,
		onSetMode,
		onSetPointerTool,
		onEraseAnnotations,
		onToggleInkMarkup,
		onToggleToolbar,
		onShowAllSlides,
		onToggleSubtitles,
		onToggleBlackScreen,
		onToggleWhiteScreen,
		rehearsing,
		recordCurrentSlideTime,
		presentationSlideIndex,
		setShowRehearsalSummary,
	]);
}
