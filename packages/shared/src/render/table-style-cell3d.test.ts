import type { ParsedTableStyleEntry, PptxTableData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveTableStyleCell3D } from './table-style-cell3d';

function table(overrides: Partial<PptxTableData> = {}): PptxTableData {
	return {
		rows: [],
		columnWidths: [0.5, 0.5],
		...overrides,
	} as unknown as PptxTableData;
}

describe('resolveTableStyleCell3D', () => {
	it('returns undefined when the entry is undefined', () => {
		expect(
			resolveTableStyleCell3D(undefined, table(), {
				rowIndex: 0,
				cellIndex: 0,
				rowCount: 2,
				columnCount: 2,
			}),
		).toBeUndefined();
	});

	it('applies a whole-table cell3D as the lowest-priority layer (issue G5)', () => {
		const entry: ParsedTableStyleEntry = {
			styleId: '{X}',
			wholeTblCell3D: { bevelWidth: 4, material: 'plastic' },
		};
		const result = resolveTableStyleCell3D(entry, table(), {
			rowIndex: 1,
			cellIndex: 1,
			rowCount: 3,
			columnCount: 3,
		});
		expect(result).toStrictEqual({ bevelWidth: 4, material: 'plastic' });
	});

	it('lets the header row cell3D beat the whole-table cell3D', () => {
		const entry: ParsedTableStyleEntry = {
			styleId: '{X}',
			wholeTblCell3D: { material: 'plastic' },
			firstRowCell3D: { material: 'metal' },
		};
		const result = resolveTableStyleCell3D(entry, table({ firstRowHeader: true }), {
			rowIndex: 0,
			cellIndex: 1,
			rowCount: 3,
			columnCount: 3,
		});
		expect(result?.material).toBe('metal');
	});

	it('lets the top-left corner (nwCell) beat every other section', () => {
		const entry: ParsedTableStyleEntry = {
			styleId: '{X}',
			wholeTblCell3D: { material: 'plastic' },
			firstRowCell3D: { material: 'metal' },
			firstColCell3D: { material: 'wood' },
			nwCellCell3D: { material: 'warmMatte' },
		};
		const result = resolveTableStyleCell3D(entry, table({ firstRowHeader: true, firstCol: true }), {
			rowIndex: 0,
			cellIndex: 0,
			rowCount: 3,
			columnCount: 3,
		});
		expect(result?.material).toBe('warmMatte');
	});

	it('resolves banded-row cell3D for a plain body cell', () => {
		const entry: ParsedTableStyleEntry = {
			styleId: '{X}',
			band1HCell3D: { material: 'clear' },
			band2HCell3D: { material: 'flat' },
		};
		const result = resolveTableStyleCell3D(entry, table({ bandedRows: true }), {
			rowIndex: 1,
			cellIndex: 0,
			rowCount: 4,
			columnCount: 2,
		});
		expect(result?.material).toBe('flat');
	});

	it('returns undefined when no applicable section defines a cell3D', () => {
		const entry: ParsedTableStyleEntry = { styleId: '{X}' };
		const result = resolveTableStyleCell3D(entry, table(), {
			rowIndex: 0,
			cellIndex: 0,
			rowCount: 2,
			columnCount: 2,
		});
		expect(result).toBeUndefined();
	});
});
