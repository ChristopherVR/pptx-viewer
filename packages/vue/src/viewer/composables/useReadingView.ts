/**
 * Reading-view state, keyboard and measurement, kept out of the markup.
 *
 * The navigation rules themselves live in `pptx-viewer-shared`; this composable
 * is only the Vue wiring around them (a state ref, a window key listener and a
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { CanvasSize } from '../types';

/** Breathing room between the slide and the window edge, in CSS pixels. */
export const READING_VIEW_PADDING = 24;

export interface UseReadingViewInput {
	/** Read as a getter so a slide deleted underneath the reader still clamps. */
	slideCount: () => number;
	canvasSize: () => CanvasSize;
	/** Slide the editor was on when the view was opened. */
	initialSlideIndex: () => number;
	/** Called with the slide the reader ended on, so the editor lands there. */
	onExit: (slideIndex: number) => void;
}

export interface UseReadingViewResult {
	state: Ref<ReadingViewState>;
	/** Template ref for the element the slide is fitted into. */
	viewportRef: Ref<HTMLElement | null>;
	/** Fit scale for the slide, 0 before the first layout pass. */
	scale: ComputedRef<number>;
	run: (command: ReadingViewCommand) => void;
}

export function useReadingView(input: UseReadingViewInput): UseReadingViewResult {
	const state = ref<ReadingViewState>(
		openReadingView(input.initialSlideIndex(), input.slideCount()),
	);
	const viewportRef = ref<HTMLElement | null>(null);
	const viewport = ref<CanvasSize>({ width: 0, height: 0 });

	function run(command: ReadingViewCommand): void {
		const previous = state.value;
		const next = applyReadingViewCommand(previous, command, input.slideCount());
		state.value = next;
		if (previous.open && !next.open) {
			// Closing hands the reader back to the editor on the slide they were
			// reading, which is what leaving a PowerPoint view does.
			input.onExit(previous.slideIndex);
		}
	}

	// -- Keyboard ------------------------------------------------------------

	// One buffer for the whole open session, handled exactly once per key: the
	// call mutates the buffer to accumulate PowerPoint's "type a slide number,
	// then Enter" jump, so handling twice would swallow every digit.
	const keyBuffer = createPresentationKeyBuffer();

	function onKeyDown(event: KeyboardEvent): void {
		const { command, swallow, preventDefault } = handleReadingViewKey(event, keyBuffer);
		// Swallowing takes the key away from the editor's own window-level
		// shortcut registry, which is still listening behind the overlay. Without
		// it, an arrow press while a shape happens to be selected also nudges that
		// shape, and Delete destroys one: a reader would be silently editing the
		// deck they believe they are only reading.
		if (swallow) {
			event.stopPropagation();
		}
		// Space and the arrows scroll the page underneath otherwise, so the
		// reader's first Page Down would move the editor rather than the deck.
		if (preventDefault) {
			event.preventDefault();
		}
		if (command.command !== 'none') {
			run(command);
		}
	}

	// -- Measurement ---------------------------------------------------------

	let observer: ResizeObserver | undefined;

	onMounted(() => {
		window.addEventListener('keydown', onKeyDown, true);
		const element = viewportRef.value;
		if (!element || typeof ResizeObserver === 'undefined') {
			return;
		}
		observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (rect) {
				viewport.value = { width: rect.width, height: rect.height };
			}
		});
		observer.observe(element);
	});

	onBeforeUnmount(() => {
		window.removeEventListener('keydown', onKeyDown, true);
		observer?.disconnect();
		observer = undefined;
	});

	const scale = computed(() =>
		readingViewFitScale(input.canvasSize(), viewport.value, READING_VIEW_PADDING),
	);

	return { state, viewportRef, scale, run };
}
