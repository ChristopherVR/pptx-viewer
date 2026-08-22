import type { PptxTableCell, PptxTableData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { DEFAULT_TEXT_COLOR } from '../constants';
import { tableCellCss } from './table-cell-css';

/**
 * A programmatically inserted table: exactly what `newTableElement` produces
 * (header row + banded rows, no table-style GUID). React rendered these through
 * a path that never consulted the band cascade at all, so they came out flat.
 */
function insertedTable(): PptxTableData {
	return {
		rows: [],
		columnWidths: [0.5, 0.5],
		firstRowHeader: true,
		bandedRows: true,
	} as unknown as PptxTableData;
}

const POS = { rowIndex: 0, cellIndex: 0, rowCount: 4, columnCount: 2 };

describe('tableCellCss', () => {
	it('applies the header emphasis a programmatic table declares', () => {
		const css = tableCellCss(insertedTable(), undefined, POS);
		expect(css.fontWeight).toBe(700);
		expect(css.backgroundColor).toBeDefined();
	});

	it('bands alternate body rows differently', () => {
		const td = insertedTable();
		const band1 = tableCellCss(td, undefined, { ...POS, rowIndex: 1 });
		const band2 = tableCellCss(td, undefined, { ...POS, rowIndex: 2 });
		expect(band1.backgroundColor).not.toBe(band2.backgroundColor);
	});

	it('floors an unstyled cell at the dark slide-text colour', () => {
		// Without the floor the cell inherits the host chrome's `foreground`
		// (#f0efec on the dark preset), i.e. near-white text on a light cell.
		const css = tableCellCss(undefined, undefined, POS);
		expect(css.color).toBe(DEFAULT_TEXT_COLOR);
	});

	it('lets the band layer set the text colour instead of the floor', () => {
		const css = tableCellCss(insertedTable(), undefined, POS);
		expect(css.color).toBe('#ffffff');
	});

	it('lets an explicit cell colour beat both the band and the floor', () => {
		const cell = { text: '', style: { color: '#ff0000' } } as PptxTableCell;
		const css = tableCellCss(insertedTable(), cell, POS);
		expect(css.color).toBe('#ff0000');
	});

	it('keeps a base colour the binding already resolved', () => {
		const css = tableCellCss(undefined, undefined, POS, undefined, { color: '#123456' });
		expect(css.color).toBe('#123456');
	});

	it('layers the explicit cell style over the band fill', () => {
		const cell = { text: '', style: { backgroundColor: '#00ff00' } } as PptxTableCell;
		const css = tableCellCss(insertedTable(), cell, { ...POS, rowIndex: 1 });
		expect(css.backgroundColor).toBe('#00ff00');
	});

	it('lets a cell image fill beat the band fill underneath it', () => {
		// A banded row would otherwise paint a `backgroundColor` here; the image
		// fill must still win, exactly like an explicit solid/gradient fill does.
		const cell = {
			text: '',
			style: { fillMode: 'image', backgroundImageFillData: 'data:image/png;base64,AAAA' },
		} as PptxTableCell;
		const css = tableCellCss(insertedTable(), cell, { ...POS, rowIndex: 1 });
		expect(css.backgroundImage).toBe('url("data:image/png;base64,AAAA")');
	});

	it('renders an explicit zero cell margin as zero padding through the full cascade', () => {
		const cell = { text: '', style: { marginLeft: 0 } } as PptxTableCell;
		const css = tableCellCss(insertedTable(), cell, POS);
		expect(css.paddingLeft).toBe('0px');
	});
});
