import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { ThumbnailRailMenu } from './thumbnail-rail-menu.svelte';

const IDS = ['s1', 's2', 's3', 's4'];

function slide(id: string, hidden = false): PptxSlide {
	return { id, slideNumber: 1, elements: [], hidden } as unknown as PptxSlide;
}

function click(
	menu: ThumbnailRailMenu,
	id: string,
	mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {},
) {
	menu.onClick({ ctrlKey: false, metaKey: false, shiftKey: false, ...mods }, id, IDS);
}

describe('thumbnailRailMenu multi-select', () => {
	it('starts with no selection', () => {
		expect(new ThumbnailRailMenu().selectedIds).toStrictEqual([]);
	});

	it('a plain click selects just that slide', () => {
		const menu = new ThumbnailRailMenu();
		click(menu, 's2');
		expect(menu.selectedIds).toStrictEqual(['s2']);
		expect(menu.isSelected('s2')).toBeTruthy();
	});

	it('ctrl-click adds to the selection', () => {
		const menu = new ThumbnailRailMenu();
		click(menu, 's1');
		click(menu, 's3', { ctrlKey: true });
		expect(menu.selectedIds).toStrictEqual(['s1', 's3']);
	});

	it('shift-click selects the contiguous range', () => {
		const menu = new ThumbnailRailMenu();
		click(menu, 's1');
		click(menu, 's4', { shiftKey: true });
		expect(menu.selectedIds).toStrictEqual(['s1', 's2', 's3', 's4']);
	});
});

describe('thumbnailRailMenu context menu', () => {
	it('right-clicking a slide already selected targets the whole selection', () => {
		const menu = new ThumbnailRailMenu();
		click(menu, 's1');
		click(menu, 's3', { shiftKey: true });
		menu.openContextMenu(10, 20, 1, IDS);
		expect(menu.contextMenu).toStrictEqual({ x: 10, y: 20, index: 1, selectedIndexes: [0, 1, 2] });
	});

	it('right-clicking a slide OUTSIDE the selection targets just that one', () => {
		const menu = new ThumbnailRailMenu();
		click(menu, 's1');
		menu.openContextMenu(0, 0, 3, IDS);
		expect(menu.contextMenu?.selectedIndexes).toStrictEqual([3]);
	});

	it('offers the shared six-command set', () => {
		const menu = new ThumbnailRailMenu();
		menu.openContextMenu(0, 0, 0, IDS);
		const entries = menu.menuEntries([slide('s1'), slide('s2'), slide('s3'), slide('s4')]);
		expect(entries.map((e) => e.id)).toStrictEqual([
			'new-slide',
			'duplicate',
			'delete',
			'layout',
			'hide',
			'add-section',
		]);
	});

	it('run routes the command to the matching action and closes', () => {
		const menu = new ThumbnailRailMenu();
		menu.openContextMenu(5, 6, 2, IDS);
		const openLayoutForSlide = vi.fn();
		menu.run('layout', { openLayoutForSlide });
		expect(openLayoutForSlide).toHaveBeenCalledWith(2, 5, 6);
		expect(menu.contextMenu).toBeNull();
	});
});
