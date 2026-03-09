import { describe, it, expect } from 'vitest';
import {
	serializeCellMergeAttributes,
	serializeTablePropertyFlags,
	replaceFirstTextValueInTree,
	buildChartPoints,
} from './save-table-merge-helpers';
import type { XmlObject } from '../../types';

describe('serializeCellMergeAttributes', () => {
	it('should set gridSpan when > 1', () => {
		const xml: XmlObject = {};
		serializeCellMergeAttributes(xml, { gridSpan: 3 });
		expect(xml['@_gridSpan']).toBe('3');
	});

	it('should delete gridSpan when <= 1', () => {
		const xml: XmlObject = { '@_gridSpan': '2' };
		serializeCellMergeAttributes(xml, { gridSpan: 1 });
		expect(xml['@_gridSpan']).toBeUndefined();
	});

	it('should delete gridSpan when undefined', () => {
		const xml: XmlObject = { '@_gridSpan': '4' };
		serializeCellMergeAttributes(xml, {});
		expect(xml['@_gridSpan']).toBeUndefined();
	});

	it('should set rowSpan when > 1', () => {
		const xml: XmlObject = {};
		serializeCellMergeAttributes(xml, { rowSpan: 2 });
		expect(xml['@_rowSpan']).toBe('2');
	});

	it('should delete rowSpan when <= 1', () => {
		const xml: XmlObject = { '@_rowSpan': '3' };
		serializeCellMergeAttributes(xml, { rowSpan: 1 });
		expect(xml['@_rowSpan']).toBeUndefined();
	});

	it('should set hMerge flag when true', () => {
		const xml: XmlObject = {};
		serializeCellMergeAttributes(xml, { hMerge: true });
		expect(xml['@_hMerge']).toBe('1');
	});

	it('should delete hMerge flag when false', () => {
		const xml: XmlObject = { '@_hMerge': '1' };
		serializeCellMergeAttributes(xml, { hMerge: false });
		expect(xml['@_hMerge']).toBeUndefined();
	});

	it('should set vMerge flag when true', () => {
		const xml: XmlObject = {};
		serializeCellMergeAttributes(xml, { vMerge: true });
		expect(xml['@_vMerge']).toBe('1');
	});

	it('should delete vMerge flag when false', () => {
		const xml: XmlObject = { '@_vMerge': '1' };
		serializeCellMergeAttributes(xml, { vMerge: false });
		expect(xml['@_vMerge']).toBeUndefined();
	});

	it('should handle a complex L-shape merge origin (gridSpan + rowSpan)', () => {
		const xml: XmlObject = {};
		serializeCellMergeAttributes(xml, { gridSpan: 2, rowSpan: 3 });
		expect(xml['@_gridSpan']).toBe('2');
		expect(xml['@_rowSpan']).toBe('3');
		expect(xml['@_hMerge']).toBeUndefined();
		expect(xml['@_vMerge']).toBeUndefined();
	});

	it('should handle a continuation cell with both hMerge and vMerge', () => {
		const xml: XmlObject = {};
		serializeCellMergeAttributes(xml, { hMerge: true, vMerge: true });
		expect(xml['@_hMerge']).toBe('1');
		expect(xml['@_vMerge']).toBe('1');
		expect(xml['@_gridSpan']).toBeUndefined();
		expect(xml['@_rowSpan']).toBeUndefined();
	});

	it('should produce clean output for a non-merged cell', () => {
		const xml: XmlObject = {
			'@_gridSpan': '2',
			'@_rowSpan': '3',
			'@_hMerge': '1',
			'@_vMerge': '1',
		};
		serializeCellMergeAttributes(xml, {});
		expect(xml['@_gridSpan']).toBeUndefined();
		expect(xml['@_rowSpan']).toBeUndefined();
		expect(xml['@_hMerge']).toBeUndefined();
		expect(xml['@_vMerge']).toBeUndefined();
	});
});

describe('serializeTablePropertyFlags', () => {
	it('should write all flags as "1" when true', () => {
		const tbl: XmlObject = {};
		serializeTablePropertyFlags(tbl, {
			bandedRows: true,
			bandedColumns: true,
			firstRowHeader: true,
			lastRow: true,
			firstCol: true,
			lastCol: true,
		});
		const tblPr = tbl['a:tblPr'] as XmlObject;
		expect(tblPr['@_bandRow']).toBe('1');
		expect(tblPr['@_bandCol']).toBe('1');
		expect(tblPr['@_firstRow']).toBe('1');
		expect(tblPr['@_lastRow']).toBe('1');
		expect(tblPr['@_firstCol']).toBe('1');
		expect(tblPr['@_lastCol']).toBe('1');
	});

	it('should write all flags as "0" when false or undefined', () => {
		const tbl: XmlObject = {};
		serializeTablePropertyFlags(tbl, {});
		const tblPr = tbl['a:tblPr'] as XmlObject;
		expect(tblPr['@_bandRow']).toBe('0');
		expect(tblPr['@_bandCol']).toBe('0');
		expect(tblPr['@_firstRow']).toBe('0');
		expect(tblPr['@_lastRow']).toBe('0');
		expect(tblPr['@_firstCol']).toBe('0');
		expect(tblPr['@_lastCol']).toBe('0');
	});

	it('should preserve existing a:tblPr properties', () => {
		const tbl: XmlObject = {
			'a:tblPr': { '@_rtl': '1' },
		};
		serializeTablePropertyFlags(tbl, { bandedRows: true });
		const tblPr = tbl['a:tblPr'] as XmlObject;
		expect(tblPr['@_rtl']).toBe('1');
		expect(tblPr['@_bandRow']).toBe('1');
	});
});

describe('replaceFirstTextValueInTree', () => {
	const getLocalName = (key: string): string => {
		const idx = key.indexOf(':');
		return idx >= 0 ? key.slice(idx + 1) : key;
	};

	it('should replace the first matching text value', () => {
		const node = { 'a:t': 'Hello' };
		const replaced = replaceFirstTextValueInTree(node, 't', 'World', getLocalName);
		expect(replaced).toBe(true);
		expect(node['a:t']).toBe('World');
	});

	it('should replace nested values recursively', () => {
		const node = {
			'a:p': {
				'a:r': {
					'a:t': 'Original',
				},
			},
		};
		const replaced = replaceFirstTextValueInTree(node, 't', 'Replaced', getLocalName);
		expect(replaced).toBe(true);
		expect((node['a:p'] as any)['a:r']['a:t']).toBe('Replaced');
	});

	it('should return false when no match is found', () => {
		const node = { 'a:r': { '@_lang': 'en' } };
		const replaced = replaceFirstTextValueInTree(node, 't', 'X', getLocalName);
		expect(replaced).toBe(false);
	});

	it('should search through arrays', () => {
		const node = [
			{ 'a:x': 'skip' },
			{ 'a:t': 'Found' },
		];
		const replaced = replaceFirstTextValueInTree(node, 't', 'New', getLocalName);
		expect(replaced).toBe(true);
		expect((node[1] as any)['a:t']).toBe('New');
	});

	it('should handle null/undefined gracefully', () => {
		expect(replaceFirstTextValueInTree(null, 't', 'X', getLocalName)).toBe(false);
		expect(replaceFirstTextValueInTree(undefined, 't', 'X', getLocalName)).toBe(false);
	});

	it('should only replace string/number values, not object values', () => {
		const node = { 'a:t': { nested: 'value' } };
		const replaced = replaceFirstTextValueInTree(node, 't', 'X', getLocalName);
		// The key matches but the value is an object, so it should recurse into it
		// and look for 't' inside the nested object instead.
		expect(replaced).toBe(false);
	});
});

describe('buildChartPoints', () => {
	it('should build indexed point array from values', () => {
		const points = buildChartPoints(['10', '20', '30']);
		expect(points).toEqual([
			{ '@_idx': '0', 'c:v': '10' },
			{ '@_idx': '1', 'c:v': '20' },
			{ '@_idx': '2', 'c:v': '30' },
		]);
	});

	it('should return empty array for empty input', () => {
		expect(buildChartPoints([])).toEqual([]);
	});
});
