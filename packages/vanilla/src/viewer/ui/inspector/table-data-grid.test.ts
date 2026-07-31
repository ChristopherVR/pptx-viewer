import type { PptxTableData, TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createTableDataGrid } from './table-data-grid';
import type { InspectorHandlers, InspectorState } from './types';

function tableElement(tableData?: PptxTableData): TablePptxElement {
	return {
		id: 't1',
		type: 'table',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		tableData: tableData ?? {
			columnWidths: [0.5, 0.5],
			rows: [
				{ height: 32, cells: [{ text: 'A1' }, { text: 'B1' }] },
				{ height: 32, cells: [{ text: 'A2' }, { text: 'B2' }] },
			],
		},
	} as TablePptxElement;
}

function state(element: TablePptxElement | undefined): InspectorState {
	return { hasSelection: true, isTable: true, tableElement: element } as InspectorState;
}

function build(element: TablePptxElement | undefined = tableElement()) {
	const setTableData = vi.fn<InspectorHandlers['setTableData']>();
	const section = createTableDataGrid(document, createTranslator(), {
		setTableData,
	} as unknown as InspectorHandlers);
	section.update(state(element));
	return { section, setTableData };
}

/** The toolbar order is add row, remove row, add column, remove column. */
function toolbar(section: { el: HTMLElement }): HTMLButtonElement[] {
	return Array.from(section.el.querySelectorAll<HTMLButtonElement>('.pptxv-table-grid-btn'));
}

describe('table data grid', () => {
	it('renders one labelled text input per cell inside an aria grid', () => {
		const { section } = build();

		expect(section.el.getAttribute('aria-label')).toBe('Table data editor');
		expect(section.el.querySelector('[role="grid"]')).not.toBeNull();
		// Never a real <table>: the e2e contract drives the in-slide cell editor
		// with a `td input` selector and would otherwise match these inputs.
		expect(section.el.querySelector('table')).toBeNull();

		const inputs = Array.from(
			section.el.querySelectorAll<HTMLInputElement>('[role="gridcell"] input[type="text"]'),
		);
		expect(inputs).toHaveLength(4);
		expect(inputs.map((input) => input.value)).toStrictEqual(['A1', 'B1', 'A2', 'B2']);
		expect(inputs.map((input) => input.getAttribute('aria-label'))).toStrictEqual([
			'Row 1, column 1',
			'Row 1, column 2',
			'Row 2, column 1',
			'Row 2, column 2',
		]);
		expect(section.el.querySelectorAll('[role="row"]')).toHaveLength(3);
		expect(section.el.querySelectorAll('[role="columnheader"]')).toHaveLength(3);
		expect(section.el.querySelectorAll('[role="rowheader"]')).toHaveLength(2);
	});

	it('commits the new text when a cell is edited', () => {
		const { section, setTableData } = build();

		const cell = section.el.querySelector<HTMLInputElement>(
			'input[data-pptx-row="1"][data-pptx-col="0"]',
		)!;
		cell.value = 'Revenue';
		cell.dispatchEvent(new Event('change'));

		expect(setTableData).toHaveBeenCalledOnce();
		expect(setTableData.mock.calls[0][0].rows[1].cells[0].text).toBe('Revenue');
		// Untouched cells are carried over verbatim.
		expect(setTableData.mock.calls[0][0].rows[0].cells[0].text).toBe('A1');
	});

	it('adds and removes rows and columns from the header toolbar', () => {
		const { section, setTableData } = build();
		const [addRow, removeRow, addColumn, removeColumn] = toolbar(section);

		expect([addRow, removeRow, addColumn, removeColumn].map((b) => b.textContent)).toStrictEqual([
			'+ Row',
			'- Row',
			'+ Col',
			'- Col',
		]);
		expect(removeRow.title).toBe('Remove last row');

		addRow.click();
		expect(setTableData.mock.calls[0][0].rows).toHaveLength(3);

		removeRow.click();
		expect(setTableData.mock.calls[1][0].rows).toHaveLength(1);

		addColumn.click();
		expect(setTableData.mock.calls[2][0].columnWidths).toHaveLength(3);

		removeColumn.click();
		expect(setTableData.mock.calls[3][0].columnWidths).toHaveLength(1);
	});

	it('removes the addressed row / column from the gutter buttons', () => {
		const { section, setTableData } = build();

		section.el.querySelector<HTMLButtonElement>('[role="rowheader"] button')!.click();
		expect(setTableData.mock.calls[0][0].rows.map((row) => row.cells[0].text)).toStrictEqual([
			'A2',
		]);

		const columnRemove = section.el.querySelector<HTMLButtonElement>(
			'[role="columnheader"] button',
		)!;
		expect(columnRemove.getAttribute('aria-label')).toBe('Remove column 1');
		expect(columnRemove.title).toBe('Remove column 1');
		columnRemove.click();
		expect(setTableData.mock.calls[1][0].rows[0].cells.map((cell) => cell.text)).toStrictEqual([
			'B1',
		]);
	});

	it('disables the remove controls on a one-by-one table', () => {
		const { section } = build(
			tableElement({ columnWidths: [1], rows: [{ cells: [{ text: 'Only' }] }] }),
		);
		const [, removeRow, , removeColumn] = toolbar(section);

		expect(removeRow.disabled).toBeTruthy();
		expect(removeColumn.disabled).toBeTruthy();
		expect(section.el.querySelectorAll('.pptxv-table-grid-remove')).toHaveLength(0);
	});

	it('stays hidden for a table that carries no data, and for no selection', () => {
		const { section } = build(tableElement({ columnWidths: [], rows: [] }));
		expect(section.el.hidden).toBeTruthy();
		expect(section.el.querySelectorAll('input')).toHaveLength(0);

		section.update({ hasSelection: false, isTable: false } as InspectorState);
		expect(section.el.hidden).toBeTruthy();
	});

	it('hides the editing controls on a read-only deck', () => {
		const { section } = build();
		section.setEditable(false);
		section.update(state(tableElement()));

		expect(section.el.querySelector<HTMLElement>('.pptxv-table-grid-toolbar')!.hidden).toBeTruthy();
		expect(section.el.querySelectorAll('.pptxv-table-grid-remove')).toHaveLength(0);
		for (const input of section.el.querySelectorAll('input')) {
			expect(input.disabled).toBeTruthy();
		}
	});
});
