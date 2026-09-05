import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import {
	addChartUserShape,
	removeChartUserShape,
} from '../../core/builders/sdk/chart-user-shape-operations';
import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement, PptxChartUserShape, PptxData } from '../../core/types';

/**
 * A brand-new SDK-created chart is written whole in one shot
 * (`createChartElementXml` -> `buildChartSpaceXml`) on its very first save,
 * before it has a `chartData.chartPartPath` (that is only ever assigned at
 * PARSE time). `PptxHandlerRuntimeChartUserShapes.syncChartUserShapesToXml`
 * only runs on the incremental per-chart-part update path, which requires
 * `chartPartPath`. So every case here saves the chart once WITHOUT an
 * overlay, reloads it (parse attaches `chartPartPath`), and only then adds
 * the overlay shape before the save under test, matching how a real "load a
 * deck, add a chart annotation, save" edit actually reaches this code.
 *
 * `save()` operates on the calling handler's own loaded zip state, so every
 * step below reuses the SAME handler instance that most recently `load()`ed,
 * rather than a throwaway `new PptxHandler()`.
 */
async function buildAndReloadBareChart(): Promise<{
	handler: PptxHandler;
	data: PptxData;
	chart: ChartPptxElement;
}> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	const slide = createSlide('Blank')
		.addChart(
			'bar',
			{ series: [{ name: 'Revenue', values: [10, 20] }], categories: ['Q1', 'Q2'] },
			{ x: 50, y: 50, width: 500, height: 300 },
		)
		.build();
	data.slides.push(slide);
	const saved = await handler.save(data.slides);

	const reloadHandler = new PptxHandler();
	const reloaded = await reloadHandler.load(saved.buffer as ArrayBuffer);
	const chart = reloaded.slides[0].elements.find(
		(element) => element.type === 'chart',
	) as ChartPptxElement;
	return { handler: reloadHandler, data: reloaded, chart };
}

describe('chart c:userShapes overlay round-trip (C2-G10 edit/serialize follow-up)', () => {
	it('fabricates a new drawing part, relationship, and content-type override for a chart that never had one', async () => {
		const { handler, data, chart } = await buildAndReloadBareChart();
		const shape: PptxChartUserShape = {
			kind: 'sp',
			anchor: 'rel',
			from: { x: 0.1, y: 0.1 },
			to: { x: 0.3, y: 0.2 },
			prst: 'rect',
			fill: '#FFCC00',
			stroke: '#333333',
			strokeWidth: 1,
			paragraphs: [{ text: 'Callout', align: 'ctr' }],
		};
		addChartUserShape(chart, shape);

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		expect(zip.file('ppt/drawings/drawing1.xml')).not.toBeNull();
		const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
		expect(contentTypes).toContain(
			'application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml',
		);
		const chartRels = await zip.file('ppt/charts/_rels/chart1.xml.rels')!.async('string');
		expect(chartRels).toContain(
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chartUserShapes',
		);
		const chartXml = await zip.file('ppt/charts/chart1.xml')!.async('string');
		expect(chartXml).toContain('userShapes');

		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(saved.buffer as ArrayBuffer);
		const roundTrip = reloaded.slides[0].elements.find(
			(element) => element.type === 'chart',
		) as ChartPptxElement;
		expect(roundTrip.chartData!.userShapes).toStrictEqual([shape]);

		// A second, untouched save must not rewrite the drawing part: the
		// dirty check compares against a fresh reparse and short-circuits.
		const savedAgain = await reloadHandler.save(reloaded.slides);
		const zipAgain = await JSZip.loadAsync(savedAgain);
		const drawingAgain = await zipAgain.file('ppt/drawings/drawing1.xml')!.async('string');
		const drawingBefore = await zip.file('ppt/drawings/drawing1.xml')!.async('string');
		expect(drawingAgain).toBe(drawingBefore);
	});

	it('overwrites an existing drawing part in place when the overlay is edited', async () => {
		const { handler, data, chart } = await buildAndReloadBareChart();
		addChartUserShape(chart, {
			kind: 'sp',
			anchor: 'rel',
			from: { x: 0, y: 0 },
			to: { x: 0.2, y: 0.2 },
			prst: 'rect',
			fill: '#FF0000',
		});
		const savedOnce = await handler.save(data.slides);

		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(savedOnce.buffer as ArrayBuffer);
		const reloadedChart = reloaded.slides[0].elements.find(
			(element) => element.type === 'chart',
		) as ChartPptxElement;
		expect(reloadedChart.chartData!.userShapes).toHaveLength(1);

		// Move + recolour the shape (still index 0).
		reloadedChart.chartData!.userShapes = [
			{ ...reloadedChart.chartData!.userShapes![0], from: { x: 0.4, y: 0.4 }, fill: '#00FF00' },
		];
		const savedTwice = await reloadHandler.save(reloaded.slides);
		const zip = await JSZip.loadAsync(savedTwice);
		// Still exactly one drawing part (overwritten, not duplicated).
		const drawingParts = Object.keys(zip.files).filter((name) =>
			/^ppt\/drawings\/drawing\d+\.xml$/u.test(name),
		);
		expect(drawingParts).toHaveLength(1);

		const finalHandler = new PptxHandler();
		const reloadedAgain = await finalHandler.load(savedTwice.buffer as ArrayBuffer);
		const finalChart = reloadedAgain.slides[0].elements.find(
			(element) => element.type === 'chart',
		) as ChartPptxElement;
		expect(finalChart.chartData!.userShapes).toStrictEqual([
			{
				kind: 'sp',
				anchor: 'rel',
				from: { x: 0.4, y: 0.4 },
				to: { x: 0.2, y: 0.2 },
				prst: 'rect',
				fill: '#00FF00',
			},
		]);
	});

	it('removes the c:userShapes reference when the overlay is emptied', async () => {
		const { handler, data, chart } = await buildAndReloadBareChart();
		addChartUserShape(chart, {
			kind: 'sp',
			anchor: 'rel',
			from: { x: 0, y: 0 },
			to: { x: 0.2, y: 0.2 },
			prst: 'rect',
		});
		const savedOnce = await handler.save(data.slides);

		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(savedOnce.buffer as ArrayBuffer);
		const reloadedChart = reloaded.slides[0].elements.find(
			(element) => element.type === 'chart',
		) as ChartPptxElement;
		expect(reloadedChart.chartData!.userShapes).toHaveLength(1);

		removeChartUserShape(reloadedChart, 0);
		const savedTwice = await reloadHandler.save(reloaded.slides);
		const zip = await JSZip.loadAsync(savedTwice);
		const chartXml = await zip.file('ppt/charts/chart1.xml')!.async('string');
		expect(chartXml).not.toContain('userShapes');

		const finalHandler = new PptxHandler();
		const reloadedAgain = await finalHandler.load(savedTwice.buffer as ArrayBuffer);
		const finalChart = reloadedAgain.slides[0].elements.find(
			(element) => element.type === 'chart',
		) as ChartPptxElement;
		expect(finalChart.chartData!.userShapes).toBeUndefined();
	});

	it('reaches a ChartEx (cx:chartSpace) chart via the in-place update branch', async () => {
		// ChartEx charts route through `saveChartAcrossFamilies`, a SEPARATE
		// branch from the classic per-chart update loop above; without wiring
		// the sync call into its `applyChartExUpdate` in-place branch too, a
		// waterfall/funnel/etc chart's overlay would silently never save.
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slide = createSlide('Blank')
			.addChart(
				'waterfall',
				{ series: [{ name: 'Delta', values: [10, -5, 20] }], categories: ['A', 'B', 'C'] },
				{ x: 50, y: 50, width: 500, height: 300 },
			)
			.build();
		data.slides.push(slide);
		const savedBare = await handler.save(data.slides);

		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(savedBare.buffer as ArrayBuffer);
		const chart = reloaded.slides[0].elements.find(
			(element) => element.type === 'chart',
		) as ChartPptxElement;
		expect(chart.chartData!.chartType).toBe('waterfall');

		addChartUserShape(chart, {
			kind: 'sp',
			anchor: 'rel',
			from: { x: 0.2, y: 0.2 },
			to: { x: 0.4, y: 0.3 },
			prst: 'rect',
			fill: '#4472C4',
			paragraphs: [{ text: 'Peak' }],
		});
		const saved = await reloadHandler.save(reloaded.slides);
		const zip = await JSZip.loadAsync(saved);
		const drawingParts = Object.keys(zip.files).filter((name) =>
			/^ppt\/drawings\/drawing\d+\.xml$/u.test(name),
		);
		expect(drawingParts).toHaveLength(1);

		const finalHandler = new PptxHandler();
		const finalData = await finalHandler.load(saved.buffer as ArrayBuffer);
		const finalChart = finalData.slides[0].elements.find(
			(element) => element.type === 'chart',
		) as ChartPptxElement;
		expect(finalChart.chartData!.userShapes).toStrictEqual([
			{
				kind: 'sp',
				anchor: 'rel',
				from: { x: 0.2, y: 0.2 },
				to: { x: 0.4, y: 0.3 },
				prst: 'rect',
				fill: '#4472C4',
				paragraphs: [{ text: 'Peak' }],
			},
		]);
	});

	it('keeps the overlay when a ChartEx type change routes through the full-regenerate branch', async () => {
		// `chartExLayoutId('waterfall') !== chartExLayoutId('funnel')`, so this
		// edit hits `chartExLayoutChanged`'s full-regenerate branch
		// (`buildChartExSpaceXml`), NOT `applyChartExUpdate`'s in-place branch
		// the previous test covers. Before this fix, `buildChartExSpaceXml`
		// rebuilt `cx:chartSpace` from the typed model alone, which carries no
		// overlay representation, so the `c:userShapes` reference (and with it
		// the deck's only pointer to the drawing part) was silently dropped.
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slide = createSlide('Blank')
			.addChart(
				'waterfall',
				{ series: [{ name: 'Delta', values: [10, -5, 20] }], categories: ['A', 'B', 'C'] },
				{ x: 50, y: 50, width: 500, height: 300 },
			)
			.build();
		data.slides.push(slide);
		const savedBare = await handler.save(data.slides);

		const overlayHandler = new PptxHandler();
		const withOverlayData = await overlayHandler.load(savedBare.buffer as ArrayBuffer);
		const chart = withOverlayData.slides[0].elements.find(
			(element) => element.type === 'chart',
		) as ChartPptxElement;
		addChartUserShape(chart, {
			kind: 'sp',
			anchor: 'rel',
			from: { x: 0.2, y: 0.2 },
			to: { x: 0.4, y: 0.3 },
			prst: 'rect',
			fill: '#4472C4',
			paragraphs: [{ text: 'Peak' }],
		});
		const savedWithOverlay = await overlayHandler.save(withOverlayData.slides);

		const typeChangeHandler = new PptxHandler();
		const beforeTypeChange = await typeChangeHandler.load(savedWithOverlay.buffer as ArrayBuffer);
		const chartBeforeTypeChange = beforeTypeChange.slides[0].elements.find(
			(element) => element.type === 'chart',
		) as ChartPptxElement;
		expect(chartBeforeTypeChange.chartData!.userShapes).toHaveLength(1);

		// The type change alone (userShapes left untouched) must still route
		// through the full-regenerate branch and keep the overlay.
		chartBeforeTypeChange.chartData!.chartType = 'funnel';
		const savedAfterTypeChange = await typeChangeHandler.save(beforeTypeChange.slides);

		const zip = await JSZip.loadAsync(savedAfterTypeChange);
		const chartXml = await zip.file('ppt/extendedCharts/chart1.xml')!.async('string');
		expect(chartXml).toContain('userShapes');
		const drawingParts = Object.keys(zip.files).filter((name) =>
			/^ppt\/drawings\/drawing\d+\.xml$/u.test(name),
		);
		expect(drawingParts).toHaveLength(1);

		const finalHandler = new PptxHandler();
		const finalData = await finalHandler.load(savedAfterTypeChange.buffer as ArrayBuffer);
		const finalChart = finalData.slides[0].elements.find(
			(element) => element.type === 'chart',
		) as ChartPptxElement;
		expect(finalChart.chartData!.chartType).toBe('funnel');
		expect(finalChart.chartData!.userShapes).toStrictEqual([
			{
				kind: 'sp',
				anchor: 'rel',
				from: { x: 0.2, y: 0.2 },
				to: { x: 0.4, y: 0.3 },
				prst: 'rect',
				fill: '#4472C4',
				paragraphs: [{ text: 'Peak' }],
			},
		]);
	});
});
