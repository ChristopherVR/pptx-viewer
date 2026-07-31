import { mount } from '@vue/test-utils';
import type { PptxElement, PptxTableData, TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import TableDataGrid from './TableDataGrid.vue';

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

function mountGrid(element: PptxElement, canEdit = true) {
	return mount(TableDataGrid, { props: { element, canEdit } });
}

/** Extract the tableData from the most recent `update` emit. */
function lastEmittedTableData(wrapper: ReturnType<typeof mountGrid>): PptxTableData {
	const events = wrapper.emitted('update');
	expect(events).toBeTruthy();
	const last = events![events!.length - 1][0] as Partial<PptxElement>;
	const td = (last as { tableData?: PptxTableData }).tableData;
	expect(td).toBeTruthy();
	return td as PptxTableData;
}

function findButton(wrapper: ReturnType<typeof mountGrid>, label: string) {
	const btn = wrapper.findAll('button').find((b) => b.text().trim() === label);
	expect(btn, `button "${label}" not found`).toBeTruthy();
	return btn!;
}

describe('tableDataGrid', () => {
	it('renders one labelled text input per cell', () => {
		const wrapper = mountGrid(makeTableElement(2, 3));
		const inputs = wrapper.findAll('input[type="text"]');
		expect(inputs).toHaveLength(6);
		expect(inputs[0].attributes('aria-label')).toBe('Row 1, column 1');
		expect((inputs[0].element as HTMLInputElement).value).toBe('r0c0');
		expect(inputs[5].attributes('aria-label')).toBe('Row 2, column 3');
		expect((inputs[5].element as HTMLInputElement).value).toBe('r1c2');
	});

	it('exposes grid roles without using a real table element', () => {
		const wrapper = mountGrid(makeTableElement(2, 2));
		expect(wrapper.find('[role="grid"]').exists()).toBeTruthy();
		expect(wrapper.findAll('[role="row"]')).toHaveLength(3);
		expect(wrapper.findAll('[role="gridcell"]')).toHaveLength(4);
		expect(wrapper.find('table').exists()).toBeFalsy();
		expect(wrapper.find('section').attributes('aria-label')).toBe('Table data editor');
	});

	it('emits a tableData patch carrying the new cell text', async () => {
		const wrapper = mountGrid(makeTableElement(2, 2));
		const input = wrapper.findAll('input[type="text"]')[3];
		await input.setValue('edited');
		const td = lastEmittedTableData(wrapper);
		expect(td.rows[1].cells[1].text).toBe('edited');
		// Untouched cells survive.
		expect(td.rows[0].cells[0].text).toBe('r0c0');
	});

	it('appends a row', async () => {
		const wrapper = mountGrid(makeTableElement(2, 2));
		await findButton(wrapper, '+ Row').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.rows).toHaveLength(3);
		expect(td.rows[2].cells.every((c) => c.text === '')).toBeTruthy();
	});

	it('removes the last row', async () => {
		const wrapper = mountGrid(makeTableElement(3, 2));
		await findButton(wrapper, '- Row').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.rows).toHaveLength(2);
		expect(td.rows[1].cells[0].text).toBe('r1c0');
	});

	it('appends a column', async () => {
		const wrapper = mountGrid(makeTableElement(2, 2));
		await findButton(wrapper, '+ Col').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.columnWidths).toHaveLength(3);
		for (const row of td.rows) {
			expect(row.cells).toHaveLength(3);
		}
	});

	it('removes the last column', async () => {
		const wrapper = mountGrid(makeTableElement(2, 3));
		await findButton(wrapper, '- Col').trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.columnWidths).toHaveLength(2);
		for (const row of td.rows) {
			expect(row.cells).toHaveLength(2);
		}
	});

	it('disables the remove controls at the last row and column', () => {
		const wrapper = mountGrid(makeTableElement(1, 1));
		expect(findButton(wrapper, '- Row').attributes('disabled')).toBeDefined();
		expect(findButton(wrapper, '- Col').attributes('disabled')).toBeDefined();
	});

	it('removes a specific row and column from the headers', async () => {
		const wrapper = mountGrid(makeTableElement(2, 2));
		const removeCol2 = wrapper.get('button[aria-label="Remove column 2"]');
		await removeCol2.trigger('click');
		expect(lastEmittedTableData(wrapper).columnWidths).toHaveLength(1);

		const removeRow1 = wrapper.get('button[aria-label="Remove row 1"]');
		await removeRow1.trigger('click');
		const td = lastEmittedTableData(wrapper);
		expect(td.rows).toHaveLength(1);
		expect(td.rows[0].cells[0].text).toBe('r1c0');
	});

	it('renders read-only inputs and no controls when editing is off', () => {
		const wrapper = mountGrid(makeTableElement(2, 2), false);
		expect(wrapper.findAll('button')).toHaveLength(0);
		for (const input of wrapper.findAll('input[type="text"]')) {
			expect(input.attributes('disabled')).toBeDefined();
		}
	});

	it('renders nothing for a table with no data', () => {
		const empty: TablePptxElement = {
			type: 'table',
			id: 'tbl-empty',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			tableData: { rows: [], columnWidths: [] },
		};
		expect(mountGrid(empty).find('section').exists()).toBeFalsy();
		expect(
			mountGrid({ ...empty, tableData: undefined })
				.find('section')
				.exists(),
		).toBeFalsy();
	});

	it('renders nothing for a non-table element', () => {
		const wrapper = mountGrid({
			type: 'text',
			id: 't1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			text: 'hi',
		} as PptxElement);
		expect(wrapper.find('section').exists()).toBeFalsy();
	});
});
