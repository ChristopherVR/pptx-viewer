/**
 * Reading-view state, keyboard and measurement, kept out of the markup.
 *
 * The navigation rules themselves live in `pptx-viewer-shared`; this hook is
 * only the React wiring around them (a state cell, a window key listener and a
 * ResizeObserver). Anything here that starts to look like a rule about which
 * slide comes next belongs in the shared module instead, or the five bindings
 * begin to disagree.
 */
import {
	applyReadingViewCommand,
	createPresentationKeyBuffer,
	handleReadingViewKey,
	openReadingView,
	readingViewFitScale,
} from 'pptx-viewer-shared';
import type { ReadingViewCommand, ReadingViewState } from 'pptx-viewer-shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CanvasSize } from '../../types';

/** Breathing room between the slide and the window edge, in CSS pixels. */
export const READING_VIEW_PADDING = 24;

export interface UseReadingViewInput {
	slideCount: number;
	canvasSize: CanvasSize;
	/** Slide the editor was on when the view was opened. */
	initialSlideIndex: number;
	/** Called with the slide the reader ended on, so the editor lands there. */
	onExit: (slideIndex: number) => void;
}

export interface UseReadingViewResult {
	state: ReadingViewState;
	/** Ref for the element the slide is fitted into. */
	viewportRef: React.RefObject<HTMLDivElement | null>;
	/** Fit scale for the slide, 0 before the first layout pass. */
	scale: number;
	run: (command: ReadingViewCommand) => void;
}

export function useReadingView(input: UseReadingViewInput): UseReadingViewResult {
	const { slideCount, canvasSize, initialSlideIndex, onExit } = input;

	const [state, setState] = useState<ReadingViewState>(() =>
		openReadingView(initialSlideIndex, slideCount),
	);
	const viewportRef = useRef<HTMLDivElement>(null);
	const [viewport, setViewport] = useState({ width: 0, height: 0 });

	// The exit callback is read through a ref so the key listener below is
	// installed once. Re-binding it on every render of the host would drop key
	// presses that arrive mid-render on a slow deck.
	const onExitRef = useRef(onExit);
	onExitRef.current = onExit;

	const run = useCallback(
		(command: ReadingViewCommand) => {
			setState((previous) => {
				const next = applyReadingViewCommand(previous, command, slideCount);
				if (previous.open && !next.open) {
					// Closing hands the reader back to the editor on the slide they
					// were reading, which is what leaving a PowerPoint view does.
					onExitRef.current(previous.slideIndex);
				}
				return next;
			});
		},
		[slideCount],
	);

	// -- Keyboard ------------------------------------------------------------

	// Capture phase, not bubble: the editor's own shortcut handler is still
	// listening on `window` underneath this overlay, and until this ran first an
	// arrow key both turned the page AND nudged the selected shape behind the
	// overlay, so merely reading a deck edited it.
	useEffect(() => {
		const buffer = createPresentationKeyBuffer();
		const handle = (event: KeyboardEvent): void => {
			// Handled exactly once: the call mutates `buffer` to accumulate a typed
			// slide number, so handling twice would swallow every digit.
			const { command, swallow, preventDefault } = handleReadingViewKey(event, buffer);
			if (swallow) {
				event.stopPropagation();
			}
			if (preventDefault) {
				// Space and the arrows would otherwise scroll the page underneath.
				event.preventDefault();
			}
			if (command.command !== 'none') {
				run(command);
			}
		};
		window.addEventListener('keydown', handle, true);
		return () => window.removeEventListener('keydown', handle, true);
	}, [run]);

	// -- Measurement ---------------------------------------------------------

	useEffect(() => {
		const element = viewportRef.current;
		if (!element) {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (rect) {
				setViewport({ width: rect.width, height: rect.height });
			}
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const scale = useMemo(
		() => readingViewFitScale(canvasSize, viewport, READING_VIEW_PADDING),
		[canvasSize, viewport],
	);

	return { state, viewportRef, scale, run };
}
