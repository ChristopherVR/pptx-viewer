import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import type { ViewerState } from '../state';
import { createCustomShowRunner } from './presentation-custom-show-runner';

function slides(count: number): PptxSlide[] {
	return Array.from(
		{ length: count },
		(_v, index) =>
			({
				id: `s${String(index + 1)}`,
				rId: `rId${String(index + 1)}`,
				slideNumber: index + 1,
				elements: [],
			}) as PptxSlide,
	);
}

function harness(overrides: Partial<ViewerState> = {}) {
	const store = createStore<ViewerState>({
		...createInitialViewerState(),
		presenting: true,
		slides: slides(5),
		currentSlide: 0,
		customShows: [
			{ id: 'sh1', name: 'Highlights', slideRIds: ['rId2', 'rId3'] },
			{ id: 'sh2', name: 'Deep dive', slideRIds: ['rId4'] },
		],
		...overrides,
	});
	const goToSlide = vi.fn((index: number) => store.set({ currentSlide: index }));
	const runner = createCustomShowRunner(store, goToSlide);
	return { store, goToSlide, runner };
}

describe('vanilla custom-show action runner (B7)', () => {
	it('switches the active show and jumps to its first slide', () => {
		const { store, runner } = harness();
		runner.customShow('sh1', false);
		expect(store.get().activeCustomShowId).toBe('sh1');
		// sh1 = ['rId2', 'rId3'] -> deck indexes [1, 2]; first is 1.
		expect(store.get().currentSlide).toBe(1);
	});

	it('is a no-op for an unknown custom show id', () => {
		const { store, runner } = harness();
		runner.customShow('missing', false);
		expect(store.get().activeCustomShowId).toBeNull();
		expect(store.get().currentSlide).toBe(0);
	});

	it('returns to the origin slide (and restores the previous show) when the sub-show ends', () => {
		const { store, runner } = harness({ currentSlide: 3, activeCustomShowId: null });

		runner.customShow('sh2', true);
		// sh2 = ['rId4'] -> deck index 3; already there, but the show is now active.
		expect(store.get().activeCustomShowId).toBe('sh2');
		expect(store.get().currentSlide).toBe(3);

		// The sub-show runs off its own end (viewer-controls.next() raising the
		// black end screen), which this module must intercept and reverse.
		store.set({ endOfShow: true });

		expect(store.get().endOfShow).toBeFalsy();
		expect(store.get().activeCustomShowId).toBeNull();
		expect(store.get().currentSlide).toBe(3);
	});

	it('does not intercept endOfShow when returnAfter was not requested', () => {
		const { store, runner } = harness();
		runner.customShow('sh1', false);

		store.set({ endOfShow: true });

		expect(store.get().endOfShow).toBeTruthy();
	});

	it('drops a pending return once the presenter leaves the show', () => {
		const { store, runner } = harness();
		runner.customShow('sh1', true);

		store.set({ presenting: false });
		store.set({ presenting: true, endOfShow: true });

		// The stale pending return must not fire a jump/restore after re-entering.
		expect(store.get().endOfShow).toBeTruthy();
	});

	it('dispose() stops the end-of-show watcher', () => {
		const { store, runner } = harness();
		runner.customShow('sh1', true);
		runner.dispose();

		store.set({ endOfShow: true });

		expect(store.get().endOfShow).toBeTruthy();
	});
});
