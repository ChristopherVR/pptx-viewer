/**
 * table-data-editor.component.test.ts: unit tests for the model that drives the
 * inspector's table data editor.
 *
 * No Angular TestBed: component rendering needs `@analogjs/vite-plugin-angular`
 * (a follow-up), so, matching the rest of this package, the assertions target
 * the pure model the template renders. `grid.rows` is literally what the
 * `@for` loops iterate and `canRemoveRow` / `canRemoveColumn` are literally the
 * `[disabled]` / `@if` predicates, so asserting them asserts the template.
 *
 * These deliberately import through `../internal/shared` rather than the shared
 * package directly: that is the vendored barrel ng-packagr compiles against, so
 * this doubles as a guard that `render/table-data-grid` is actually inlined into
 * the Angular build (a missing vendored file fails here, not at demo runtime).
 *
 * Reference binding: packages/react/src/viewer/components/inspector/TableDataGrid.tsx
 */
import type { TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	appendTableElementColumn,
	appendTableElementRow,
	buildTableDataGrid,
	removeLastTableElementColumn,
	removeLastTableElementRow,
	setCellText,
} from '../internal/shared';

function tableElement(): TablePptxElement {
	return {
		id: 'tbl_test',
		type: 'table',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		tableData: {
			columnWidths: [0.5, 0.5],
			rows: [{ cells: [{ text: 'a' }, { text: 'b' }] }, { cells: [{ text: 'c' }, { text: 'd' }] }],
		},
	} as unknown as TablePptxElement;
}

describe('table data editor model', () => {
	it('exposes coordinates the template binds to each cell input', () => {
		const grid = buildTableDataGrid(tableElement());

		expect(grid.rows).toHaveLength(2);
		expect(grid.colIndices).toStrictEqual([0, 1]);
		// The aria-label is built from these, as `Row {{row}}, column {{column}}`.
		expect(grid.rows[1].cells[1]).toStrictEqual({ rowIndex: 1, colIndex: 1, text: 'd' });
	});

	it('pads ragged rows so the grid stays rectangular', () => {
		const element = tableElement();
		element.tableData!.columnWidths = [0.3, 0.3, 0.4];

		const grid = buildTableDataGrid(element);
		expect(grid.rows[0].cells).toHaveLength(3);
		expect(grid.rows[0].cells[2].text).toBe('');
	});

	it('drives the remove buttons disabled state off the shared model', () => {
		const single = tableElement();
		single.tableData!.rows = [single.tableData!.rows[0]];
		single.tableData!.columnWidths = [1];

		const grid = buildTableDataGrid(single);
		expect(grid.canRemoveRow).toBeFalsy();
		expect(grid.canRemoveColumn).toBeFalsy();
	});

	it('emits a new element for every header action, leaving the source alone', () => {
		const element = tableElement();

		expect(appendTableElementRow(element).tableData?.rows).toHaveLength(3);
		expect(appendTableElementColumn(element).tableData?.columnWidths).toHaveLength(3);
		expect(removeLastTableElementRow(element).tableData?.rows).toHaveLength(1);
		expect(removeLastTableElementColumn(element).tableData?.columnWidths).toHaveLength(1);
		expect(element.tableData?.rows).toHaveLength(2);
	});

	it('commits a cell text edit without touching its neighbours', () => {
		const next = setCellText(tableElement(), 0, 1, 'B!');

		expect(buildTableDataGrid(next).rows[0].cells.map((cell) => cell.text)).toStrictEqual([
			'a',
			'B!',
		]);
		expect(buildTableDataGrid(next).rows[1].cells.map((cell) => cell.text)).toStrictEqual([
			'c',
			'd',
		]);
	});
});
