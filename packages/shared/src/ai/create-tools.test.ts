import type { ChartPptxElement, SmartArtPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { PptxAiConfig } from './config';
import { makeMockBridge } from './mock-bridge';
import { ProposalStore } from './proposals';
import { buildToolExecutors } from './tools';
import { CREATE_CHART_TYPES, CREATE_SMARTART_LAYOUTS } from './tools/create-tools';

const CONNECTION: PptxAiConfig['connection'] = { kind: 'endpoint', api: '/api/chat' };

/** Fresh mock bridge + proposal store + bound executors, default (stage) policy. */
function harness() {
	const bridge = makeMockBridge();
	const proposals = new ProposalStore(bridge);
	const executors = buildToolExecutors(bridge, proposals, { connection: CONNECTION });
	return { bridge, proposals, executors };
}

describe('create_chart tool', () => {
	it('stages a proposal that adds one chart element for every supported type', async () => {
		for (const chartType of CREATE_CHART_TYPES) {
			const { bridge, proposals, executors } = harness();
			const before = bridge.getSlides()[0].elements.length;

			const result = (await executors.get('create_chart')!({ slideIndex: 0, chartType })) as {
				staged?: boolean;
				elementId?: string;
			};

			expect(result.staged).toBeTruthy();
			expect(result.elementId).toBeDefined();
			expect(proposals.size).toBe(1);
			// Nothing applied until the proposal is accepted.
			expect(bridge.edits).toHaveLength(0);

			const [proposal] = proposals.list();
			proposals.apply(proposal.id);
			expect(bridge.edits).toHaveLength(1);

			const elements = bridge.getSlides()[0].elements;
			expect(elements).toHaveLength(before + 1);
			const chart = elements.find((e) => e.id === result.elementId) as ChartPptxElement;
			expect(chart.type).toBe('chart');
			expect(chart.chartData?.chartType).toBe(chartType);
			// A default chart carries sample categories + at least one series.
			expect(chart.chartData?.series.length).toBeGreaterThan(0);
			expect(chart.chartData?.categories?.length).toBeGreaterThan(0);
		}
	});

	it('builds a chart from caller-supplied categories and series', async () => {
		const { proposals, executors, bridge } = harness();
		const result = (await executors.get('create_chart')!({
			slideIndex: 0,
			chartType: 'line',
			title: 'Revenue',
			categories: ['Q1', 'Q2', 'Q3'],
			series: [{ name: 'Sales', values: [10, 20, 30] }],
			legend: false,
		})) as { elementId?: string };

		proposals.apply(proposals.list()[0].id);
		const chart = bridge
			.getSlides()[0]
			.elements.find((e) => e.id === result.elementId) as ChartPptxElement;
		expect(chart.chartData?.chartType).toBe('line');
		expect(chart.chartData?.title).toBe('Revenue');
		expect(chart.chartData?.categories).toStrictEqual(['Q1', 'Q2', 'Q3']);
		expect(chart.chartData?.series[0]).toMatchObject({ name: 'Sales', values: [10, 20, 30] });
		expect(chart.chartData?.style?.hasLegend).toBeFalsy();
	});

	it('defaults to a bar chart when no type is given', async () => {
		const { proposals, executors, bridge } = harness();
		const result = (await executors.get('create_chart')!({ slideIndex: 0 })) as {
			elementId?: string;
		};
		proposals.apply(proposals.list()[0].id);
		const chart = bridge
			.getSlides()[0]
			.elements.find((e) => e.id === result.elementId) as ChartPptxElement;
		expect(chart.chartData?.chartType).toBe('bar');
	});

	it('rejects an unknown chart type with a clear error', async () => {
		const { executors } = harness();
		await expect(
			executors.get('create_chart')!({ slideIndex: 0, chartType: 'donut' }),
		).rejects.toThrow(/Unknown chart type 'donut'/u);
	});

	it('rejects an out-of-range slide index', async () => {
		const { executors } = harness();
		await expect(
			executors.get('create_chart')!({ slideIndex: 99, chartType: 'bar' }),
		).rejects.toThrow(/out of range/u);
	});
});

describe('add_smartart tool', () => {
	it('stages a SmartArt element with the supplied node texts', async () => {
		const { bridge, proposals, executors } = harness();
		const before = bridge.getSlides()[0].elements.length;

		const result = (await executors.get('add_smartart')!({
			slideIndex: 0,
			layout: 'basicChevronProcess',
			nodes: ['Plan', 'Build', 'Ship'],
		})) as { staged?: boolean; elementId?: string };

		expect(result.staged).toBeTruthy();
		expect(bridge.edits).toHaveLength(0);

		proposals.apply(proposals.list()[0].id);
		expect(bridge.edits).toHaveLength(1);

		const elements = bridge.getSlides()[0].elements;
		expect(elements).toHaveLength(before + 1);
		const smartArt = elements.find((e) => e.id === result.elementId) as SmartArtPptxElement;
		expect(smartArt.type).toBe('smartArt');
		expect(smartArt.smartArtData?.layout).toBe('basicChevronProcess');
		expect(smartArt.smartArtData?.nodes.map((n) => n.text)).toStrictEqual([
			'Plan',
			'Build',
			'Ship',
		]);
	});

	it('falls back to the preset default items when no nodes are given', async () => {
		const { proposals, executors, bridge } = harness();
		const result = (await executors.get('add_smartart')!({
			slideIndex: 0,
			layout: 'basicCycle',
		})) as { elementId?: string };
		proposals.apply(proposals.list()[0].id);
		const smartArt = bridge
			.getSlides()[0]
			.elements.find((e) => e.id === result.elementId) as SmartArtPptxElement;
		expect(smartArt.smartArtData?.nodes.length ?? 0).toBeGreaterThan(0);
	});

	it('every advertised layout resolves to a real preset', () => {
		expect(CREATE_SMARTART_LAYOUTS.length).toBeGreaterThan(0);
	});

	it('rejects an unknown SmartArt layout with a clear error', async () => {
		const { executors } = harness();
		await expect(
			executors.get('add_smartart')!({ slideIndex: 0, layout: 'notALayout' }),
		).rejects.toThrow(/Unknown SmartArt layout 'notALayout'/u);
	});
});
