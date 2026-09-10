import { describe, expect, it } from 'vitest';

import { computeTableDataGridResponsive } from './table-data-grid-responsive';

describe('computeTableDataGridResponsive', () => {
	it('stays mouse-sized above the dense-panel breakpoint', () => {
		const responsive = computeTableDataGridResponsive(1024);

		expect(responsive.gridPlan.stickyFirstColumn).toBeFalsy();
		expect(responsive.gutterClass).toBe('');
		expect(responsive.touchStyle).toBe('min-width: 28px; min-height: 28px;');
		expect(responsive.cellMinWidthStyle).toBe('min-width: 72px');
		expect(responsive.cornerStyle).toBe('width: 40px');
	});

	it('pins the gutter and grows to a touch target below the breakpoint', () => {
		const responsive = computeTableDataGridResponsive(360);

		expect(responsive.gridPlan.stickyFirstColumn).toBeTruthy();
		expect(responsive.gutterClass).toBe('pptx-svelte-table-grid-sticky');
		expect(responsive.touchStyle).toBe('min-width: 44px; min-height: 44px;');
		expect(responsive.cellMinWidthStyle).toBe('min-width: 64px');
		// The 40px gutter must widen to fit a 44px remove button.
		expect(responsive.cornerStyle).toBe('width: 44px');
	});
});
