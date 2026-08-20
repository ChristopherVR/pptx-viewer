import { describe, expect, it } from 'vitest';

import { selectionState } from './editor-selection-state';

/**
 * Regression: `chartPartSelection` must be cleared by the SAME funnel every
 * other selection-scoped sub-state (table cell, text range) already goes
 * through, or a stale on-canvas chart-part highlight would linger in the
 * inspector under a newly selected element.
 */
describe('selectionState', () => {
	it('clears chartPartSelection alongside the other selection-scoped state', () => {
		expect(selectionState('el-1', ['el-1'])).toStrictEqual({
			selectedElementId: 'el-1',
			selectedElementIds: ['el-1'],
			selectedTableCell: null,
			selectedTableCells: [],
			selectedTextRange: null,
			chartPartSelection: null,
		});
	});

	it('clears it on full deselection too', () => {
		expect(selectionState(null, []).chartPartSelection).toBeNull();
	});
});
