/**
 * Reading-view session: the reactive shell around the shared state machine.
 *
 * Every rule about which slide comes next, when the view closes and how the
 * slide is fitted lives in `pptx-viewer-shared/render/reading-view`. This class
 * holds only what Svelte has to own: a `$state` cell for the current position,
 * the measured viewport the SFC binds its element box to, and one key buffer
 * for the lifetime of the session. Anything added here that starts to read like
 * a navigation rule belongs in the shared module instead, or the five bindings
 * begin to disagree about what Page Down does.
 */
import {
	applyReadingViewCommand,
	canGoNext,
	canGoPrevious,
	CLOSED_READING_VIEW,
	createPresentationKeyBuffer,
	formatSlideCounter,
	handleReadingViewKey,
	openReadingView,
	readingViewFitScale,
} from 'pptx-viewer-shared';
import type { CanvasSize, ReadingViewCommand, ReadingViewState } from 'pptx-viewer-shared';

/** Breathing room between the slide and the window edge, in CSS pixels. */
export const READING_VIEW_PADDING = 24;

export interface ReadingViewSessionInput {
	/** Slide the editor was on when the view was opened. */
	initialSlideIndex: number;
	getSlideCount: () => number;
	getCanvasSize: () => CanvasSize;
	/** Called with the slide the reader ended on, so the editor lands there. */
	onExit: (slideIndex: number) => void;
}

export class ReadingViewSession {
	/** Viewport box the SFC binds to; 0 until the first layout pass. */
	viewportWidth = $state(0);
	viewportHeight = $state(0);
	state = $state<ReadingViewState>(CLOSED_READING_VIEW);

	// One buffer per open session: `handleReadingViewKey` mutates it to
	// accumulate PowerPoint's "type a slide number, then Enter" jump, so each key
	// must be handled exactly once or every digit is swallowed.
	readonly #keys = createPresentationKeyBuffer();
	readonly #input: ReadingViewSessionInput;

	constructor(input: ReadingViewSessionInput) {
		this.#input = input;
		this.state = openReadingView(input.initialSlideIndex, input.getSlideCount());
	}

	/** Fit scale for the slide; 0 before the first layout pass. */
	get scale(): number {
		return readingViewFitScale(
			this.#input.getCanvasSize(),
			{ width: this.viewportWidth, height: this.viewportHeight },
			READING_VIEW_PADDING,
		);
	}

	get canPrevious(): boolean {
		return canGoPrevious(this.state);
	}

	get canNext(): boolean {
		return canGoNext(this.state, this.#input.getSlideCount());
	}

	/** The "3 / 12" nav-bar counter. */
	get counter(): string {
		return formatSlideCounter(this.state.slideIndex, this.#input.getSlideCount());
	}

	run(command: ReadingViewCommand): void {
		const previous = this.state;
		const next = applyReadingViewCommand(previous, command, this.#input.getSlideCount());
		this.state = next;
		if (previous.open && !next.open) {
			// Closing hands the reader back to the editor on the slide they were
			// reading, which is what leaving a PowerPoint view does.
			this.#input.onExit(previous.slideIndex);
		}
	}

	/**
	 * Handle one key press. Must be installed in the CAPTURE phase: the editor
	 * is still mounted under the overlay and listens for its own shortcuts on
	 * `window`, so without swallowing the key first an arrow would turn the page
	 * AND nudge the selected shape, and a bare Delete would destroy a shape the
	 * reader cannot see.
	 */
	handleKey(event: KeyboardEvent): void {
		const { command, swallow, preventDefault } = handleReadingViewKey(event, this.#keys);
		if (swallow) {
			event.stopPropagation();
		}
		// Space and the arrows scroll the page underneath otherwise, so the
		// reader's first Page Down would move the editor rather than the deck.
		if (preventDefault) {
			event.preventDefault();
		}
		if (command.command !== 'none') {
			this.run(command);
		}
	}
}
