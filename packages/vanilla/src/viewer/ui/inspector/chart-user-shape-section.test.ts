import type { PptxChartData, PptxChartUserShape } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createChartUserShapeSection } from './chart-user-shape-section';

function chart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['A'],
		series: [{ name: 'Sales', values: [1] }],
		...overrides,
	};
}

const textBoxShape: PptxChartUserShape = {
	kind: 'sp',
	anchor: 'rel',
	from: { x: 0.1, y: 0.1 },
	to: { x: 0.3, y: 0.2 },
	paragraphs: [{ text: 'Note' }],
};

function mount(data: PptxChartData) {
	const onChange = vi.fn();
	const section = createChartUserShapeSection(document, (key) => key, onChange);
	section.update(data);
	return { onChange, section };
}

describe('chart user shape section', () => {
	it('hides the list and shows the empty state with no overlay shapes', () => {
		const { section } = mount(chart());
		expect(section.el.querySelector('[data-testid="chart-user-shape-row"]')).toBeNull();
		expect(section.el.querySelector('.pptxv-chart-usershapes-empty')!.textContent).toContain(
			'pptx.chart.userShapesEmpty',
		);
	});

	it('renders one row per overlay shape', () => {
		const { section } = mount(chart({ userShapes: [textBoxShape] }));
		expect(section.el.querySelectorAll('[data-testid="chart-user-shape-row"]')).toHaveLength(1);
		expect(section.el.textContent).toContain('Note');
	});

	it('calls onChange with an appended shape when the add button is clicked', () => {
		const { section, onChange } = mount(chart());
		const addButton = section.el.querySelector<HTMLButtonElement>(
			'[data-testid="chart-user-shape-add"]',
		)!;
		addButton.click();
		expect(onChange).toHaveBeenCalledOnce();
		const patch = onChange.mock.calls[0][0] as Partial<PptxChartData>;
		expect(patch.userShapes).toHaveLength(1);
		expect(patch.userShapes![0].kind).toBe('sp');
	});

	it('calls onChange with the shape removed when delete is clicked', () => {
		const { section, onChange } = mount(chart({ userShapes: [textBoxShape] }));
		const deleteButton = section.el.querySelector<HTMLButtonElement>(
			'[data-testid="chart-user-shape-delete"]',
		)!;
		deleteButton.click();
		expect(onChange).toHaveBeenCalledWith({ userShapes: [] });
	});

	it('patches the from-x anchor field on change', () => {
		const { section, onChange } = mount(chart({ userShapes: [textBoxShape] }));
		const numberInputs = section.el.querySelectorAll<HTMLInputElement>(
			'.pptxv-chart-usershape-anchor input',
		);
		numberInputs[0].value = '0.5';
		numberInputs[0].dispatchEvent(new Event('change'));
		const patch = onChange.mock.calls[0][0] as Partial<PptxChartData>;
		expect(patch.userShapes![0].from).toStrictEqual({ x: 0.5, y: 0.1 });
	});
});
