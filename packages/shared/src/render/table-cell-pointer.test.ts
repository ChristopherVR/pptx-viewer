import { describe, expect, it } from 'vitest';

import { tableCellPointerIntent } from './table-cell-pointer';

const IN_CELL = { isTableCell: true, elementSelected: true, rangeOnSameElement: true };

describe('tableCellPointerIntent', () => {
	it('extends the range on a Shift-click inside the selected table', () => {
		expect(tableCellPointerIntent({ ...IN_CELL, shiftKey: true })).toBe('extend');
	});

	it('anchors on a plain click inside a cell', () => {
		expect(tableCellPointerIntent({ ...IN_CELL, shiftKey: false })).toBe('anchor');
	});

	it('anchors rather than no-ops when there is no range to extend from', () => {
		expect(tableCellPointerIntent({ ...IN_CELL, shiftKey: true, rangeOnSameElement: false })).toBe(
			'anchor',
		);
	});

	it('anchors when the table is not selected yet', () => {
		expect(tableCellPointerIntent({ ...IN_CELL, shiftKey: true, elementSelected: false })).toBe(
			'anchor',
		);
	});

	it('clears the range for a press outside any cell', () => {
		expect(tableCellPointerIntent({ ...IN_CELL, isTableCell: false, shiftKey: true })).toBe(
			'clear',
		);
	});
});
