import type { PptxSlide } from 'pptx-viewer-core';
import { resolveAutoAdvanceDelayMs } from 'pptx-viewer-shared';

/**
 * PowerPoint's "Advance slide: After <n>" timing (`p:transition/@advTm`),
 * resolved for the Svelte slide show.
 *
 * Kept as a pure function (no runes) so it is unit-testable on its own; the
 * `$effect` that arms and cancels the timer lives in `presentation-effects`.
 *
 * This is not merely a missing convenience. A slide authored
 * `advClick="0" advTm="…"` (PowerPoint's "on click OFF, after N") is advanced
 * ONLY by this timer, and the click gate (`isClickAdvanceAllowed`) correctly
 * swallows every click on it. A binding that honours the gate without arming
 * the timer sits on that slide for ever with no visible response to any input,
 * which reads as "the slide show does nothing at all".
 */
export interface SlideAutoAdvanceInput {
	/** True only while the viewer is the fullscreen (presentation) element. */
	presenting: boolean;
	/** The slide currently on screen. */
	slide: PptxSlide | undefined;
	/**
	 * False when the show is set to advance manually
	 * (`PptxPresentationProperties.advanceMode === 'manual'`); the parsed default
	 * is "Using timings, if present", so this is normally true.
	 */
	useTimings: boolean;
	/** True while the black "End of slide show" screen is up. */
	endOfShow: boolean;
}

/**
 * Delay in ms before the show steps on by itself, or `undefined` when the
 * current slide waits for input. Nothing is scheduled outside presentation
 * mode, on the end-of-show screen, or in manual-advance mode.
 */
export function resolveSlideAutoAdvanceMs(input: SlideAutoAdvanceInput): number | undefined {
	if (!input.presenting || input.endOfShow) {
		return undefined;
	}
	return resolveAutoAdvanceDelayMs(input.slide, { useTimings: input.useTimings });
}

/**
 * The show's timed auto-advance, as an object so it can be cancelled and
 * re-armed from OUTSIDE the `$effect` that schedules it: the presentation
 * visibility handler cancels the pending tick while the tab is hidden (the
 * deck must not run on unseen) and re-arms the current slide's full delay once
 * the tab is visible again. Pure timers (no runes), unit-testable on its own;
 * `presentation-effects` owns the reactive scheduling.
 */
export class ShowAutoAdvanceTimer {
	#timer: ReturnType<typeof setTimeout> | undefined;
	#delayMs: number | undefined;

	constructor(private readonly advance: () => void) {}

	/** Adopt the current slide's resolved delay and (re)arm from scratch. */
	schedule(delayMs: number | undefined): void {
		this.#delayMs = delayMs;
		this.arm();
	}

	/** (Re)start the pending tick for the last scheduled delay. */
	arm(): void {
		// Always cancel first: re-arming must never leave two timers running.
		this.cancel();
		const delayMs = this.#delayMs;
		if (delayMs === undefined) {
			return;
		}
		this.#timer = setTimeout(() => {
			this.#timer = undefined;
			this.advance();
		}, delayMs);
	}

	/** Cancel the pending tick without forgetting the scheduled delay. */
	cancel(): void {
		if (this.#timer !== undefined) {
			clearTimeout(this.#timer);
			this.#timer = undefined;
		}
	}
}
