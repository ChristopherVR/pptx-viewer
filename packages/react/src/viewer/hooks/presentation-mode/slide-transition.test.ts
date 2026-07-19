import type { PptxSlide } from 'pptx-viewer-core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { executeSlideTransition } from './slide-transition';
import type { SlideTransitionDeps } from './slide-transition';

function createMockSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'slide-1',
		elements: [],
		...overrides,
	} as PptxSlide;
}

/** A slide carrying a real animated transition (fade, 300ms). */
function createTransitionSlide(): PptxSlide {
	return createMockSlide({
		id: 'slide-2',
		transition: { type: 'fade', durationMs: 300 } as PptxSlide['transition'],
	});
}

function createMockDeps(overrides: Partial<SlideTransitionDeps> = {}): SlideTransitionDeps {
	return {
		// Default: advancing from slide 1 (index 0) into a transition-bearing slide 2.
		slides: [createMockSlide(), createTransitionSlide()],
		currentSlideIndex: 0,
		onPlayActionSound: vi.fn<() => void>(),
		setPresentationSlideVisible: vi.fn<() => void>(),
		clearPresentationTimers: vi.fn<() => void>(),
		setPresentationSlideIndex: vi.fn<() => void>(),
		onSetActiveSlideIndex: vi.fn<() => void>(),
		runPresentationEntranceAnimations: vi.fn<() => void>(),
		scheduleAutoAdvanceForSlide: vi.fn<() => void>(),
		presentationTimersRef: { current: [] },
		setTransitionOverlay: vi.fn<() => void>(),
		playTransition: true,
		...overrides,
	};
}

describe('executeSlideTransition', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('window', {
			setTimeout: globalThis.setTimeout,
			clearTimeout: globalThis.clearTimeout,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('swaps to the incoming slide immediately (main stage renders it under the overlay)', () => {
		const deps = createMockDeps();
		executeSlideTransition(1, deps);
		expect(deps.setPresentationSlideIndex).toHaveBeenCalledWith(1);
		expect(deps.onSetActiveSlideIndex).toHaveBeenCalledWith(1);
		expect(deps.setPresentationSlideVisible).toHaveBeenCalledWith(true);
	});

	it('clears existing timers', () => {
		const deps = createMockDeps();
		executeSlideTransition(1, deps);
		expect(deps.clearPresentationTimers).toHaveBeenCalledWith();
	});

	it('mounts the transition overlay for a forward move into a transition slide', () => {
		const deps = createMockDeps();
		executeSlideTransition(1, deps);
		expect(deps.setTransitionOverlay).toHaveBeenCalledWith({
			outgoingSlideIndex: 0,
			incomingSlideIndex: 1,
			transition: { type: 'fade', durationMs: 300 },
			durationMs: 300,
		});
	});

	it('plays the incoming slide transition sound when present', () => {
		const deps = createMockDeps({
			slides: [
				createMockSlide(),
				createMockSlide({
					transition: {
						type: 'fade',
						durationMs: 300,
						soundPath: 'swoosh.wav',
					} as PptxSlide['transition'],
				}),
			],
		});
		executeSlideTransition(1, deps);
		expect(deps.onPlayActionSound).toHaveBeenCalledWith('swoosh.wav', { loop: false });
	});

	it('loops the transition sound when soundLoop is set', () => {
		const deps = createMockDeps({
			slides: [
				createMockSlide(),
				createMockSlide({
					transition: {
						type: 'fade',
						durationMs: 300,
						soundPath: 'swoosh.wav',
						soundLoop: true,
					} as PptxSlide['transition'],
				}),
			],
		});
		executeSlideTransition(1, deps);
		expect(deps.onPlayActionSound).toHaveBeenCalledWith('swoosh.wav', { loop: true });
	});

	it('does not play sound when the incoming transition has none', () => {
		const deps = createMockDeps();
		executeSlideTransition(1, deps);
		expect(deps.onPlayActionSound).not.toHaveBeenCalled();
	});

	it('defers entrance animations until the transition duration elapses', () => {
		const deps = createMockDeps();
		executeSlideTransition(1, deps);

		// Not run synchronously: the overlay is still covering the incoming slide.
		expect(deps.runPresentationEntranceAnimations).not.toHaveBeenCalled();

		vi.advanceTimersByTime(300);
		expect(deps.runPresentationEntranceAnimations).toHaveBeenCalledWith(1);
		expect(deps.scheduleAutoAdvanceForSlide).toHaveBeenCalledWith(1);
	});

	it('pushes the deferred entrance timer to presentationTimersRef', () => {
		const deps = createMockDeps();
		executeSlideTransition(1, deps);
		expect(deps.presentationTimersRef.current).toHaveLength(1);
	});

	it('does not mount an overlay for a backward / non-forward move', () => {
		const deps = createMockDeps({ playTransition: false });
		executeSlideTransition(1, deps);
		expect(deps.setTransitionOverlay).toHaveBeenCalledWith(null);
		// Instant: entrance runs synchronously, no deferred timer.
		expect(deps.runPresentationEntranceAnimations).toHaveBeenCalledWith(1);
		expect(deps.scheduleAutoAdvanceForSlide).toHaveBeenCalledWith(1);
		expect(deps.presentationTimersRef.current).toHaveLength(0);
	});

	it('does not mount an overlay for an instant (none) transition', () => {
		const deps = createMockDeps({
			slides: [
				createMockSlide(),
				createMockSlide({ transition: { type: 'none' } as PptxSlide['transition'] }),
			],
		});
		executeSlideTransition(1, deps);
		expect(deps.setTransitionOverlay).toHaveBeenCalledWith(null);
		expect(deps.runPresentationEntranceAnimations).toHaveBeenCalledWith(1);
	});

	it('reveals the slide instantly when it has no transition at all', () => {
		const deps = createMockDeps({
			slides: [createMockSlide(), createMockSlide({ id: 'slide-2' })],
		});
		executeSlideTransition(1, deps);
		expect(deps.setTransitionOverlay).toHaveBeenCalledWith(null);
		expect(deps.runPresentationEntranceAnimations).toHaveBeenCalledWith(1);
		expect(deps.presentationTimersRef.current).toHaveLength(0);
	});
});
