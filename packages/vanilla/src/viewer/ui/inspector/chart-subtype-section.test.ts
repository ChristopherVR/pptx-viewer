import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createChartSubtypeSection } from './chart-subtype-section';

function chart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['A', 'B'],
		series: [{ name: 'Sales', values: [1, 2] }],
		...overrides,
	};
}

function mount(data: PptxChartData) {
	const onChange = vi.fn();
	const section = createChartSubtypeSection(document, (key) => key, onChange);
	section.update(data);
	const select = (testid: string) =>
		section.el.querySelector<HTMLSelectElement>(`[data-testid="${testid}"]`)!;
	return { onChange, section, select };
}

describe('chart subtype section', () => {
	it('shows only the bar3D shape picker for a bar3D chart', () => {
		const { section } = mount(chart({ chartType: 'bar3D', barShape: 'cylinder' }));

		expect(
			section.el.querySelector('[data-testid="pptx-chart-bar3d-shape"]')!.closest('label')!.hidden,
		).toBeFalsy();
		expect(
			section.el.querySelector('[data-testid="pptx-chart-radar-style"]')!.closest('label')!.hidden,
		).toBeTruthy();
		expect(
			section.el.querySelector('[data-testid="pptx-chart-surface-wireframe"]')!.closest('label')!
				.hidden,
		).toBeTruthy();
	});

	it('reflects the current bar3D shape and applies the shared patch on change', () => {
		const { select, onChange } = mount(chart({ chartType: 'bar3D', barShape: 'cylinder' }));
		const shape = select('pptx-chart-bar3d-shape');

		expect(shape.value).toBe('cylinder');

		shape.value = 'coneToMax';
		shape.dispatchEvent(new Event('change'));

		expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ barShape: 'coneToMax' }));
	});

	it('shows only the radar style picker for a radar chart and applies its patch', () => {
		const { section, select, onChange } = mount(
			chart({ chartType: 'radar', radarStyle: 'marker' }),
		);

		expect(
			section.el.querySelector('[data-testid="pptx-chart-radar-style"]')!.closest('label')!.hidden,
		).toBeFalsy();
		expect(select('pptx-chart-radar-style').value).toBe('marker');

		const style = select('pptx-chart-radar-style');
		style.value = 'filled';
		style.dispatchEvent(new Event('change'));

		expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ radarStyle: 'filled' }));
	});

	it('shows only the surface wireframe picker for a surface chart and applies its patch', () => {
		const { section, select, onChange } = mount(chart({ chartType: 'surface', wireframe: false }));

		expect(
			section.el.querySelector('[data-testid="pptx-chart-surface-wireframe"]')!.closest('label')!
				.hidden,
		).toBeFalsy();
		expect(select('pptx-chart-surface-wireframe').value).toBe('false');

		const wireframe = select('pptx-chart-surface-wireframe');
		wireframe.value = 'true';
		wireframe.dispatchEvent(new Event('change'));

		expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ wireframe: true }));
	});

	it('hides all three pickers for a chart type with no subtype flag', () => {
		const { section } = mount(chart({ chartType: 'line' }));

		for (const testid of [
			'pptx-chart-bar3d-shape',
			'pptx-chart-radar-style',
			'pptx-chart-surface-wireframe',
		]) {
			expect(
				section.el.querySelector(`[data-testid="${testid}"]`)!.closest('label')!.hidden,
			).toBeTruthy();
		}
	});
});
