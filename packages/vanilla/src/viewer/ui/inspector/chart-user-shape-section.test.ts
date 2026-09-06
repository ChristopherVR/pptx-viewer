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
			'.pptxv-chart-usershape-anchor input[type="number"]',
		);
		numberInputs[0].value = '0.5';
		numberInputs[0].dispatchEvent(new Event('change'));
		const patch = onChange.mock.calls[0][0] as Partial<PptxChartData>;
		expect(patch.userShapes![0].from).toStrictEqual({ x: 0.5, y: 0.1 });
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
			const { section } = mount(chart({ userShapes: [grouped] }));
			expect(section.el.querySelector('[data-chart-user-shape-path="0"]')).toBeTruthy();
			expect(section.el.querySelector('[data-chart-user-shape-path="0,0"]')).toBeTruthy();
			expect(section.el.textContent).toContain('Alpha');
		});

		it('edits the child row text and clears the group ancestor rawXml', () => {
			const groupWithRaw: PptxChartUserShape = { ...grouped, rawXml: { '@_x': '1' } };
			const { section, onChange } = mount(chart({ userShapes: [groupWithRaw] }));
			const childRow = section.el.querySelector('[data-chart-user-shape-path="0,0"]')!;
			const textField = childRow.querySelector<HTMLInputElement>(
				'input[aria-label="pptx.chart.userShapeText"]',
			)!;
			textField.value = 'Alpha edited';
			textField.dispatchEvent(new Event('change'));
			expect(onChange).toHaveBeenCalledOnce();
			const patch = onChange.mock.calls[0][0] as Partial<PptxChartData>;
			const next = patch.userShapes![0];
			expect(next.rawXml).toBeUndefined();
			expect(next.children![0].paragraphs).toStrictEqual([{ text: 'Alpha edited' }]);
		});

		it('lets a top-level group row edit its own drawing anchor (moves/resizes the whole group)', () => {
			const { section, onChange } = mount(chart({ userShapes: [grouped] }));
			const groupRow = section.el.querySelector('[data-chart-user-shape-path="0"]')!;
			const fromXInput = groupRow.querySelector<HTMLInputElement>(
				'.pptxv-chart-usershape-anchor input[type="number"]',
			)!;
			fromXInput.value = '0.2';
			fromXInput.dispatchEvent(new Event('change'));
			expect(onChange).toHaveBeenCalledOnce();
			const patch = onChange.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0].from).toStrictEqual({ x: 0.2, y: 0 });
		});

		it('presents a nested child row as a chart-relative from/to fraction, not raw EMU', () => {
			const { section } = mount(chart({ userShapes: [grouped] }));
			const childRow = section.el.querySelector('[data-chart-user-shape-path="0,0"]')!;
			const values = Array.from(
				childRow.querySelectorAll<HTMLInputElement>(
					'.pptxv-chart-usershape-anchor input[type="number"]',
				),
			).map((i) => i.value);
			// A trailing rotation field (0: this child has none) follows from/to.
			expect(values).toStrictEqual(['0', '0', '0.5', '1', '0']);
		});

		it('writes a nested fraction edit back as EMU off/ext', () => {
			const { section, onChange } = mount(chart({ userShapes: [grouped] }));
			const childRow = section.el.querySelector('[data-chart-user-shape-path="0,0"]')!;
			const inputs = childRow.querySelectorAll<HTMLInputElement>(
				'.pptxv-chart-usershape-anchor input[type="number"]',
			);
			inputs[2]!.value = '0.25';
			inputs[2]!.dispatchEvent(new Event('change'));
			expect(onChange).toHaveBeenCalledOnce();
			const patch = onChange.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0].children![0]).toMatchObject({
				off: { x: 0, y: 0 },
				ext: { cx: 250000, cy: 1000000 },
			});
		});

		it('writes a rotation edit on a top-level leaf row directly onto its own rotation field', () => {
			const { section, onChange } = mount(chart({ userShapes: [textBoxShape] }));
			const numberInputs = section.el.querySelectorAll<HTMLInputElement>(
				'.pptxv-chart-usershape-anchor input[type="number"]',
			);
			const rotationInput = numberInputs[numberInputs.length - 1]!;
			rotationInput.value = '30';
			rotationInput.dispatchEvent(new Event('change'));
			expect(onChange).toHaveBeenCalledOnce();
			const patch = onChange.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0]).toMatchObject({ rotation: 30 });
		});

		it("writes a group row's rotation edit into its own transform, not a flat field", () => {
			const { section, onChange } = mount(chart({ userShapes: [grouped] }));
			const groupRow = section.el.querySelector('[data-chart-user-shape-path="0"]')!;
			const numberInputs = groupRow.querySelectorAll<HTMLInputElement>(
				'.pptxv-chart-usershape-anchor input[type="number"]',
			);
			const rotationInput = numberInputs[numberInputs.length - 1]!;
			rotationInput.value = '45';
			rotationInput.dispatchEvent(new Event('change'));
			expect(onChange).toHaveBeenCalledOnce();
			const patch = onChange.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0]).not.toHaveProperty('rotation');
			expect(patch.userShapes![0].transform).toMatchObject({ rotation: 45 });
		});

		it('writes a flip edit on a top-level leaf row directly onto its own flip fields', () => {
			const { section, onChange } = mount(chart({ userShapes: [textBoxShape] }));
			const flipHInput = section.el.querySelector<HTMLInputElement>(
				'input[aria-label="pptx.arrange.flipHorizontally"]',
			)!;
			flipHInput.checked = true;
			flipHInput.dispatchEvent(new Event('change'));
			expect(onChange).toHaveBeenCalledOnce();
			const patch = onChange.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0]).toMatchObject({ flipH: true });
		});

		it("writes a group row's flip edit into its own transform, not a flat field", () => {
			const { section, onChange } = mount(chart({ userShapes: [grouped] }));
			const groupRow = section.el.querySelector('[data-chart-user-shape-path="0"]')!;
			const flipVInput = groupRow.querySelector<HTMLInputElement>(
				'input[aria-label="pptx.arrange.flipVertically"]',
			)!;
			flipVInput.checked = true;
			flipVInput.dispatchEvent(new Event('change'));
			expect(onChange).toHaveBeenCalledOnce();
			const patch = onChange.mock.calls[0][0] as Partial<PptxChartData>;
			expect(patch.userShapes![0]).not.toHaveProperty('flipV');
			expect(patch.userShapes![0].transform).toMatchObject({ flipV: true });
		});

		it('adds a new default shape into a group via "Add shape here"', () => {
			const { section, onChange } = mount(chart({ userShapes: [grouped] }));
			const addIntoGroupButton = section.el.querySelector<HTMLButtonElement>(
				'[data-testid="chart-user-shape-add-into-group"]',
			)!;
			addIntoGroupButton.click();
			expect(onChange).toHaveBeenCalledOnce();
			const patch = onChange.mock.calls[0][0] as Partial<PptxChartData>;
			const children = patch.userShapes![0].children!;
			expect(children).toHaveLength(2);
			expect(children[1]).toMatchObject({ kind: 'sp', off: { x: 350000, y: 400000 } });
		});
	});
});
