/**
 * Does an "Edit style..." edit actually update the map the table renderer
 * reads (`deck.tableStyleMap`), and does a delete get recorded for save-time
 * removal?
 */
import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';

import { useTableStyleMapHandlers } from './useTableStyleMapHandlers';

function mapWith(...ids: string[]): ParsedTableStyleMap {
	const map: ParsedTableStyleMap = {};
	for (const id of ids) {
		map[id] = { styleId: id, styleName: id };
	}
	return map;
}

describe('useTableStyleMapHandlers', () => {
	it('onTableStyleMapChange replaces the map the renderer reads and marks the deck dirty', () => {
		const tableStyleMap = shallowRef<ParsedTableStyleMap | undefined>(mapWith('a'));
		const tableStylesToDelete = shallowRef<string[]>([]);
		const markDirty = vi.fn();
		const { onTableStyleMapChange } = useTableStyleMapHandlers({
			tableStyleMap,
			tableStylesToDelete,
			markDirty,
		});

		const nextMap = mapWith('a', 'b');
		onTableStyleMapChange(nextMap);

		expect(tableStyleMap.value).toStrictEqual(nextMap);
		expect(tableStylesToDelete.value).toStrictEqual([]);
		expect(markDirty).toHaveBeenCalledOnce();
	});

	it('onTableStyleMapChange drops a pending delete when the id reappears', () => {
		const tableStyleMap = shallowRef<ParsedTableStyleMap | undefined>(mapWith('a'));
		const tableStylesToDelete = shallowRef<string[]>(['b']);
		const { onTableStyleMapChange } = useTableStyleMapHandlers({
			tableStyleMap,
			tableStylesToDelete,
			markDirty: () => {},
		});

		onTableStyleMapChange(mapWith('a', 'b'));

		expect(tableStylesToDelete.value).toStrictEqual([]);
	});

	it('onDeleteTableStyle removes the entry and records the id for save-time deletion', () => {
		const tableStyleMap = shallowRef<ParsedTableStyleMap | undefined>(mapWith('a', 'b'));
		const tableStylesToDelete = shallowRef<string[]>([]);
		const markDirty = vi.fn();
		const { onDeleteTableStyle } = useTableStyleMapHandlers({
			tableStyleMap,
			tableStylesToDelete,
			markDirty,
		});

		onDeleteTableStyle('a');

		expect(tableStyleMap.value).toStrictEqual(mapWith('b'));
		expect(tableStylesToDelete.value).toStrictEqual(['a']);
		expect(markDirty).toHaveBeenCalledOnce();
	});
});
