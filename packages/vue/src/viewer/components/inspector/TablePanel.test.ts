import { mount } from '@vue/test-utils';
import type { PptxElement, PptxTableData, TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

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

function mountPanel(element: PptxElement) {
	return mount(TablePanel, { props: { element } });
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
	const btn = wrapper.findAll('button').find((b) => b.text().includes(label));
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

	it('insert row above increases row count and emits the new grid', async () => {
		const wrapper = mountPanel(makeTableElement(2, 2));
		await findButton(wrapper, 'Insert above').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.rows).toHaveLength(3);
		// New row has blank cells matching the column count and cell shape.
		const newRow = td.rows[td.rows.length - 2];
		expect(newRow.cells).toHaveLength(2);
		expect(newRow.cells.every((c) => c.text === '')).toBeTruthy();
	});

	it('insert row below increases row count', async () => {
		const wrapper = mountPanel(makeTableElement(2, 2));
		await findButton(wrapper, 'Insert below').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.rows).toHaveLength(3);
		expect(td.rows[2].cells).toHaveLength(2);
	});

	it('delete row decreases row count and emits the new grid', async () => {
		const wrapper = mountPanel(makeTableElement(3, 2));
		await findButton(wrapper, 'Delete row').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.rows).toHaveLength(2);
	});

	it('disables delete row when only one row remains', () => {
		const wrapper = mountPanel(makeTableElement(1, 2));
		expect(findButton(wrapper, 'Delete row').attributes('disabled')).toBeDefined();
	});

	it('insert column left increases column count and widths stay normalized', async () => {
		const wrapper = mountPanel(makeTableElement(2, 2));
		await findButton(wrapper, 'Insert left').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.columnWidths).toHaveLength(3);
		for (const row of td.rows) {
			expect(row.cells).toHaveLength(3);
		}
		const sum = td.columnWidths.reduce((a, b) => a + b, 0);
		expect(sum).toBeCloseTo(1, 6);
	});

	it('insert column right increases column count', async () => {
		const wrapper = mountPanel(makeTableElement(2, 2));
		await findButton(wrapper, 'Insert right').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.columnWidths).toHaveLength(3);
		expect(td.rows[0].cells).toHaveLength(3);
	});

	it('delete column decreases column count', async () => {
		const wrapper = mountPanel(makeTableElement(2, 3));
		await findButton(wrapper, 'Delete column').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.columnWidths).toHaveLength(2);
		for (const row of td.rows) {
			expect(row.cells).toHaveLength(2);
		}
		const sum = td.columnWidths.reduce((a, b) => a + b, 0);
		expect(sum).toBeCloseTo(1, 6);
	});

	it('disables delete column when only one column remains', () => {
		const wrapper = mountPanel(makeTableElement(2, 1));
		expect(findButton(wrapper, 'Delete column').attributes('disabled')).toBeDefined();
	});

	it('toggles the header row and emits firstRowHeader', async () => {
		const wrapper = mountPanel(makeTableElement(2, 2));
		await wrapper.find('input[type="checkbox"]').setValue(true);
		const td = lastEmittedTableData(wrapper);
		expect(td.firstRowHeader).toBeTruthy();
	});
});
