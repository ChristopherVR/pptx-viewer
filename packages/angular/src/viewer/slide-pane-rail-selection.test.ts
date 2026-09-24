/**
 * Ctrl/Shift multi-select and the thumbnail context menu's open/target state.
 *
 * All pure: this package has no TestBed (see `vitest.config.ts`), and
 * `signal()` needs none.
 */
import { describe, expect, it } from 'vitest';

import { SlidePaneRailSelection } from './slide-pane-rail-selection';

const IDS = ['s1', 's2', 's3', 's4'];

function click(
	sel: SlidePaneRailSelection,
	id: string,
	mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {},
) {
	sel.onClick({ ctrlKey: false, metaKey: false, shiftKey: false, ...mods }, id, IDS);
}

describe('slidePaneRailSelection multi-select', () => {
	it('starts with no selection', () => {
		expect(new SlidePaneRailSelection().selectedIds()).toStrictEqual([]);
	});

	it('a plain click selects just that slide', () => {
		const sel = new SlidePaneRailSelection();
		click(sel, 's2');
		expect(sel.selectedIds()).toStrictEqual(['s2']);
		expect(sel.isSelected('s2')).toBeTruthy();
	});

	it('ctrl-click adds to the selection', () => {
		const sel = new SlidePaneRailSelection();
		click(sel, 's1');
		click(sel, 's3', { ctrlKey: true });
		expect(sel.selectedIds()).toStrictEqual(['s1', 's3']);
	});

	it('shift-click selects the contiguous range', () => {
		const sel = new SlidePaneRailSelection();
		click(sel, 's1');
		click(sel, 's4', { shiftKey: true });
		expect(sel.selectedIds()).toStrictEqual(['s1', 's2', 's3', 's4']);
	});
});

describe('slidePaneRailSelection context menu', () => {
	it('right-clicking a slide already selected targets the whole selection', () => {
		const sel = new SlidePaneRailSelection();
		click(sel, 's1');
		click(sel, 's3', { shiftKey: true });
		sel.openContextMenu(10, 20, 1, IDS);
		expect(sel.contextMenu()).toStrictEqual({ x: 10, y: 20, index: 1, selectedIndexes: [0, 1, 2] });
	});

	it('right-clicking a slide OUTSIDE the selection targets just that one', () => {
		const sel = new SlidePaneRailSelection();
		click(sel, 's1');
		sel.openContextMenu(0, 0, 3, IDS);
		expect(sel.contextMenu()?.selectedIndexes).toStrictEqual([3]);
	});

	it('closeContextMenu clears the menu', () => {
		const sel = new SlidePaneRailSelection();
		sel.openContextMenu(0, 0, 0, IDS);
		sel.closeContextMenu();
		expect(sel.contextMenu()).toBeNull();
	});
});
