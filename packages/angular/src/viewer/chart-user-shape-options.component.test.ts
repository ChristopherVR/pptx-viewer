/**
 * ChartUserShapeOptionsComponent, Angular binding (C2-G10 edit/serialize
 * follow-up; W2-F grouped-child tree editing).
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is instantiated
 * directly, inputs are stubbed as signals, mirroring
 * `chart-display-options.component.test.ts`.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal, OutputEmitterRef } from '@angular/core';
import type { ChartPptxElement, PptxChartData, PptxChartUserShape } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { ChartUserShapeOptionsComponent } from './chart-user-shape-options.component';

function chartElement(chartData: PptxChartData): ChartPptxElement {
	return {
		type: 'chart',
		id: 'chart-1',
		name: 'Chart 1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as ChartPptxElement;
}

function createOptions(chartData: PptxChartData): ChartUserShapeOptionsComponent {
	const options = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new ChartUserShapeOptionsComponent(),
	);
	Object.assign(options, {
		element: signal(chartElement(chartData)) as unknown as InputSignal<ChartPptxElement>,
		canEdit: signal(true) as unknown as InputSignal<boolean>,
	});
	return options;
}

function spyEmit(options: ChartUserShapeOptionsComponent): () => ChartPptxElement | undefined {
	let emitted: ChartPptxElement | undefined;
	vi.spyOn(options.elementChange as OutputEmitterRef<ChartPptxElement>, 'emit').mockImplementation(
		(value) => {
			emitted = value;
		},
	);
	return () => emitted;
}

const textBoxShape: PptxChartUserShape = {
	kind: 'sp',
	anchor: 'rel',
	from: { x: 0.1, y: 0.1 },
	to: { x: 0.3, y: 0.2 },
	paragraphs: [{ text: 'Note' }],
};

const groupedShape: PptxChartUserShape = {
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

describe('chartUserShapeOptionsComponent', () => {
	it('lists no rows for a chart with no overlay shapes', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [],
			categories: [],
		} as PptxChartData);
		expect(options['rows']()).toStrictEqual([]);
	});

	it('lists one row per overlay shape', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [],
			categories: [],
			userShapes: [textBoxShape],
		} as unknown as PptxChartData);
		const rows = options['rows']();
		expect(rows).toHaveLength(1);
		expect(rows[0].text).toBe('Note');
		expect(rows[0].editableVisuals).toBeTruthy();
		expect(rows[0].editablePosition).toBeTruthy();
	});

	it('emits an appended shape when adding a text box', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [],
			categories: [],
		} as PptxChartData);
		const emitted = spyEmit(options);
		options['onAddTextBox']();
		expect(emitted()?.chartData?.userShapes).toHaveLength(1);
		expect(emitted()?.chartData?.userShapes?.[0].kind).toBe('sp');
	});

	it('emits the shape removed when deleting by path', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [],
			categories: [],
			userShapes: [textBoxShape],
		} as unknown as PptxChartData);
		const emitted = spyEmit(options);
		options['onRemove']([0]);
		expect(emitted()?.chartData?.userShapes).toStrictEqual([]);
	});

	// W2-F: a grpSp's grouped children are now individually editable rows.
	describe('grpSp grouped children', () => {
		it('lists the group row plus an indented, editable child row', () => {
			const options = createOptions({
				chartType: 'bar',
				series: [],
				categories: [],
				userShapes: [groupedShape],
			} as unknown as PptxChartData);
			const rows = options['rows']();
			expect(rows).toHaveLength(2);
			expect(rows[0]).toMatchObject({
				path: [0],
				depth: 0,
				isGroup: true,
				editablePosition: true,
			});
			expect(rows[1]).toMatchObject({
				path: [0, 0],
				depth: 1,
				kind: 'sp',
				text: 'Alpha',
				editableVisuals: true,
				editablePosition: true,
			});
		});

		it('edits the child row text and clears the group ancestor rawXml', () => {
			const groupWithRaw: PptxChartUserShape = {
				...groupedShape,
				rawXml: { '@_x': '1' },
			};
			const options = createOptions({
				chartType: 'bar',
				series: [],
				categories: [],
				userShapes: [groupWithRaw],
			} as unknown as PptxChartData);
			const emitted = spyEmit(options);
			options['onText']([0, 0], { target: { value: 'Alpha edited' } } as unknown as Event);
			const next = emitted()?.chartData?.userShapes?.[0];
			expect(next?.rawXml).toBeUndefined();
			expect(next?.children?.[0].paragraphs).toStrictEqual([{ text: 'Alpha edited' }]);
		});

		it("edits the top-level group row's own drawing anchor via the generic position patch", () => {
			const options = createOptions({
				chartType: 'bar',
				series: [],
				categories: [],
				userShapes: [groupedShape],
			} as unknown as PptxChartData);
			const emitted = spyEmit(options);
			options['onPositionPatch']({ path: [0], patch: { from: { x: 0.2, y: 0 } } });
			expect(emitted()?.chartData?.userShapes?.[0].from).toStrictEqual({ x: 0.2, y: 0 });
		});

		it('writes a nested from/to fraction box edit back as EMU off/ext', () => {
			const options = createOptions({
				chartType: 'bar',
				series: [],
				categories: [],
				userShapes: [groupedShape],
			} as unknown as PptxChartData);
			const emitted = spyEmit(options);
			options['onPositionBoxPatch']({
				path: [0, 0],
				box: { from: { x: 0.1, y: 0.2 }, to: { x: 0.4, y: 0.6 } },
			});
			expect(emitted()?.chartData?.userShapes?.[0].children?.[0]).toMatchObject({
				off: { x: 100000, y: 200000 },
				ext: { cx: 300000, cy: 400000 },
			});
		});

		it("writes a leaf row's rotation edit directly onto its own rotation field", () => {
			const options = createOptions({
				chartType: 'bar',
				series: [],
				categories: [],
				userShapes: [textBoxShape],
			} as unknown as PptxChartData);
			const emitted = spyEmit(options);
			options['onPositionRotationPatch']({ path: [0], rotation: 30 });
			expect(emitted()?.chartData?.userShapes?.[0]).toMatchObject({ rotation: 30 });
		});

		it("writes a group row's rotation edit into its own transform, not a flat field", () => {
			const options = createOptions({
				chartType: 'bar',
				series: [],
				categories: [],
				userShapes: [groupedShape],
			} as unknown as PptxChartData);
			const emitted = spyEmit(options);
			options['onPositionRotationPatch']({ path: [0], rotation: 45 });
			const group = emitted()?.chartData?.userShapes?.[0];
			expect(group).not.toHaveProperty('rotation');
			expect(group?.transform).toMatchObject({ rotation: 45 });
		});

		it("writes a leaf row's flip edit directly onto its own flip fields", () => {
			const options = createOptions({
				chartType: 'bar',
				series: [],
				categories: [],
				userShapes: [textBoxShape],
			} as unknown as PptxChartData);
			const emitted = spyEmit(options);
			options['onPositionFlipPatch']({ path: [0], flip: { flipH: true } });
			expect(emitted()?.chartData?.userShapes?.[0]).toMatchObject({ flipH: true });
		});

		it("writes a group row's flip edit into its own transform, not a flat field", () => {
			const options = createOptions({
				chartType: 'bar',
				series: [],
				categories: [],
				userShapes: [groupedShape],
			} as unknown as PptxChartData);
			const emitted = spyEmit(options);
			options['onPositionFlipPatch']({ path: [0], flip: { flipV: true } });
			const group = emitted()?.chartData?.userShapes?.[0];
			expect(group).not.toHaveProperty('flipV');
			expect(group?.transform).toMatchObject({ flipV: true });
		});

		it('adds a new default shape into a group, sized within its own bounds', () => {
			const options = createOptions({
				chartType: 'bar',
				series: [],
				categories: [],
				userShapes: [groupedShape],
			} as unknown as PptxChartData);
			const emitted = spyEmit(options);
			options['onAddIntoGroup']([0]);
			const children = emitted()?.chartData?.userShapes?.[0].children;
			expect(children).toHaveLength(2);
			expect(children?.[1]).toMatchObject({ kind: 'sp', off: { x: 350000, y: 400000 } });
		});
	});
});
