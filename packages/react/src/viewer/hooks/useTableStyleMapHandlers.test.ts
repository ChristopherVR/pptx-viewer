/**
 * Does an "Edit style..." edit actually update the map the table renderer
 * reads, and does a delete get recorded for save-time removal?
 *
 * `TableStyleEditor`'s `onStyleMapChange`/`onDeleteStyle` were wired down
 * from `TablePropertiesPanel` but nothing above it ever supplied them, so
 * this hook is the first place a real setter call happens.
 */
import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { useTableStyleMapHandlers } from './useTableStyleMapHandlers';

function mapWith(...ids: string[]): ParsedTableStyleMap {
	const map: ParsedTableStyleMap = {};
	for (const id of ids) {
		map[id] = { styleId: id, styleName: id };
	}
	return map;
}

describe('useTableStyleMapHandlers', () => {
	it('handleTableStyleMapChange replaces the map the renderer reads', () => {
		const setTableStyleMap = vi.fn();
		const setTableStylesToDelete = vi.fn();
		const { handleTableStyleMapChange } = useTableStyleMapHandlers({
			tableStyleMap: mapWith('a'),
			setTableStyleMap,
			tableStylesToDelete: [],
			setTableStylesToDelete,
		});

		const nextMap = mapWith('a', 'b');
		handleTableStyleMapChange(nextMap);

		expect(setTableStyleMap).toHaveBeenCalledWith(nextMap);
		expect(setTableStylesToDelete).toHaveBeenCalledWith([]);
	});

	it('handleTableStyleMapChange drops a pending delete when the id reappears', () => {
		const setTableStyleMap = vi.fn();
		const setTableStylesToDelete = vi.fn();
		const { handleTableStyleMapChange } = useTableStyleMapHandlers({
			tableStyleMap: mapWith('a'),
			setTableStyleMap,
			tableStylesToDelete: ['b'],
			setTableStylesToDelete,
		});

		handleTableStyleMapChange(mapWith('a', 'b'));

		expect(setTableStylesToDelete).toHaveBeenCalledWith([]);
	});

	it('handleDeleteTableStyle removes the entry and records the id for save-time deletion', () => {
		const setTableStyleMap = vi.fn();
		const setTableStylesToDelete = vi.fn();
		const { handleDeleteTableStyle } = useTableStyleMapHandlers({
			tableStyleMap: mapWith('a', 'b'),
			setTableStyleMap,
			tableStylesToDelete: [],
			setTableStylesToDelete,
		});

		handleDeleteTableStyle('a');

		expect(setTableStyleMap).toHaveBeenCalledWith(mapWith('b'));
		expect(setTableStylesToDelete).toHaveBeenCalledWith(['a']);
	});
});
