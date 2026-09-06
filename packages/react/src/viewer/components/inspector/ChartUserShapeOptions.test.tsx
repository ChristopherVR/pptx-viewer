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

	// W2-F: a grpSp's grouped children are now individually editable rows.
	describe('grpSp grouped children', () => {
		const grouped: PptxChartUserShape = {
			kind: 'grpSp',
			anchor: 'rel',
			from: { x: 0, y: 0 },
			to: { x: 1, y: 1 },
			transform: {
				off: { x: 0, y: 0 },
				ext: { cx: 1000000, cy: 1000000 },
				chOff: { x: 0, y: 0 },
				chExt: { cx: 1000000, cy: 1000000 },
			},
			children: [
				{
					kind: 'sp',
					off: { x: 0, y: 0 },
					ext: { cx: 500000, cy: 1000000 },
					paragraphs: [{ text: 'Alpha' }],
				},
			],
		};

		it('renders the group row plus an indented, editable child row', () => {
			act(() =>
				root.render(
					<ChartUserShapeOptions
						chartData={{ ...baseChartData, userShapes: [grouped] }}
						canEdit
						onUpdateChartData={() => {}}
					/>,
				),
			);
			expect(container.querySelector('[data-chart-user-shape-path="0"]')).toBeTruthy();
			expect(container.querySelector('[data-chart-user-shape-path="0,0"]')).toBeTruthy();
			expect(container.textContent).toContain('Alpha');
		});

		it('edits the child row text and clears the group ancestor rawXml', () => {
			const onUpdateChartData = vi.fn();
			const groupWithRaw: PptxChartUserShape = { ...grouped, rawXml: { '@_x': '1' } };
			act(() =>
				root.render(
					<ChartUserShapeOptions
						chartData={{ ...baseChartData, userShapes: [groupWithRaw] }}
						canEdit
						onUpdateChartData={onUpdateChartData}
					/>,
				),
			);
			const childRow = container.querySelector('[data-chart-user-shape-path="0,0"]')!;
			const textInput = childRow.querySelector(
				'input[aria-label="pptx.chart.userShapeText"]',
			) as HTMLInputElement;
			const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
			act(() => {
				setter!.call(textInput, 'Alpha edited');
				textInput.dispatchEvent(new Event('input', { bubbles: true }));
			});
			expect(onUpdateChartData).toHaveBeenCalledOnce();
			const patch = onUpdateChartData.mock.calls[0][0] as Partial<PptxChartData>;
			const next = patch.userShapes![0];
			expect(next.rawXml).toBeUndefined();
			expect(next.children![0].paragraphs).toStrictEqual([{ text: 'Alpha edited' }]);
		});

		it('lets a top-level group row edit its own drawing anchor (moves/resizes the whole group)', () => {
			const onUpdateChartData = vi.fn();
			act(() =>
				root.render(
					<ChartUserShapeOptions
						chartData={{ ...baseChartData, userShapes: [grouped] }}
						canEdit
						onUpdateChartData={onUpdateChartData}
					/>,
				),
			);
			const groupRow = container.querySelector('[data-chart-user-shape-path="0"]')!;
			expect(groupRow.textContent).not.toContain('pptx.chart.userShapeNotEditable');
			const fromInputs = groupRow.querySelectorAll('input[type="number"]');
			expect(fromInputs.length).toBeGreaterThan(0);
			const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
			act(() => {
				setter!.call(fromInputs[0], '0.2');
				fromInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
			});
			expect(onUpdateChartData).toHaveBeenCalledOnce();
			const patch = onUpdateChartData.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0].from).toStrictEqual({ x: 0.2, y: 0 });
		});

		it('presents a nested child row as a chart-relative from/to fraction, not raw EMU', () => {
			act(() =>
				root.render(
					<ChartUserShapeOptions
						chartData={{ ...baseChartData, userShapes: [grouped] }}
						canEdit
						onUpdateChartData={() => {}}
					/>,
				),
			);
			const childRow = container.querySelector('[data-chart-user-shape-path="0,0"]')!;
			const numberInputs = Array.from(
				childRow.querySelectorAll('input[type="number"]'),
			) as HTMLInputElement[];
			// The left-half child spans from (0,0) to (0.5,1) as a chart fraction,
			// plus a trailing rotation field (0: this child has none).
			expect(numberInputs.map((i) => i.value)).toStrictEqual(['0', '0', '0.5', '1', '0']);
		});

		it('writes a nested fraction edit back as EMU off/ext', () => {
			const onUpdateChartData = vi.fn();
			act(() =>
				root.render(
					<ChartUserShapeOptions
						chartData={{ ...baseChartData, userShapes: [grouped] }}
						canEdit
						onUpdateChartData={onUpdateChartData}
					/>,
				),
			);
			const childRow = container.querySelector('[data-chart-user-shape-path="0,0"]')!;
			const numberInputs = childRow.querySelectorAll('input[type="number"]');
			const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
			act(() => {
				setter!.call(numberInputs[2], '0.25');
				numberInputs[2].dispatchEvent(new Event('change', { bubbles: true }));
			});
			expect(onUpdateChartData).toHaveBeenCalledOnce();
			const patch = onUpdateChartData.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0].children![0]).toMatchObject({
				off: { x: 0, y: 0 },
				ext: { cx: 250000, cy: 1000000 },
			});
		});

		it('writes a rotation edit on a top-level row directly onto its own rotation field', () => {
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
			const rotationInput = Array.from(container.querySelectorAll('input[type="number"]')).at(
				-1,
			) as HTMLInputElement;
			const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
			act(() => {
				setter!.call(rotationInput, '30');
				rotationInput.dispatchEvent(new Event('change', { bubbles: true }));
			});
			expect(onUpdateChartData).toHaveBeenCalledOnce();
			const patch = onUpdateChartData.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0]).toMatchObject({ rotation: 30 });
		});

		it("writes a group row's rotation edit into its own transform, not a flat field", () => {
			const onUpdateChartData = vi.fn();
			act(() =>
				root.render(
					<ChartUserShapeOptions
						chartData={{ ...baseChartData, userShapes: [grouped] }}
						canEdit
						onUpdateChartData={onUpdateChartData}
					/>,
				),
			);
			const groupRow = container.querySelector('[data-chart-user-shape-path="0"]')!;
			const rotationInput = Array.from(groupRow.querySelectorAll('input[type="number"]')).at(
				-1,
			) as HTMLInputElement;
			const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
			act(() => {
				setter!.call(rotationInput, '45');
				rotationInput.dispatchEvent(new Event('change', { bubbles: true }));
			});
			expect(onUpdateChartData).toHaveBeenCalledOnce();
			const patch = onUpdateChartData.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0]).not.toHaveProperty('rotation');
			expect(patch.userShapes![0].transform).toMatchObject({ rotation: 45 });
		});

		it('writes a flip edit on a top-level row directly onto its own flip fields', () => {
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
			const flipHInput = container.querySelector(
				'input[aria-label="pptx.arrange.flipHorizontally"]',
			) as HTMLInputElement;
			act(() => {
				flipHInput.click();
			});
			expect(onUpdateChartData).toHaveBeenCalledOnce();
			const patch = onUpdateChartData.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0]).toMatchObject({ flipH: true });
		});

		it("writes a group row's flip edit into its own transform, not a flat field", () => {
			const onUpdateChartData = vi.fn();
			act(() =>
				root.render(
					<ChartUserShapeOptions
						chartData={{ ...baseChartData, userShapes: [grouped] }}
						canEdit
						onUpdateChartData={onUpdateChartData}
					/>,
				),
			);
			const groupRow = container.querySelector('[data-chart-user-shape-path="0"]')!;
			const flipVInput = groupRow.querySelector(
				'input[aria-label="pptx.arrange.flipVertically"]',
			) as HTMLInputElement;
			act(() => {
				flipVInput.click();
			});
			expect(onUpdateChartData).toHaveBeenCalledOnce();
			const patch = onUpdateChartData.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0]).not.toHaveProperty('flipV');
			expect(patch.userShapes![0].transform).toMatchObject({ flipV: true });
		});

		it('adds a new default shape into a group via "Add shape here", sized within its own bounds', () => {
			const onUpdateChartData = vi.fn();
			act(() =>
				root.render(
					<ChartUserShapeOptions
						chartData={{ ...baseChartData, userShapes: [grouped] }}
						canEdit
						onUpdateChartData={onUpdateChartData}
					/>,
				),
			);
			const groupRow = container.querySelector('[data-chart-user-shape-path="0"]')!;
			const addIntoGroupButton = Array.from(groupRow.querySelectorAll('button')).find((b) =>
				b.textContent?.includes('pptx.chart.userShapeAddIntoGroup'),
			)!;
			act(() => addIntoGroupButton.click());
			expect(onUpdateChartData).toHaveBeenCalledOnce();
			const patch = onUpdateChartData.mock.calls[0][0] as Partial<PptxChartData>;
			const children = patch.userShapes![0].children!;
			expect(children).toHaveLength(2);
			expect(children[1]).toMatchObject({ kind: 'sp', off: { x: 350000, y: 400000 } });
		});
	});
});
