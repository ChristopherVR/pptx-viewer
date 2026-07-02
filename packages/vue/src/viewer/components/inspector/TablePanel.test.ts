import { mount } from '@vue/test-utils';
import type { PptxElement, PptxTableData, TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import type { TableSelectionContext, TableSelectionState } from '../../composables/table-selection';
import { TableSelectionKey } from '../../composables/table-selection';
import TablePanel from './TablePanel.vue';

function makeTableData(rows: number, cols: number): PptxTableData {
	return {
		rows: Array.from({ length: rows }, (_row, r) => ({
			cells: Array.from({ length: cols }, (_cell, c) => ({ text: `r${r}c${c}` })),
		})),
		columnWidths: Array.from({ length: cols }, () => 1 / cols),
	};
}

function makeTableElement(rows: number, cols: number): TablePptxElement {
	return {
		type: 'table',
		id: 'tbl1',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		tableData: makeTableData(rows, cols),
	};
}

function makeSelectionContext(initial: TableSelectionState | null): TableSelectionContext {
	const selection = ref<TableSelectionState | null>(initial);
	return {
		selection,
		select: (next) => {
			selection.value = next;
		},
		resizeColumns: () => {},
		resizeRow: () => {},
	};
}

function mountPanel(element: PptxElement, selection: TableSelectionState | null = null) {
	return mount(TablePanel, {
		props: { element },
		global: { provide: { [TableSelectionKey as symbol]: makeSelectionContext(selection) } },
	});
}

/** Extract the tableData from the most recent `update` emit. */
function lastEmittedTableData(wrapper: ReturnType<typeof mountPanel>): PptxTableData {
	const events = wrapper.emitted('update');
	expect(events).toBeTruthy();
	const last = events![events!.length - 1][0] as Partial<PptxElement>;
	const td = (last as { tableData?: PptxTableData }).tableData;
	expect(td).toBeTruthy();
	return td as PptxTableData;
}

function findButton(wrapper: ReturnType<typeof mountPanel>, label: string) {
	const btn = wrapper.findAll('button').find((b) => b.text().trim() === label);
	expect(btn, `button "${label}" not found`).toBeTruthy();
	return btn!;
}

describe('tablePanel', () => {
	it('shows a muted note for non-table elements', () => {
		const wrapper = mountPanel({
			type: 'text',
			id: 't1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			text: 'hi',
		} as PptxElement);
		expect(wrapper.text()).toContain('Select a table');
		expect(wrapper.findAll('button')).toHaveLength(0);
	});

	it('displays row and column counts', () => {
		const wrapper = mountPanel(makeTableElement(3, 2));
		expect(wrapper.text()).toContain('Rows: 3');
		expect(wrapper.text()).toContain('Columns: 2');
	});

	it('insert row above inserts at the selected row', () => {
		const wrapper = mountPanel(makeTableElement(2, 2), {
			elementId: 'tbl1',
			rowIndex: 1,
			columnIndex: 0,
		});
		findButton(wrapper, 'Insert above').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.rows).toHaveLength(3);
		// Inserted above row 1 -> new blank row lands at index 1.
		expect(td.rows[1].cells.every((c) => c.text === '')).toBeTruthy();
	});

	it('insert row below inserts after the selected row', () => {
		const wrapper = mountPanel(makeTableElement(2, 2), {
			elementId: 'tbl1',
			rowIndex: 0,
			columnIndex: 0,
		});
		findButton(wrapper, 'Insert below').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.rows).toHaveLength(3);
		expect(td.rows[1].cells.every((c) => c.text === '')).toBeTruthy();
	});

	it('delete row removes the selected row', () => {
		const wrapper = mountPanel(makeTableElement(3, 2), {
			elementId: 'tbl1',
			rowIndex: 0,
			columnIndex: 0,
		});
		findButton(wrapper, 'Delete row').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.rows).toHaveLength(2);
		expect(td.rows[0].cells[0].text).toBe('r1c0');
	});

	it('disables delete row when only one row remains', () => {
		const wrapper = mountPanel(makeTableElement(1, 2));
		expect(findButton(wrapper, 'Delete row').attributes('disabled')).toBeDefined();
	});

	it('insert column keeps widths normalised', () => {
		const wrapper = mountPanel(makeTableElement(2, 2), {
			elementId: 'tbl1',
			rowIndex: 0,
			columnIndex: 0,
		});
		findButton(wrapper, 'Insert right').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.columnWidths).toHaveLength(3);
		for (const row of td.rows) {
			expect(row.cells).toHaveLength(3);
		}
		expect(td.columnWidths.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
	});

	it('delete column decreases column count', () => {
		const wrapper = mountPanel(makeTableElement(2, 3), {
			elementId: 'tbl1',
			rowIndex: 0,
			columnIndex: 0,
		});
		findButton(wrapper, 'Delete column').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.columnWidths).toHaveLength(2);
		expect(td.columnWidths.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
	});

	it('disables delete column when only one column remains', () => {
		const wrapper = mountPanel(makeTableElement(2, 1));
		expect(findButton(wrapper, 'Delete column').attributes('disabled')).toBeDefined();
	});

	it('toggles the header row and emits firstRowHeader', async () => {
		const wrapper = mountPanel(makeTableElement(2, 2));
		// Style toggle order: banded rows, header row, ... -> index 1 is header row.
		const checkboxes = wrapper.findAll('input[type="checkbox"]');
		await checkboxes[1].setValue(true);
		const td = lastEmittedTableData(wrapper);
		expect(td.firstRowHeader).toBeTruthy();
	});

	it('shows a merge button and merges a multi-cell selection', () => {
		const wrapper = mountPanel(makeTableElement(2, 2), {
			elementId: 'tbl1',
			rowIndex: 0,
			columnIndex: 0,
			selectedCells: [
				{ row: 0, col: 0 },
				{ row: 0, col: 1 },
			],
		});
		findButton(wrapper, 'Merge selected cells').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.rows[0].cells[0].gridSpan).toBe(2);
	});

	it('shows the cell formatting panel only when a cell is selected', () => {
		const noSel = mountPanel(makeTableElement(2, 2));
		expect(noSel.text()).not.toContain('Font size');
		const withSel = mountPanel(makeTableElement(2, 2), {
			elementId: 'tbl1',
			rowIndex: 0,
			columnIndex: 0,
		});
		expect(withSel.text()).toContain('Font size');
	});
});
