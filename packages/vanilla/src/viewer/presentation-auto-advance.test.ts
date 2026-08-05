import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { AutoAdvanceState } from './presentation-auto-advance';
import { attachAutoAdvance, resolveShowAutoAdvanceMs } from './presentation-auto-advance';

function slide(id: string, advanceAfterMs?: number, advanceOnClick?: boolean): PptxSlide {
	return {
		id,
		rId: id,
		slideNumber: 1,
		elements: [],
		transition:
			advanceAfterMs === undefined ? undefined : { type: 'fade', advanceAfterMs, advanceOnClick },
	} as unknown as PptxSlide;
}

function makeState(patch: Partial<AutoAdvanceState> = {}): AutoAdvanceState {
	return {
		// Slide 1 of `solution-explorer.pptx`: advClick="0" advTm="10", i.e. the
		// timer is its ONLY way forward.
		slides: [slide('s1', 10, false), slide('s2'), slide('s3')],
		currentSlide: 0,
		presenting: true,
		endOfShow: false,
		presentationProperties: {},
		...patch,
	};
}

describe('resolveShowAutoAdvanceMs', () => {
	it('honours a slide authored advClick="0" advTm="10"', () => {
		expect(resolveShowAutoAdvanceMs(makeState())).toBe(10);
	});

	it('schedules nothing outside a running show, on the end screen, or when manual', () => {
		expect(resolveShowAutoAdvanceMs(makeState({ presenting: false }))).toBeUndefined();
		expect(resolveShowAutoAdvanceMs(makeState({ endOfShow: true }))).toBeUndefined();
		expect(
			resolveShowAutoAdvanceMs(makeState({ presentationProperties: { advanceMode: 'manual' } })),
		).toBeUndefined();
	});

	it('schedules nothing for a slide without an authored timing', () => {
		expect(resolveShowAutoAdvanceMs(makeState({ currentSlide: 1 }))).toBeUndefined();
	});
});

describe('attachAutoAdvance', () => {
	/** A minimal store stand-in with the notify semantics the real one has. */
	function harness(initial: AutoAdvanceState = makeState()) {
		let state = initial;
		const listeners = new Set<() => void>();
		const timers = new Map<number, () => void>();
		let nextHandle = 1;
		const scheduled: number[] = [];

		const set = (patch: Partial<AutoAdvanceState>): void => {
			state = { ...state, ...patch };
			for (const listener of [...listeners]) {
				listener();
			}
		};
		const runTimers = (): void => {
			for (const [handle, handler] of [...timers]) {
				timers.delete(handle);
				handler();
			}
		};
		return {
			get state() {
				return state;
			},
			set,
			runTimers,
			scheduled,
			pending: () => timers.size,
			deps: {
				getState: () => state,
				subscribe: (listener: () => void) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
				next: vi.fn(() => {
					set({ currentSlide: Math.min(state.slides.length - 1, state.currentSlide + 1) });
				}),
				setTimer: (handler: () => void, delayMs: number) => {
					const handle = nextHandle++;
					scheduled.push(delayMs);
					timers.set(handle, handler);
					return handle;
				},
				clearTimer: (handle: number) => {
					timers.delete(handle);
				},
			},
		};
	}

	it('advances a slide that forbids click-advance but sets a timing', () => {
		const h = harness();
		const { detach } = attachAutoAdvance(h.deps);
		expect(h.scheduled).toStrictEqual([10]);

		h.runTimers();
		expect(h.deps.next).toHaveBeenCalledOnce();
		expect(h.state.currentSlide).toBe(1);
		// Slide 2 carries no timing, so nothing is re-armed.
		expect(h.pending()).toBe(0);
		detach();
	});

	it('cancels the outgoing slide timer when the presenter advances manually', () => {
		const h = harness();
		const { detach } = attachAutoAdvance(h.deps);
		expect(h.pending()).toBe(1);

		// A manual move to an untimed slide must leave nothing running, or the
		// stale timer fires on the slide the presenter just moved to.
		h.set({ currentSlide: 1 });
		expect(h.pending()).toBe(0);
		detach();
	});

	it('keeps the clock running when a tick only revealed an animation build', () => {
		const h = harness();
		// `next()` steps builds first: the slide index does not change.
		h.deps.next.mockImplementation(() => {
			/* build step only */
		});
		const { detach } = attachAutoAdvance(h.deps);

		h.runTimers();
		expect(h.deps.next).toHaveBeenCalledOnce();
		expect(h.pending()).toBe(1);
		detach();
	});

	it('ignores unrelated store churn instead of restarting the timing', () => {
		const h = harness();
		const { detach } = attachAutoAdvance(h.deps);
		expect(h.scheduled).toStrictEqual([10]);

		// A patch that cannot affect the schedule must not re-arm; re-arming on
		// every store notification would restart a 10 ms timing for ever.
		h.set({});
		expect(h.scheduled).toStrictEqual([10]);
		detach();
	});

	it('cancels everything on detach', () => {
		const h = harness();
		const { detach } = attachAutoAdvance(h.deps);
		detach();
		expect(h.pending()).toBe(0);
		h.set({ currentSlide: 0, presenting: true });
		expect(h.pending()).toBe(0);
	});

	it('cancel stops the pending tick and rearm restarts the full delay', () => {
		// The visibility handler's contract: hiding the tab cancels the pending
		// advance (the deck must not run on unseen), and the timing starts over
		// from scratch when the tab is visible again.
		const h = harness();
		const handle = attachAutoAdvance(h.deps);
		expect(h.pending()).toBe(1);

		handle.cancel();
		expect(h.pending()).toBe(0);
		// Unrelated store churn while hidden must not resurrect the timer.
		h.set({});
		expect(h.pending()).toBe(0);

		handle.rearm();
		expect(h.pending()).toBe(1);
		expect(h.scheduled).toStrictEqual([10, 10]);

		h.runTimers();
		expect(h.deps.next).toHaveBeenCalledOnce();
		handle.detach();
	});
});
