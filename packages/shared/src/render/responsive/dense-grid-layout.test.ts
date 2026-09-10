import { describe, expect, it } from 'vitest';

import { getDenseGridLayoutPlan } from './dense-grid-layout';

describe('getDenseGridLayoutPlan', () => {
	it('pins the first column and shrinks the minimum cell width at 360px', () => {
		expect(getDenseGridLayoutPlan(360)).toStrictEqual({
			stickyFirstColumn: true,
			minCellWidthPx: 64,
		});
	});

	it('does not pin the first column on desktop and uses the wider default cell', () => {
		expect(getDenseGridLayoutPlan(1280)).toStrictEqual({
			stickyFirstColumn: false,
			minCellWidthPx: 72,
		});
	});
});
