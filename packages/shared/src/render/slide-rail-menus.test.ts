import { describe, expect, it } from 'vitest';

import {
	buildSectionContextMenuEntries,
	sectionAddAfterSlideIndex,
	sectionContextMenuLabelKey,
} from './section-context-menu';
import {
	buildSlideSorterContextMenuEntries,
	SLIDE_RAIL_FOOTER_ACTIONS,
	slideSorterContextMenuLabel,
	slideSorterPasteIndexes,
} from './slide-sorter-context-menu';

describe('section context menu', () => {
	it('lists rename, delete, move up, move down and add after, with separators', () => {
		const entries = buildSectionContextMenuEntries({ sectionIndex: 1, totalSections: 3 });
		expect(entries.map((entry) => entry.id)).toStrictEqual([
			'rename',
			'delete',
			'move-up',
			'move-down',
			'add-after',
		]);
		expect(entries.filter((entry) => entry.separatorBefore).map((entry) => entry.id)).toStrictEqual(
			['move-up', 'add-after'],
		);
		expect(entries.every((entry) => !entry.disabled)).toBeTruthy();
	});

	it('disables Move Up on the first section and Move Down on the last', () => {
		const first = buildSectionContextMenuEntries({ sectionIndex: 0, totalSections: 2 });
		expect(first.find((entry) => entry.id === 'move-up')?.disabled).toBeTruthy();
		expect(first.find((entry) => entry.id === 'move-down')?.disabled).toBeFalsy();
		const last = buildSectionContextMenuEntries({ sectionIndex: 1, totalSections: 2 });
		expect(last.find((entry) => entry.id === 'move-down')?.disabled).toBeTruthy();
	});

	it('uses only the pptx.sections.* key namespace', () => {
		for (const id of ['rename', 'delete', 'move-up', 'move-down', 'add-after'] as const) {
			expect(sectionContextMenuLabelKey(id)).toMatch(/^pptx\.sections\./u);
		}
	});

	it('adds a section after the last slide of the section, clamped to the deck', () => {
		expect(sectionAddAfterSlideIndex(2, 10)).toBe(3);
		expect(sectionAddAfterSlideIndex(9, 10)).toBe(9);
		expect(sectionAddAfterSlideIndex(undefined, 1)).toBe(0);
	});
});

describe('slide sorter context menu', () => {
	const base = {
		selectedCount: 1,
		hasClipboard: false,
		hasHiddenInSelection: false,
		hasVisibleInSelection: true,
		wouldDeleteAllSlides: false,
	};

	it('offers Copy, Duplicate, Hide and Delete, and Paste only with a clipboard', () => {
		expect(buildSlideSorterContextMenuEntries(base).map((entry) => entry.id)).toStrictEqual([
			'copy',
			'duplicate',
			'toggle-hidden',
			'delete',
		]);
		expect(
			buildSlideSorterContextMenuEntries({ ...base, hasClipboard: true }).map((entry) => entry.id),
		).toStrictEqual(['copy', 'paste', 'duplicate', 'toggle-hidden', 'delete']);
	});

	it('toggles Hide and Show on the selection state and disables deleting every slide', () => {
		const hide = buildSlideSorterContextMenuEntries(base).find((e) => e.id === 'toggle-hidden');
		expect(hide?.labelKey).toBe('pptx.slideSorter.contextMenu.hideSlides');
		const show = buildSlideSorterContextMenuEntries({
			...base,
			hasHiddenInSelection: true,
			hasVisibleInSelection: false,
		}).find((e) => e.id === 'toggle-hidden');
		expect(show?.labelKey).toBe('pptx.slideSorter.contextMenu.showSlides');
		const mixed = buildSlideSorterContextMenuEntries({ ...base, hasHiddenInSelection: true }).find(
			(e) => e.id === 'toggle-hidden',
		);
		expect(mixed?.labelKey).toBe('pptx.slideSorter.contextMenu.hideSlides');
		const del = buildSlideSorterContextMenuEntries({ ...base, wouldDeleteAllSlides: true }).find(
			(e) => e.id === 'delete',
		);
		expect(del?.disabled).toBeTruthy();
	});

	it('appends the selection count to the label only for a multi-selection', () => {
		const copy = { countSuffix: true };
		expect(slideSorterContextMenuLabel('Copy', copy, 1)).toBe('Copy');
		expect(slideSorterContextMenuLabel('Copy', copy, 3)).toBe('Copy (3)');
		expect(slideSorterContextMenuLabel('Paste', { countSuffix: false }, 3)).toBe('Paste');
	});

	it('resolves the paste positions from slide ids and skips deleted slides', () => {
		const slides = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
		expect(slideSorterPasteIndexes(['c', 'a', 'gone'], slides)).toStrictEqual([0, 2]);
		expect(slideSorterPasteIndexes([], slides)).toStrictEqual([]);
	});
});

describe('slide rail actions', () => {
	it('exposes Add Slide as the only persistent action', () => {
		expect(SLIDE_RAIL_FOOTER_ACTIONS.map((action) => action.id)).toStrictEqual(['add-slide']);
		expect(SLIDE_RAIL_FOOTER_ACTIONS[0].labelKey).toBe('pptx.sections.addSlide');
	});
});
