import { describe, expect, it } from 'vitest';

import { createThumbnailRailMenu } from './thumbnail-rail-menu';

const IDS = ['s1', 's2', 's3', 's4'];

function click(
	menu: ReturnType<typeof createThumbnailRailMenu>,
	id: string,
	mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {},
) {
	menu.onClick({ ctrlKey: false, metaKey: false, shiftKey: false, ...mods }, id, IDS);
}

describe('createThumbnailRailMenu multi-select', () => {
	it('starts with no selection', () => {
		expect(createThumbnailRailMenu().isSelected('s1')).toBeFalsy();
	});

	it('a plain click selects just that slide', () => {
		const menu = createThumbnailRailMenu();
		click(menu, 's2');
		expect(menu.isSelected('s2')).toBeTruthy();
		expect(menu.isSelected('s1')).toBeFalsy();
	});

	it('ctrl-click adds to the selection', () => {
		const menu = createThumbnailRailMenu();
		click(menu, 's1');
		click(menu, 's3', { ctrlKey: true });
		expect(menu.isSelected('s1')).toBeTruthy();
		expect(menu.isSelected('s3')).toBeTruthy();
		expect(menu.isSelected('s2')).toBeFalsy();
	});

	it('shift-click selects the contiguous range', () => {
		const menu = createThumbnailRailMenu();
		click(menu, 's1');
		click(menu, 's4', { shiftKey: true });
		for (const id of IDS) {
			expect(menu.isSelected(id)).toBeTruthy();
		}
	});
});

describe('createThumbnailRailMenu context menu target', () => {
	it('right-clicking a slide already selected targets the whole selection', () => {
		const menu = createThumbnailRailMenu();
		click(menu, 's1');
		click(menu, 's3', { shiftKey: true });
		expect(menu.openContextMenu(10, 20, 1, IDS)).toStrictEqual({
			x: 10,
			y: 20,
			index: 1,
			selectedIndexes: [0, 1, 2],
		});
	});

	it('right-clicking a slide OUTSIDE the selection targets just that one', () => {
		const menu = createThumbnailRailMenu();
		click(menu, 's1');
		expect(menu.openContextMenu(0, 0, 3, IDS)?.selectedIndexes).toStrictEqual([3]);
	});
});
