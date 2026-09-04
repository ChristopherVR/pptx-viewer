/**
 * table-renderer.component.drilldown.test.ts: G8 (OpenXML parity audit, D3).
 *
 * `a:graphicFrameLocks/@noDrilldown` was parsed and round-tripped but never
 * enforced - a table's cells stayed selectable/editable (single click to
 * select, double click to edit) regardless of the lock, gated only on
 * `editable`. `canDrillDownIntoTable` is tested directly, not through the
 * component: `TableRendererComponent`'s constructor runs an `effect()` that
 * needs a `ChangeDetectionScheduler` this package's TestBed-free suite
 * doesn't provide (see `ribbon-home-section.component.test.ts`).
 */
import type { TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { canDrillDownIntoTable } from './table-renderer.component';

function table(overrides: Partial<TablePptxElement> = {}): TablePptxElement {
	return {
		id: 'tbl1',
		type: 'table',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		tableData: { columnWidths: [0.5, 0.5], rows: [] },
		...overrides,
	} as TablePptxElement;
}

describe('canDrillDownIntoTable', () => {
	it('is false when noDrilldown is set, even on an editable deck', () => {
		expect(
			canDrillDownIntoTable(
				true,
				table({ locks: { noDrilldown: true } } as Partial<TablePptxElement>),
			),
		).toBeFalsy();
	});

	it('is true for an editable, unlocked table', () => {
		expect(canDrillDownIntoTable(true, table())).toBeTruthy();
	});

	it('is false when the viewer itself is not editable', () => {
		expect(canDrillDownIntoTable(false, table())).toBeFalsy();
	});
});
