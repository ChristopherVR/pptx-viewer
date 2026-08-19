import { mount } from '@vue/test-utils';
import type { ChartViewModel } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import ChartViewModelSvg from './ChartViewModelSvg.vue';

/**
 * Regression coverage for hover-tooltip text on chart marks.
 *
 * Only the region map's `path` primitives used to carry a `title`. Every
 * other mark kind (bar/line/area/scatter/bubble/pie/radar) rendered no hover
 * tooltip at all, because the projector only emitted an SVG `<title>` child
 * inside the `path` branch. This asserts every mark-bearing primitive kind
 * (rect / circle / polyline / polygon / line) now does the same.
 */

function baseViewModel(overrides: Partial<ChartViewModel>): ChartViewModel {
	return {
		svgWidth: 400,
		svgHeight: 300,
		title: undefined,
		titleX: 200,
		titleY: 12,
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: [],
		primitives: [],
		dataLabels: [],
		legend: [],
		legendX: 200,
		legendY: 292,
		legendAnchor: 'middle',
		...overrides,
	};
}

function mountVm(vm: ChartViewModel) {
	return mount(ChartViewModelSvg, { props: { elementId: 'c1', vm } });
}

describe('chartViewModelSvg: mark tooltips', () => {
	it('renders a <title> child for a titled rect (bar mark)', () => {
		const wrapper = mountVm(
			baseViewModel({
				primitives: [
					{ kind: 'rect', x: 0, y: 0, w: 10, h: 10, fill: '#4472C4', title: 'Revenue, Q1: 100' },
				],
			}),
		);
		expect(wrapper.find('rect title').text()).toBe('Revenue, Q1: 100');
	});

	it('renders a <title> child for a titled circle (line/scatter/bubble mark)', () => {
		const wrapper = mountVm(
			baseViewModel({
				primitives: [
					{ kind: 'circle', cx: 5, cy: 5, r: 3, fill: '#4472C4', title: 'Trend, Jan: 10' },
				],
			}),
		);
		expect(wrapper.find('circle title').text()).toBe('Trend, Jan: 10');
	});

	it('renders a <title> child for a titled polyline (area outline mark)', () => {
		const wrapper = mountVm(
			baseViewModel({
				primitives: [
					{
						kind: 'polyline',
						points: '0,0 10,0',
						stroke: '#4472C4',
						strokeWidth: 1,
						fill: 'none',
						title: 'Series 1',
					},
				],
			}),
		);
		expect(wrapper.find('polyline title').text()).toBe('Series 1');
	});

	it('renders a <title> child for a titled polygon (radar series mark)', () => {
		const wrapper = mountVm(
			baseViewModel({
				primitives: [
					{
						kind: 'polygon',
						points: '0,0 10,0 5,10',
						fill: '#4472C4',
						stroke: '#4472C4',
						strokeWidth: 1,
						title: 'Player 1',
					},
				],
			}),
		);
		expect(wrapper.find('polygon title').text()).toBe('Player 1');
	});

	it('renders a <title> child for a titled line primitive', () => {
		const wrapper = mountVm(
			baseViewModel({
				primitives: [
					{
						kind: 'line',
						x1: 0,
						y1: 0,
						x2: 10,
						y2: 10,
						stroke: '#4472C4',
						strokeWidth: 1,
						title: 'Delta',
					},
				],
			}),
		);
		expect(wrapper.find('line title').text()).toBe('Delta');
	});

	it('omits a <title> child when a primitive has no title', () => {
		const wrapper = mountVm(
			baseViewModel({ primitives: [{ kind: 'rect', x: 0, y: 0, w: 10, h: 10, fill: '#4472C4' }] }),
		);
		expect(wrapper.find('rect title').exists()).toBeFalsy();
	});
});
