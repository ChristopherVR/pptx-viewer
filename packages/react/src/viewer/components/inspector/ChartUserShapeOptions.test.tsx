// @vitest-environment happy-dom
import type { PptxChartData, PptxChartUserShape } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChartUserShapeOptions } from './ChartUserShapeOptions';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

const baseChartData: PptxChartData = {
	chartType: 'bar',
	categories: ['A'],
	series: [{ name: 'S1', values: [1] }],
};

const textBoxShape: PptxChartUserShape = {
	kind: 'sp',
	anchor: 'rel',
	from: { x: 0.1, y: 0.1 },
	to: { x: 0.3, y: 0.2 },
	paragraphs: [{ text: 'Note' }],
};

describe('chartUserShapeOptions', () => {
	it('shows the empty state when the chart has no overlay shapes', () => {
		act(() =>
			root.render(
				<ChartUserShapeOptions chartData={baseChartData} canEdit onUpdateChartData={() => {}} />,
			),
		);
		expect(container.textContent).toContain('pptx.chart.userShapesEmpty');
	});

	it('renders the existing overlay shapes list', () => {
		act(() =>
			root.render(
				<ChartUserShapeOptions
					chartData={{ ...baseChartData, userShapes: [textBoxShape] }}
					canEdit
					onUpdateChartData={() => {}}
				/>,
			),
		);
		expect(container.textContent).toContain('Note');
		expect(container.textContent).toContain('pptx.chart.userShapeKindSp');
	});

	it('calls onUpdateChartData with an appended shape when "Add text box" is clicked', () => {
		const onUpdateChartData = vi.fn();
		act(() =>
			root.render(
				<ChartUserShapeOptions
					chartData={baseChartData}
					canEdit
					onUpdateChartData={onUpdateChartData}
				/>,
			),
		);
		const addButton = Array.from(container.querySelectorAll('button')).find((b) =>
			b.textContent?.includes('pptx.chart.userShapeAddTextBox'),
		)!;
		act(() => addButton.click());
		expect(onUpdateChartData).toHaveBeenCalledOnce();
		const patch = onUpdateChartData.mock.calls[0][0] as Partial<PptxChartData>;
		expect(patch.userShapes).toHaveLength(1);
		expect(patch.userShapes![0].kind).toBe('sp');
	});

	it('calls onUpdateChartData with the shape removed when delete is clicked', () => {
		const onUpdateChartData = vi.fn();
		act(() =>
			root.render(
				<ChartUserShapeOptions
					chartData={{ ...baseChartData, userShapes: [textBoxShape] }}
					canEdit
					onUpdateChartData={onUpdateChartData}
				/>,
			),
		);
		const deleteButton = container.querySelector(
			'button[aria-label="pptx.chart.userShapeDelete"]',
		)!;
		act(() => (deleteButton as HTMLButtonElement).click());
		expect(onUpdateChartData).toHaveBeenCalledWith({ userShapes: [] });
	});
});
