import type { TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { setCellText } from './table-cell-edit';

function makeTable(): TablePptxElement {
	return {
		id: 't1',
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

describe('setCellText', () => {
	it('replaces the targeted cell text and leaves siblings untouched', () => {
		const el = makeTable();
		const next = setCellText(el, 0, 1, 'B!');
		expect(next.tableData?.rows[0].cells[1].text).toBe('B!');
		expect(next.tableData?.rows[0].cells[0].text).toBe('a');
		expect(next.tableData?.rows[1].cells[1].text).toBe('d');
	});

	it('does not mutate the source element', () => {
		const el = makeTable();
		const next = setCellText(el, 1, 0, 'C!');
		expect(el.tableData?.rows[1].cells[0].text).toBe('c');
		expect(next).not.toBe(el);
		expect(next.tableData).not.toBe(el.tableData);
		// Unchanged rows are reused by reference.
		expect(next.tableData?.rows[0]).toBe(el.tableData?.rows[0]);
	});

	it('returns the element unchanged when it carries no tableData', () => {
		const el = {
			id: 't',
			type: 'table',
			x: 0,
			y: 0,
			width: 1,
			height: 1,
		} as unknown as TablePptxElement;
		expect(setCellText(el, 0, 0, 'x')).toBe(el);
	});
});
