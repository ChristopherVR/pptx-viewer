import type { ParsedTableStyleMap, PptxData } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	assignTableStyle,
	createTableStyle,
	deleteTableStyle,
	setTableStyleSection,
} from '../../tools/table-style-tools.js';
import type { ToolContext } from '../../types.js';
import { makeTablePresentation } from '../helpers/create-test-pptx.js';

const STYLE_ID = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}';

function ctxWithStyle(map: ParsedTableStyleMap = {}): ToolContext {
	const pptxData: PptxData = makeTablePresentation();
	pptxData.tableStyleMap = map;
	return { pptxData };
}

describe('setTableStyleSection', () => {
	it('patches a fill onto an existing section of a loaded style', () => {
		const c = ctxWithStyle({ [STYLE_ID]: { styleId: STYLE_ID, styleName: 'Existing' } });
		const result = setTableStyleSection(c, {
			styleId: STYLE_ID,
			section: 'wholeTbl',
			fill: { schemeColor: 'accent2', tint: 40000 },
		});
		expect(result.dirty).toBeTruthy();
		expect(c.pptxData.tableStyleMap![STYLE_ID].wholeTblFill).toStrictEqual({
			schemeColor: 'accent2',
			tint: 40000,
		});
	});

	it('patches text, borders, and cell3D on a corner cell section', () => {
		const c = ctxWithStyle({ [STYLE_ID]: { styleId: STYLE_ID } });
		setTableStyleSection(c, {
			styleId: STYLE_ID,
			section: 'neCell',
			text: { bold: true },
			borders: { left: { width: 1, color: '#000000' } },
			cell3D: { material: 'metal' },
		});
		const entry = c.pptxData.tableStyleMap![STYLE_ID];
		expect(entry.neCellText).toStrictEqual({ bold: true });
		expect(entry.neCellBorders?.left).toStrictEqual({ width: 1, color: '#000000' });
		expect(entry.neCellCell3D).toStrictEqual({ material: 'metal' });
	});

	it('renames the style when styleName is given', () => {
		const c = ctxWithStyle({ [STYLE_ID]: { styleId: STYLE_ID, styleName: 'Old' } });
		setTableStyleSection(c, { styleId: STYLE_ID, section: 'wholeTbl', styleName: 'New Name' });
		expect(c.pptxData.tableStyleMap![STYLE_ID].styleName).toBe('New Name');
	});

	it('normalises a GUID without braces', () => {
		const c = ctxWithStyle({ [STYLE_ID]: { styleId: STYLE_ID } });
		const result = setTableStyleSection(c, {
			styleId: '5c22544a-7ee6-4342-b048-85bdc9fd1c3a',
			section: 'wholeTbl',
			fill: { schemeColor: 'accent1' },
		});
		expect(result.result.styleId).toBe(STYLE_ID);
		expect(c.pptxData.tableStyleMap![STYLE_ID].wholeTblFill).toBeDefined();
	});

	it('throws when the style is not loaded', () => {
		const c = ctxWithStyle();
		expect(() =>
			setTableStyleSection(c, {
				styleId: '{NOPE}',
				section: 'wholeTbl',
				fill: { schemeColor: 'accent1' },
			}),
		).toThrow('not loaded');
	});

	it('rejects an unknown section name', () => {
		const c = ctxWithStyle({ [STYLE_ID]: { styleId: STYLE_ID } });
		expect(() =>
			setTableStyleSection(c, {
				// @ts-expect-error deliberately invalid for the runtime-validation test
				section: 'notASection',
				styleId: STYLE_ID,
				fill: { schemeColor: 'accent1' },
			}),
		).toThrow('Unknown table style section');
	});
});

describe('createTableStyle', () => {
	it('creates a new style with a fresh GUID', () => {
		const c = ctxWithStyle();
		const result = createTableStyle(c, { styleName: 'My Style' });
		expect(result.dirty).toBeTruthy();
		expect(result.result.styleId).toMatch(/^\{[0-9A-F-]{36}\}$/);
		expect(c.pptxData.tableStyleMap![result.result.styleId].styleName).toBe('My Style');
		expect(result.saveOptions).toBeUndefined();
	});

	it('requests the new style as the archive default when setAsDefault is set', () => {
		const c = ctxWithStyle();
		const result = createTableStyle(c, { styleName: 'X', setAsDefault: true });
		expect(result.saveOptions?.tableStylesDefaultId).toBe(result.result.styleId);
	});

	it('clones sections from basedOnStyleId', () => {
		const c = ctxWithStyle({
			[STYLE_ID]: { styleId: STYLE_ID, wholeTblFill: { schemeColor: 'accent3' } },
		});
		const result = createTableStyle(c, { styleName: 'Clone', basedOnStyleId: STYLE_ID });
		expect(c.pptxData.tableStyleMap![result.result.styleId].wholeTblFill).toStrictEqual({
			schemeColor: 'accent3',
		});
	});

	it('throws when basedOnStyleId is not loaded', () => {
		const c = ctxWithStyle();
		expect(() => createTableStyle(c, { styleName: 'X', basedOnStyleId: '{NOPE}' })).toThrow(
			'not a loaded table style',
		);
	});
});

describe('deleteTableStyle', () => {
	it('removes the style from the map and requests archive deletion', () => {
		const c = ctxWithStyle({ [STYLE_ID]: { styleId: STYLE_ID } });
		const result = deleteTableStyle(c, { styleId: STYLE_ID });
		expect(result.dirty).toBeTruthy();
		expect(c.pptxData.tableStyleMap![STYLE_ID]).toBeUndefined();
		expect(result.saveOptions?.tableStylesToDelete).toStrictEqual([STYLE_ID]);
	});

	it('refuses to delete a style assigned to a table unless forced', () => {
		const c = ctxWithStyle({ [STYLE_ID]: { styleId: STYLE_ID } });
		c.pptxData.slides[0].elements.forEach((el) => {
			if (el.type === 'table') {
				el.tableData!.tableStyleId = STYLE_ID;
			}
		});
		expect(() => deleteTableStyle(c, { styleId: STYLE_ID })).toThrow('assigned');
		const result = deleteTableStyle(c, { styleId: STYLE_ID, force: true });
		expect(result.result.deleted).toBeTruthy();
	});
});

describe('assignTableStyle', () => {
	it('sets tableStyleId and emphasis flags on the table element', () => {
		const c = ctxWithStyle();
		const result = assignTableStyle(c, {
			slideIndex: 0,
			elementId: 'tbl-0',
			styleId: STYLE_ID,
			bandedRows: true,
			firstRowHeader: true,
		});
		expect(result.dirty).toBeTruthy();
		const table = c.pptxData.slides[0].elements.find((e) => e.id === 'tbl-0');
		expect(table?.type).toBe('table');
		if (table?.type === 'table') {
			expect(table.tableData?.tableStyleId).toBe(STYLE_ID);
			expect(table.tableData?.bandedRows).toBeTruthy();
			expect(table.tableData?.firstRowHeader).toBeTruthy();
		}
	});

	it('throws on a non-table element', () => {
		const c = ctxWithStyle();
		expect(() =>
			assignTableStyle(c, { slideIndex: 0, elementId: 'txt-0', styleId: STYLE_ID }),
		).toThrow('not a table');
	});

	it('falls back to pptxData.tableStylesDefaultId when styleId is omitted', () => {
		const c = ctxWithStyle();
		c.pptxData.tableStylesDefaultId = STYLE_ID;
		const result = assignTableStyle(c, { slideIndex: 0, elementId: 'tbl-0' });
		expect(result.result.styleId).toBe(STYLE_ID);
		const table = c.pptxData.slides[0].elements.find((e) => e.id === 'tbl-0');
		if (table?.type === 'table') {
			expect(table.tableData?.tableStyleId).toBe(STYLE_ID);
		}
	});

	it('throws when styleId is omitted and there is no tableStylesDefaultId', () => {
		const c = ctxWithStyle();
		expect(() => assignTableStyle(c, { slideIndex: 0, elementId: 'tbl-0' })).toThrow(
			'tableStylesDefaultId',
		);
	});
});
