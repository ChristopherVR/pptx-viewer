// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxChartData, PptxChartUserShape } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ChartUserShapeOptions from './ChartUserShapeOptions.vue';

function chartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		series: [],
		categories: [],
		...overrides,
	} as PptxChartData;
}

const textBoxShape: PptxChartUserShape = {
	kind: 'sp',
	anchor: 'rel',
	from: { x: 0.1, y: 0.1 },
	to: { x: 0.3, y: 0.2 },
	paragraphs: [{ text: 'Note' }],
};

function lastPatch(wrapper: ReturnType<typeof mount>): Partial<PptxChartData> {
	const events = wrapper.emitted('update-chart-data');
	expect(events).toBeTruthy();
	const ev = events as unknown[][];
	return ev[ev.length - 1][0] as Partial<PptxChartData>;
}

describe('chartUserShapeOptions', () => {
	it('shows the empty state with no overlay shapes', () => {
		const wrapper = mount(ChartUserShapeOptions, { props: { chartData: chartData() } });
		expect(wrapper.find('[data-testid="chart-user-shape-row"]').exists()).toBeFalsy();
	});

	it('renders one row per overlay shape', () => {
		const wrapper = mount(ChartUserShapeOptions, {
			props: { chartData: chartData({ userShapes: [textBoxShape] }) },
		});
		expect(wrapper.findAll('[data-testid="chart-user-shape-row"]')).toHaveLength(1);
		expect(wrapper.text()).toContain('Note');
	});

	it('emits update-chart-data with an appended shape on Add text box', async () => {
		const wrapper = mount(ChartUserShapeOptions, { props: { chartData: chartData() } });
		await wrapper.find('[data-testid="chart-user-shape-add"]').trigger('click');
		const patch = lastPatch(wrapper);
		expect(patch.userShapes).toHaveLength(1);
		expect(patch.userShapes![0].kind).toBe('sp');
	});

	it('emits update-chart-data with the shape removed on delete', async () => {
		const wrapper = mount(ChartUserShapeOptions, {
			props: { chartData: chartData({ userShapes: [textBoxShape] }) },
		});
		await wrapper.find('[data-testid="chart-user-shape-delete"]').trigger('click');
		expect(lastPatch(wrapper)).toStrictEqual({ userShapes: [] });
	});

	// A grpSp's grouped children are individually editable rows.
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
			const wrapper = mount(ChartUserShapeOptions, {
				props: { chartData: chartData({ userShapes: [grouped] }) },
			});
			expect(wrapper.find('[data-chart-user-shape-path="0"]').exists()).toBeTruthy();
			expect(wrapper.find('[data-chart-user-shape-path="0,0"]').exists()).toBeTruthy();
			expect(wrapper.text()).toContain('Alpha');
		});

		it('edits the child row text and clears the group ancestor rawXml', async () => {
			const groupWithRaw: PptxChartUserShape = { ...grouped, rawXml: { '@_x': '1' } };
			const wrapper = mount(ChartUserShapeOptions, {
				props: { chartData: chartData({ userShapes: [groupWithRaw] }) },
			});
			const childRow = wrapper.get('[data-chart-user-shape-path="0,0"]');
			const textInput = childRow.get('input[type="text"]');
			await textInput.setValue('Alpha edited');
			const patch = lastPatch(wrapper);
			const next = patch.userShapes![0];
			expect(next.rawXml).toBeUndefined();
			expect(next.children![0].paragraphs).toStrictEqual([{ text: 'Alpha edited' }]);
		});

		it('lets a top-level group row edit its own drawing anchor (moves/resizes the whole group)', async () => {
			const wrapper = mount(ChartUserShapeOptions, {
				props: { chartData: chartData({ userShapes: [grouped] }) },
			});
			const groupRow = wrapper.get('[data-chart-user-shape-path="0"]');
			const fromXInput = groupRow.findAll('input[type="number"]')[0]!;
			await fromXInput.setValue('0.2');
			const patch = lastPatch(wrapper);
			expect(patch.userShapes![0].from).toStrictEqual({ x: 0.2, y: 0 });
		});

		it('presents a nested child row as a chart-relative from/to fraction, not raw EMU', () => {
			const wrapper = mount(ChartUserShapeOptions, {
				props: { chartData: chartData({ userShapes: [grouped] }) },
			});
			const childRow = wrapper.get('[data-chart-user-shape-path="0,0"]');
			const values = childRow
				.findAll('input[type="number"]')
				.map((i) => (i.element as HTMLInputElement).value);
			// A trailing rotation field (0: this child has none) follows from/to.
			expect(values).toStrictEqual(['0', '0', '0.5', '1', '0']);
		});

		it('writes a nested fraction edit back as EMU off/ext', async () => {
			const wrapper = mount(ChartUserShapeOptions, {
				props: { chartData: chartData({ userShapes: [grouped] }) },
			});
			const childRow = wrapper.get('[data-chart-user-shape-path="0,0"]');
			const toXInput = childRow.findAll('input[type="number"]')[2]!;
			await toXInput.setValue('0.25');
			const patch = lastPatch(wrapper);
			expect(patch.userShapes![0].children![0]).toMatchObject({
				off: { x: 0, y: 0 },
				ext: { cx: 250000, cy: 1000000 },
			});
		});

		it('writes a rotation edit on a top-level leaf row directly onto its own rotation field', async () => {
			const wrapper = mount(ChartUserShapeOptions, {
				props: { chartData: chartData({ userShapes: [textBoxShape] }) },
			});
			const numberInputs = wrapper.findAll('input[type="number"]');
			await numberInputs[numberInputs.length - 1]!.setValue('30');
			const patch = lastPatch(wrapper);
			expect(patch.userShapes![0]).toMatchObject({ rotation: 30 });
		});

		it("writes a group row's rotation edit into its own transform, not a flat field", async () => {
			const wrapper = mount(ChartUserShapeOptions, {
				props: { chartData: chartData({ userShapes: [grouped] }) },
			});
			const groupRow = wrapper.get('[data-chart-user-shape-path="0"]');
			const numberInputs = groupRow.findAll('input[type="number"]');
			await numberInputs[numberInputs.length - 1]!.setValue('45');
			const patch = lastPatch(wrapper);
			expect(patch.userShapes![0]).not.toHaveProperty('rotation');
			expect(patch.userShapes![0].transform).toMatchObject({ rotation: 45 });
		});

		it('writes a flip edit on a top-level leaf row directly onto its own flip fields', async () => {
			const wrapper = mount(ChartUserShapeOptions, {
				props: { chartData: chartData({ userShapes: [textBoxShape] }) },
			});
			const flipHInput = wrapper.get('input[aria-label="Flip horizontally"]');
			await flipHInput.setValue(true);
			const patch = lastPatch(wrapper);
			expect(patch.userShapes![0]).toMatchObject({ flipH: true });
		});

		it("writes a group row's flip edit into its own transform, not a flat field", async () => {
			const wrapper = mount(ChartUserShapeOptions, {
				props: { chartData: chartData({ userShapes: [grouped] }) },
			});
			const groupRow = wrapper.get('[data-chart-user-shape-path="0"]');
			const flipVInput = groupRow.get('input[aria-label="Flip vertically"]');
			await flipVInput.setValue(true);
			const patch = lastPatch(wrapper);
			expect(patch.userShapes![0]).not.toHaveProperty('flipV');
			expect(patch.userShapes![0].transform).toMatchObject({ flipV: true });
		});

		it('adds a new default shape into a group via "Add shape here"', async () => {
			const wrapper = mount(ChartUserShapeOptions, {
				props: { chartData: chartData({ userShapes: [grouped] }) },
			});
			await wrapper.get('[data-testid="chart-user-shape-add-into-group"]').trigger('click');
			const patch = lastPatch(wrapper);
			const children = patch.userShapes![0].children!;
			expect(children).toHaveLength(2);
			expect(children[1]).toMatchObject({ kind: 'sp', off: { x: 350000, y: 400000 } });
		});
	});
});
