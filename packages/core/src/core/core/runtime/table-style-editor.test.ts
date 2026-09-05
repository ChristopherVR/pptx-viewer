import { describe, expect, it } from 'vitest';

import type { ParsedTableStyleEntry, ParsedTableStyleMap } from '../../types';
import {
	addTableStyleToMap,
	createTableStyleEntry,
	deleteTableStyleFromMap,
	generateTableStyleGuid,
} from './table-style-editor';

describe('generateTableStyleGuid', () => {
	it('produces a braced, uppercase GUID', () => {
		const guid = generateTableStyleGuid();
		expect(guid).toMatch(/^\{[0-9A-F-]{36}\}$/);
	});

	it('never returns an id already present in existingIds', () => {
		const existing = new Set([generateTableStyleGuid()]);
		const next = generateTableStyleGuid(existing);
		expect(existing.has(next)).toBeFalsy();
	});

	it('generates distinct ids across repeated calls', () => {
		const ids = new Set(Array.from({ length: 20 }, () => generateTableStyleGuid()));
		expect(ids.size).toBe(20);
	});
});

describe('createTableStyleEntry', () => {
	it('creates a blank entry with a fresh id and the given name', () => {
		const entry = createTableStyleEntry({}, { styleName: 'My Style' });
		expect(entry.styleId).toMatch(/^\{[0-9A-F-]{36}\}$/);
		expect(entry.styleName).toBe('My Style');
		expect(entry.wholeTblFill).toBeUndefined();
	});

	it('uses an explicit styleId when given, normalised', () => {
		const entry = createTableStyleEntry({}, { styleName: 'X', styleId: 'abc-123' });
		expect(entry.styleId).toBe('{ABC-123}');
	});

	it('avoids colliding with an id already in the map', () => {
		const taken = createTableStyleEntry({}, { styleName: 'A' });
		const map: ParsedTableStyleMap = { [taken.styleId]: taken };
		const second = createTableStyleEntry(map, { styleName: 'B' });
		expect(second.styleId).not.toBe(taken.styleId);
	});

	it('deep-clones every section from basedOn with a fresh id and new name', () => {
		const basedOn: ParsedTableStyleEntry = {
			styleId: '{ORIGINAL}',
			styleName: 'Original',
			wholeTblFill: { schemeColor: 'accent1' },
			firstRowText: { bold: true },
			wholeTblBorders: { left: { width: 1, fill: { schemeColor: 'tx1' } } },
		};
		const entry = createTableStyleEntry({}, { styleName: 'Clone', basedOn });

		expect(entry.styleId).not.toBe('{ORIGINAL}');
		expect(entry.styleName).toBe('Clone');
		expect(entry.wholeTblFill).toStrictEqual({ schemeColor: 'accent1' });
		expect(entry.firstRowText).toStrictEqual({ bold: true });
		expect(entry.wholeTblBorders?.left).toStrictEqual({ width: 1, fill: { schemeColor: 'tx1' } });

		// Mutating the clone must not affect the source (deep clone, not a reference).
		entry.wholeTblFill!.schemeColor = 'accent2';
		expect(basedOn.wholeTblFill?.schemeColor).toBe('accent1');
	});
});

describe('addTableStyleToMap / deleteTableStyleFromMap', () => {
	it('adds a style keyed by its normalised styleId', () => {
		const map: ParsedTableStyleMap = {};
		const entry: ParsedTableStyleEntry = { styleId: 'abc', styleName: 'X' };
		addTableStyleToMap(map, entry);
		expect(map['{ABC}']).toBe(entry);
	});

	it('deletes an existing style and reports true', () => {
		const map: ParsedTableStyleMap = { '{ABC}': { styleId: '{ABC}' } };
		expect(deleteTableStyleFromMap(map, 'abc')).toBeTruthy();
		expect(map['{ABC}']).toBeUndefined();
	});

	it('reports false when the style is not present', () => {
		const map: ParsedTableStyleMap = {};
		expect(deleteTableStyleFromMap(map, '{NOPE}')).toBeFalsy();
	});
});
