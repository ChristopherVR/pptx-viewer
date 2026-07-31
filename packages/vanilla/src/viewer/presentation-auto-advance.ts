/**
 * PowerPoint's "Advance slide: After <n>" timing (`p:transition/@advTm`) for a
 * running slide show.
 *
 * A slide authored `advClick="0" advTm="…"` ("on mouse click" OFF, "after N"
 * ON) is advanced ONLY by this timer: `isSwipeAdvanceBlocked` correctly
 * swallows every click and tap on it. Honouring that gate without arming the
 * timer strands the entire show on such a slide with no response to any input,
 * which reads as a slide show that does nothing at all rather than as one stuck
 * slide.
 *
 * The delay comes from the shared `resolveAutoAdvanceDelayMs`, so the vanilla
 * binding advances a deck at exactly the moment every other binding does.
 */
import type { PptxPresentationProperties, PptxSlide } from 'pptx-viewer-core';
import { resolveAutoAdvanceDelayMs } from 'pptx-viewer-shared';

/** The slice of viewer state the scheduler reads. */
export interface AutoAdvanceState {
	slides: PptxSlide[];
	currentSlide: number;
	presenting: boolean;
	endOfShow: boolean;
	presentationProperties: PptxPresentationProperties;
}

export interface AutoAdvanceDeps {
	/** Read the live viewer state. */
	getState: () => AutoAdvanceState;
	/** Subscribe to viewer-state changes; returns an unsubscribe function. */
	subscribe: (listener: () => void) => () => void;
	/** Step the show on, exactly as the on-screen next button does. */
	next: () => void;
	/** Injectable timers so tests do not need real time. */
	setTimer?: (handler: () => void, delayMs: number) => number;
	clearTimer?: (handle: number) => void;
}

/**
 * Resolve the delay before the show advances itself, or `undefined` when the
 * current slide waits for input. Nothing is scheduled outside a running show,
 * on the end-of-show screen, or when the deck is set to advance manually.
 */
export function resolveShowAutoAdvanceMs(state: AutoAdvanceState): number | undefined {
	if (!state.presenting || state.endOfShow) {
		return undefined;
	}
	return resolveAutoAdvanceDelayMs(state.slides[state.currentSlide], {
		useTimings: state.presentationProperties.advanceMode !== 'manual',
	});
}

/**
 * Arm the timed auto-advance and keep it in sync with the store. Returns a
 * detach function that cancels any pending timer and unsubscribes.
 */
export function attachAutoAdvance(deps: AutoAdvanceDeps): () => void {
	const setTimer =
		deps.setTimer ?? ((handler, delayMs) => setTimeout(handler, delayMs) as unknown as number);
	const clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle));

	let timer: number | undefined;

	const cancel = (): void => {
		if (timer !== undefined) {
			clearTimer(timer);
			timer = undefined;
		}
	};

	const arm = (): void => {
		// Always cancel first: a manual advance must never leave the outgoing
		// slide's timer running, or it fires on the slide the presenter just
		// moved to and skips straight past it.
		cancel();
		const delayMs = resolveShowAutoAdvanceMs(deps.getState());
		if (delayMs === undefined) {
			return;
		}
		timer = setTimer(() => {
			timer = undefined;
			const before = deps.getState().currentSlide;
			deps.next();
			if (deps.getState().currentSlide === before) {
				// The tick revealed an animation build instead of changing slides.
				// Keep the clock running, or a slide whose only way forward is its
				// own timing would stall here for ever.
				arm();
			}
		}, delayMs);
	};

	// The store notifies on every patch (hover, zoom, dirty flags). Re-arming on
	// each of those would restart a short timing before it ever elapsed, so only
	// a change that actually affects the schedule re-arms it.
	const signature = (): string => {
		const state = deps.getState();
		return [
			state.presenting,
			state.endOfShow,
			state.currentSlide,
			state.presentationProperties.advanceMode ?? '',
			state.slides[state.currentSlide]?.transition?.advanceAfterMs ?? '',
		].join('|');
	};
	let lastSignature = '';

	const sync = (): void => {
		const next = signature();
		if (next === lastSignature) {
			return;
		}
		lastSignature = next;
		arm();
	};

	const detachStore = deps.subscribe(sync);
	sync();

	return () => {
		cancel();
		detachStore();
	};
}
