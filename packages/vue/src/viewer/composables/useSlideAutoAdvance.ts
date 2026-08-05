/**
 * useSlideAutoAdvance - PowerPoint's "Advance slide: After <n>" timing.
 *
 * A slide authored `<p:transition advClick="0" advTm="…"/>` ("on mouse click"
 * OFF, "after N" ON) is advanced ONLY by this timer: the click gate correctly
 * swallows every click on it. A binding that honours the gate without arming
 * the timer therefore strands the whole show on that slide with no visible
 * response to any input, which reads as a slide show that does nothing at all
 * rather than as one stuck slide.
 *
 * The delay itself comes from the shared `resolveAutoAdvanceDelayMs`, so every
 * binding agrees on when a deck advances by itself.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { resolveAutoAdvanceDelayMs } from 'pptx-viewer-shared';
import { onBeforeUnmount, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

export interface SlideAutoAdvanceInput {
	/** The slide the show currently displays. */
	slide: MaybeRefOrGetter<PptxSlide | undefined>;
	/**
	 * Whether authored timings run at all. False is PowerPoint's "Advance
	 * slides: Manually" (`PptxPresentationProperties.advanceMode === 'manual'`).
	 */
	useTimings: MaybeRefOrGetter<boolean>;
	/**
	 * Nothing is scheduled while this is true: the end-of-show screen must not
	 * tick itself forward and close the show behind the presenter's back.
	 */
	suspended: MaybeRefOrGetter<boolean>;
	/** Where the show currently is, used to detect a tick the slide absorbed. */
	position: MaybeRefOrGetter<number>;
	/** Step the show on, exactly as the toolbar's next button does. */
	advance: () => void;
}

export interface SlideAutoAdvanceResult {
	/** Cancel any pending auto-advance (exposed for tests and manual teardown). */
	cancel: () => void;
	/**
	 * Re-arm the timer for the CURRENT slide from scratch. Used when the tab
	 * becomes visible again after a hide cancelled the pending advance: the show
	 * must not step forward while nobody can see it, but the slide's authored
	 * timing starts over once it is back on screen.
	 */
	rearm: () => void;
}

export function useSlideAutoAdvance(input: SlideAutoAdvanceInput): SlideAutoAdvanceResult {
	let timer: ReturnType<typeof setTimeout> | undefined;

	function cancel(): void {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
	}

	function arm(): void {
		// Always cancel first: a manual advance must never leave the outgoing
		// slide's timer running, or it fires on the slide the presenter just
		// moved to and skips it.
		cancel();
		if (toValue(input.suspended)) {
			return;
		}
		const delayMs = resolveAutoAdvanceDelayMs(toValue(input.slide), {
			useTimings: toValue(input.useTimings),
		});
		if (delayMs === undefined) {
			return;
		}
		timer = setTimeout(() => {
			timer = undefined;
			const before = toValue(input.position);
			input.advance();
			if (toValue(input.position) === before) {
				// The tick revealed an animation build instead of changing slides.
				// Keep the clock running, or a slide whose only exit is its timing
				// would stall here for ever.
				arm();
			}
		}, delayMs);
	}

	watch(
		() => [toValue(input.slide), toValue(input.useTimings), toValue(input.suspended)] as const,
		arm,
		{ immediate: true },
	);

	onBeforeUnmount(cancel);

	return { cancel, rearm: arm };
}
