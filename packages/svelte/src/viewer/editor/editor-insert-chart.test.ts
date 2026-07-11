import type { CanvasSize } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { buildChartInsertElement } from './editor-insert-chart';

const CANVAS: CanvasSize = { width: 960, height: 540 };

describe('editor-insert-chart buildChartInsertElement', () => {
	it('builds a centred chart element for the given chart type', () => {
		const el = buildChartInsertElement('bar', CANVAS);
		expect(el.type).toBe('chart');
		expect(el.x).toBeGreaterThanOrEqual(0);
		expect(el.y).toBeGreaterThanOrEqual(0);
		expect(el.x + el.width).toBeLessThanOrEqual(CANVAS.width);
	});

	it('defaults chart data (categories/series) so the chart renders immediately', () => {
		const el = buildChartInsertElement('pie', CANVAS);
		expect(el).toHaveProperty('chartData');
	});

	it('centres the chart on the canvas', () => {
		const el = buildChartInsertElement('line', CANVAS);
		expect(el.x).toBe(Math.round((CANVAS.width - el.width) / 2));
		expect(el.y).toBe(Math.round((CANVAS.height - el.height) / 2));
	});
});
