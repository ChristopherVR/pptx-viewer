import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	applyTableStyleDelete,
	applyTableStyleMapChange,
	tableStyleAssignmentUpdate,
	tableStyleSaveOptions,
} from './table-style-map-edits';

function mapWith(...ids: string[]): ParsedTableStyleMap {
	const map: ParsedTableStyleMap = {};
	for (const id of ids) {
		map[id] = { styleId: id, styleName: id };
	}
	return map;
}

describe('applyTableStyleMapChange', () => {
	it('replaces the map and leaves an unrelated pending delete untouched', () => {
		const result = applyTableStyleMapChange(
			{ tableStyleMap: mapWith('a'), tableStylesToDelete: ['b'] },
			mapWith('a', 'c'),
		);
		expect(result.tableStyleMap).toStrictEqual(mapWith('a', 'c'));
		expect(result.tableStylesToDelete).toStrictEqual(['b']);
	});

	it('drops a pending delete when the id is re-added to the next map', () => {
		const result = applyTableStyleMapChange(
			{ tableStyleMap: mapWith('a'), tableStylesToDelete: ['b'] },
			mapWith('a', 'b'),
		);
		expect(result.tableStylesToDelete).toStrictEqual([]);
	});

	it('does not mutate the previous tableStylesToDelete array', () => {
		const previous = ['b'];
		applyTableStyleMapChange(
			{ tableStyleMap: mapWith('a'), tableStylesToDelete: previous },
			mapWith('a'),
		);
		expect(previous).toStrictEqual(['b']);
	});
});

describe('applyTableStyleDelete', () => {
	it('removes the entry from the map and appends the id to tableStylesToDelete', () => {
		const result = applyTableStyleDelete(
			{ tableStyleMap: mapWith('a', 'b'), tableStylesToDelete: [] },
			'a',
		);
		expect(result.tableStyleMap).toStrictEqual(mapWith('b'));
		expect(result.tableStylesToDelete).toStrictEqual(['a']);
	});

	it('is idempotent: deleting the same id twice does not duplicate it', () => {
		const result = applyTableStyleDelete(
			{ tableStyleMap: mapWith('a'), tableStylesToDelete: ['a'] },
			'a',
		);
		expect(result.tableStylesToDelete).toStrictEqual(['a']);
	});

	it('tolerates an undefined map', () => {
		const result = applyTableStyleDelete(
			{ tableStyleMap: undefined, tableStylesToDelete: [] },
			'a',
		);
		expect(result.tableStyleMap).toStrictEqual({});
		expect(result.tableStylesToDelete).toStrictEqual(['a']);
	});
});

describe('tableStyleSaveOptions', () => {
	it('omits every field when there is nothing to say', () => {
		const options = tableStyleSaveOptions({
			tableStyleMap: undefined,
			tableStylesDefaultId: undefined,
			tableStylesToDelete: [],
		});
		expect(options).toStrictEqual({});
	});

	it('includes tableStyles, tableStylesDefaultId, and tableStylesToDelete when present', () => {
		const map = mapWith('a');
		const options = tableStyleSaveOptions({
			tableStyleMap: map,
			tableStylesDefaultId: '{guid}',
			tableStylesToDelete: ['b'],
		});
		expect(options).toStrictEqual({
			tableStyles: map,
			tableStylesDefaultId: '{guid}',
			tableStylesToDelete: ['b'],
		});
	});

	it('copies tableStylesToDelete rather than aliasing the source array', () => {
		const source = ['a'];
		const options = tableStyleSaveOptions({
			tableStyleMap: undefined,
			tableStylesDefaultId: undefined,
			tableStylesToDelete: source,
		});
		expect(options.tableStylesToDelete).toStrictEqual(['a']);
		expect(options.tableStylesToDelete).not.toBe(source);
	});
});

describe('tableStyleAssignmentUpdate', () => {
	it('returns a table-data patch assigning the given style id', () => {
		expect(tableStyleAssignmentUpdate('{new-style-guid}')).toStrictEqual({
			tableStyleId: '{new-style-guid}',
		});
	});
});
