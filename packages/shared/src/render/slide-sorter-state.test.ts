import { describe, expect, it } from 'vitest';

import {
	applySorterAction,
	createSlideSorterState,
	selectSorterSlide,
	sorterMenuContext,
	sorterSelectionIndexes,
} from './slide-sorter-state';

const slides = [{ id: 'a' }, { id: 'b', hidden: true }, { id: 'c' }, { id: 'd' }];
describe('sorter state', () => {
	it('keeps an anchor for ranges, toggles ids, and preserves a right-clicked selection', () => {
		let state = createSlideSorterState(slides, 1);
		state = selectSorterSlide(state, slides, 3, { shiftKey: true });
		expect(sorterSelectionIndexes(state, slides)).toStrictEqual([1, 2, 3]);
		expect(selectSorterSlide(state, slides, 2, {}, true)).toBe(state);
		state = selectSorterSlide(state, slides, 2, { metaKey: true });
		expect(state.selectedIds).toStrictEqual(['b', 'd']);
	});

	it('resolves clipboard ids after reorder and skips deleted sources', () => {
		let state = selectSorterSlide(createSlideSorterState(slides, 0), slides, 2, { ctrlKey: true });
		state = applySorterAction(state, slides, 'copy', 0).state;
		expect(
			applySorterAction(state, [slides[2], slides[1], slides[0]], 'paste', 0).indexes,
		).toStrictEqual([2, 0]);
		expect(applySorterAction(state, [slides[1]], 'paste', 0).indexes).toStrictEqual([]);
	});

	it('protects the last slide, collapses Escape and clamps zoom', () => {
		const state = applySorterAction(
			createSlideSorterState(slides, 0),
			slides,
			'selectAll',
			0,
		).state;
		expect(sorterMenuContext(state, slides).wouldDeleteAllSlides).toBeTruthy();
		expect(applySorterAction(state, slides, 'delete', 0).indexes).toStrictEqual([]);
		expect(
			applySorterAction(state, slides, 'collapseSelection', 2).state.selectedIds,
		).toStrictEqual(['c']);
		expect(applySorterAction({ ...state, zoom: 200 }, slides, 'zoomIn', 0).state.zoom).toBe(200);
	});
});
