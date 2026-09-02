import type { PptxCustomShow, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref, shallowRef } from 'vue';

import { usePresentationControls } from './usePresentationControls';

function deck(count: number): PptxSlide[] {
	return Array.from(
		{ length: count },
		(_, index) =>
			({
				id: `s${index + 1}`,
				rId: `rId${index + 1}`,
				slideNumber: index + 1,
				elements: [],
			}) as PptxSlide,
	);
}

/**
 * usePresentationControls: entering the show resolves the deck index it
 * OPENS on (wave-4 B1), not just whether it is running.
 *
 * Before this fix every entry point (including "From Beginning") started on
 * the raw active slide, so a deck authored with `p:showPr/p:sldRg` (or a
 * hidden active slide) opened on a slide the show does not include.
 */
describe('usePresentationControls: presentation entry slide', () => {
	it('startPresenting opens on the active slide when the show includes it', () => {
		const activeSlideIndex = ref(1);
		const controls = usePresentationControls({
			slides: shallowRef(deck(4)),
			activeSlideIndex,
			customShows: shallowRef<PptxCustomShow[]>([]),
			activeCustomShowId: () => null,
			pushHistory: () => {},
		});
		controls.startPresenting();
		expect(controls.presenting.value).toBeTruthy();
		expect(controls.presentationStartIndex.value).toBe(1);
	});

	it("startPresenting escapes to the range's first slide when the active slide is outside an authored range", () => {
		const activeSlideIndex = ref(0);
		const controls = usePresentationControls({
			slides: shallowRef(deck(4)),
			activeSlideIndex,
			customShows: shallowRef<PptxCustomShow[]>([]),
			activeCustomShowId: () => null,
			authoredRange: () => ({ fromIndex: 1, toIndex: 2 }),
			pushHistory: () => {},
		});
		controls.startPresenting();
		expect(controls.presentationStartIndex.value).toBe(1);
	});

	it("presentFromBeginning always opens on the show's first slide, ignoring the active slide", () => {
		const activeSlideIndex = ref(2);
		const controls = usePresentationControls({
			slides: shallowRef(deck(4)),
			activeSlideIndex,
			customShows: shallowRef<PptxCustomShow[]>([]),
			activeCustomShowId: () => null,
			authoredRange: () => ({ fromIndex: 1, toIndex: 3 }),
			pushHistory: () => {},
		});
		controls.presentFromBeginning();
		expect(controls.presentationStartIndex.value).toBe(1);
	});
});
