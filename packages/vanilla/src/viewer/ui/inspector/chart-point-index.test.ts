import { describe, expect, it } from 'vitest';

import { createChartPointIndexField } from './chart-point-index';

/**
 * chart-point-index `setSelected` (vanilla): lets `chart-section.ts` drive
 * the shared "Data Point Index" box from an on-canvas mark click, so a click
 * points every `c:dPt` control at the same point without the user re-typing
 * its 1-based index.
 */
describe('chart point index field', () => {
	it('defaults to the first point', () => {
		const field = createChartPointIndexField(document, (key) => key);
		expect(field.selected()).toBe(0);
		expect(field.control.value).toBe('1');
	});

	it('setSelected writes the 1-based display value for a 0-based index', () => {
		const field = createChartPointIndexField(document, (key) => key);

		field.setSelected(2);

		expect(field.control.value).toBe('3');
		expect(field.selected()).toBe(2);
	});

	it('setSelected clamps a negative index to the first point', () => {
		const field = createChartPointIndexField(document, (key) => key);

		field.setSelected(-1);

		expect(field.control.value).toBe('1');
		expect(field.selected()).toBe(0);
	});
});
