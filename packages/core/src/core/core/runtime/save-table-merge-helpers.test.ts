import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import {
	serializeCellMergeAttributes,
	serializeTablePropertyFlags,
	replaceFirstTextValueInTree,
	buildChartPoints,
} from './save-table-merge-helpers';
import { writeTableColumnWidths } from './table-column-width-save';

describe('writeTableColumnWidths', () => {
	it('updates only widths while retaining column identities, extensions and cells', () => {
		const columns = [
			{ '@_w': '100', 'a:extLst': { 'a:ext': { 'a16:colId': { '@_val': '7' } } } },
			{ '@_w': '100', 'a:extLst': { 'a:ext': { '@_uri': 'custom', 'custom:data': 'keep' } } },
		];
		const tbl: XmlObject = {
			'a:tblGrid': { 'a:gridCol': columns },
			'a:tr': { 'a:tc': 'untouched' },
		};
		const expected = structuredClone(tbl);
		expected['a:tblGrid']['a:gridCol'][0]['@_w'] = '50';
		expected['a:tblGrid']['a:gridCol'][1]['@_w'] = '150';
		const proportions = [0.25, 0.75];
		writeTableColumnWidths(tbl, proportions);
		expect(tbl).toStrictEqual(expected);
		expect(tbl['a:tblGrid']['a:gridCol']).toBe(columns);
		expect(proportions).toStrictEqual([0.25, 0.75]);
	});

	it('retains the integer grid total through fractional edits and repeated writes', () => {
		const columns = [3, 3, 4].map((width) => ({ '@_w': String(width) }));
		const tbl: XmlObject = { 'a:tblGrid': { 'a:gridCol': columns } };
		for (let save = 0; save < 3; save++) {
			writeTableColumnWidths(tbl, [1 / 3, 1 / 3, 1 / 3]);
			expect(columns.map((column) => Number(column['@_w']))).toStrictEqual([3, 4, 3]);
		}
		writeTableColumnWidths(tbl, [0, 0.5, 0.5]);
		expect(columns.map((column) => column['@_w'])).toStrictEqual(['0', '5', '5']);
	});

	it('keeps a singleton column and unchanged authored widths byte-stable', () => {
		const tbl: XmlObject = { 'a:tblGrid': { 'a:gridCol': { '@_w': '00100', 'a:extLst': '' } } };
		const original = structuredClone(tbl);
		writeTableColumnWidths(tbl, [1]);
		expect(tbl).toStrictEqual(original);
	});

	it('keeps unchanged uneven multi-column EMUs and lexical widths', () => {
		const widths = ['00101', '203', '0307'];
		const tbl: XmlObject = {
			'a:tblGrid': { 'a:gridCol': widths.map((width) => ({ '@_w': width })) },
		};
		const original = structuredClone(tbl);
		writeTableColumnWidths(tbl, [101 / 611, 203 / 611, 307 / 611]);
		expect(tbl).toStrictEqual(original);
	});

	it('does not make a trailing zero width negative from floating-point sum error', () => {
		const columns = [Number.MAX_SAFE_INTEGER, 0].map((width) => ({ '@_w': String(width) }));
		const tbl: XmlObject = { 'a:tblGrid': { 'a:gridCol': columns } };
		const original = structuredClone(tbl);
		writeTableColumnWidths(tbl, [1 + Number.EPSILON, 0]);
		expect(tbl).toStrictEqual(original);
	});

	it.each([
		{ source: ['100', '100'], ratios: [NaN, 0.5] },
		{ source: ['100', '100'], ratios: [Infinity, 0] },
		{ source: ['100', '100'], ratios: [-0.25, 1.25] },
		{ source: ['100', '100'], ratios: [0, 0] },
		{ source: ['100', '100'], ratios: [1, 3] },
		{ source: ['100', '100'], ratios: [1] },
		{ source: ['bad', '100'], ratios: [0.25, 0.75] },
		{ source: ['', '100'], ratios: [0.25, 0.75] },
		{ source: ['Infinity', '100'], ratios: [0.25, 0.75] },
		{ source: ['-1', '100'], ratios: [0.25, 0.75] },
		{ source: ['0', '0'], ratios: [0.25, 0.75] },
		{ source: [], ratios: [] },
	])('leaves an invalid grid or proportions unchanged: $source / $ratios', ({ source, ratios }) => {
		const tbl: XmlObject = {
			'a:tblGrid': { 'a:gridCol': source.map((width) => ({ '@_w': width })) },
		};
		const original = structuredClone(tbl);
		writeTableColumnWidths(tbl, ratios);
		expect(tbl).toStrictEqual(original);
	});
});

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

	it('omits false/undefined flag attributes to match PowerPoint output', () => {
		// PowerPoint's "Insert > Table" UI only writes the flag attribute
		// when the flag is true (all of these default to `false` per
		// CT_TableProperties). We previously emitted `="0"` which is
		// behaviourally identical but adds noise and doesn't match what
		// PowerPoint produces.
		const tbl: XmlObject = {};
		serializeTablePropertyFlags(tbl, {});
		const tblPr = tbl['a:tblPr'] as XmlObject;
		expect(tblPr['@_bandRow']).toBeUndefined();
		expect(tblPr['@_bandCol']).toBeUndefined();
		expect(tblPr['@_firstRow']).toBeUndefined();
		expect(tblPr['@_lastRow']).toBeUndefined();
		expect(tblPr['@_firstCol']).toBeUndefined();
		expect(tblPr['@_lastCol']).toBeUndefined();
	});

	it('does NOT inject a default tableStyleId when the model has none (W1-D)', () => {
		// A loaded table with no <a:tableStyleId> ("No Style, No Grid") must
		// round-trip without one. The default style is a CREATION-time
		// decision (table-style-defaults.ts), never a save-time one.
		const tbl: XmlObject = {};
		serializeTablePropertyFlags(tbl, {});
		const tblPr = tbl['a:tblPr'] as XmlObject;
		expect(tblPr['a:tableStyleId']).toBeUndefined();
	});

	it('preserves an existing tableStyleId when the model leaves it undefined', () => {
		const tbl: XmlObject = { 'a:tblPr': { 'a:tableStyleId': '{EXISTING}' } };
		serializeTablePropertyFlags(tbl, { bandedRows: true });
		const tblPr = tbl['a:tblPr'] as XmlObject;
		expect(tblPr['a:tableStyleId']).toBe('{EXISTING}');
	});

	it('respects a caller-supplied tableStyleId', () => {
		const tbl: XmlObject = {};
		serializeTablePropertyFlags(tbl, { tableStyleId: '{AABB-CCDD}' });
		const tblPr = tbl['a:tblPr'] as XmlObject;
		expect(tblPr['a:tableStyleId']).toBe('{AABB-CCDD}');
	});

	it('removes the tableStyleId when the model explicitly clears it', () => {
		const tbl: XmlObject = { 'a:tblPr': { 'a:tableStyleId': '{EXISTING}' } };
		serializeTablePropertyFlags(tbl, { tableStyleId: '' });
		const tblPr = tbl['a:tblPr'] as XmlObject;
		expect(tblPr['a:tableStyleId']).toBeUndefined();
	});

	it('tolerates an empty <a:tblPr/> that parsed as the empty string', () => {
		// fast-xml-parser yields '' for `<a:tblPr></a:tblPr>`; writing flags
		// onto that string used to throw and abort the table serialisation.
		const tbl: XmlObject = { 'a:tblPr': '' };
		serializeTablePropertyFlags(tbl, { bandedRows: true });
		const tblPr = tbl['a:tblPr'] as XmlObject;
		expect(tblPr).toBeTypeOf('object');
		expect(tblPr['@_bandRow']).toBe('1');
		expect(tblPr['a:tableStyleId']).toBeUndefined();
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
		expect(replaced).toBeTruthy();
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
		expect(replaced).toBeTruthy();
		expect((node['a:p'] as Record<string, Record<string, string>>)['a:r']['a:t']).toBe('Replaced');
	});

	it('should return false when no match is found', () => {
		const node = { 'a:r': { '@_lang': 'en' } };
		const replaced = replaceFirstTextValueInTree(node, 't', 'X', getLocalName);
		expect(replaced).toBeFalsy();
	});

	it('should search through arrays', () => {
		const node = [{ 'a:x': 'skip' }, { 'a:t': 'Found' }];
		const replaced = replaceFirstTextValueInTree(node, 't', 'New', getLocalName);
		expect(replaced).toBeTruthy();
		expect((node[1] as Record<string, string>)['a:t']).toBe('New');
	});

	it('should handle null/undefined gracefully', () => {
		expect(replaceFirstTextValueInTree(null, 't', 'X', getLocalName)).toBeFalsy();
		expect(replaceFirstTextValueInTree(undefined, 't', 'X', getLocalName)).toBeFalsy();
	});

	it('should only replace string/number values, not object values', () => {
		const node = { 'a:t': { nested: 'value' } };
		const replaced = replaceFirstTextValueInTree(node, 't', 'X', getLocalName);
		// The key matches but the value is an object, so it should recurse into it
		// and look for 't' inside the nested object instead.
		expect(replaced).toBeFalsy();
	});
});

describe('buildChartPoints', () => {
	it('should build indexed point array from values', () => {
		const points = buildChartPoints(['10', '20', '30']);
		expect(points).toStrictEqual([
			{ '@_idx': '0', 'c:v': '10' },
			{ '@_idx': '1', 'c:v': '20' },
			{ '@_idx': '2', 'c:v': '30' },
		]);
	});

	it('should return empty array for empty input', () => {
		expect(buildChartPoints([])).toStrictEqual([]);
	});
});
