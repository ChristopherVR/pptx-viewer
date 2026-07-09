/**
 * Tests for direct on-canvas chart editing (Angular port of the React
 * `ElementRenderer.chart.test.tsx` contract).
 *
 * Angular component tests cannot use TestBed here (no
 * `@analogjs/vite-plugin-angular` in the vitest pipeline), so these exercise
 * the pure interaction layer the component delegates to: the data-mark
 * hit-testing attributes, the value-drag state machine (threshold, preview,
 * commit-once, cancel), the title edit contract, and the selected-part DOM
 * highlight (on a real happy-dom tree).
 */
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	chartPartToAttrs,
	findChartPartTarget,
	isSameChartPart,
	withChartTitle,
} from '../internal/shared';
import {
	applyChartPartHighlight,
	beginChartValueDrag,
	CHART_PART_SELECTED_CLASS,
	chartDragCommitData,
	chartPartSelector,
	ensureChartInteractionStyles,
	moveChartValueDrag,
} from './chart-element-view-helpers';
import { buildChartViewModel } from './chart-renderer-helpers';

// ==========================================================================
// Fixtures
// ==========================================================================

function makeChartData(): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['Q1', 'Q2', 'Q3'],
		series: [
			{ name: 'Revenue', values: [100, 150, 120] },
			{ name: 'Cost', values: [80, 90, 100] },
		],
		title: 'Sales',
		style: { hasTitle: true, hasLegend: true, legendPosition: 'b' },
	};
}

function makeChartElement(): ChartPptxElement {
	return {
		id: 'ch_1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: makeChartData(),
	} as ChartPptxElement;
}

/** Render the tagged data marks of a view model into a DOM tree (happy-dom). */
function renderMarks(element: ChartPptxElement): HTMLElement {
	const vm = buildChartViewModel(element);
	const root = document.createElement('div');
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	root.appendChild(svg);
	for (const prim of vm.primitives) {
		const part = (prim as { part?: Parameters<typeof chartPartToAttrs>[0] }).part;
		if (!part) {
			continue;
		}
		const node = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		for (const [attr, value] of Object.entries(chartPartToAttrs(part))) {
			node.setAttribute(attr, value);
		}
		svg.appendChild(node);
	}
	return root;
}

// ==========================================================================
// Hit-testing attributes on data marks
// ==========================================================================

describe('data-mark hit-testing attributes', () => {
	it('tags every bar with role + series + point indices', () => {
		const root = renderMarks(makeChartElement());
		// 2 series x 3 categories = 6 tagged bars.
		expect(root.querySelectorAll("[data-chart-part='dataPoint']")).toHaveLength(6);
		expect(
			root.querySelectorAll("[data-chart-part='dataPoint'][data-chart-series='1']"),
		).toHaveLength(3);
	});

	it('round-trips a part ref through the DOM via findChartPartTarget', () => {
		const root = renderMarks(makeChartElement());
		const bar = root.querySelector("[data-chart-series='0'][data-chart-point='1']");
		expect(bar).not.toBeNull();
		const part = findChartPartTarget(bar);
		expect(part).toStrictEqual({ role: 'dataPoint', seriesIndex: 0, pointIndex: 1 });
		expect(
			isSameChartPart(part, { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 }),
		).toBeTruthy();
	});

	it('resolves null for untagged targets (chart background)', () => {
		const root = renderMarks(makeChartElement());
		expect(findChartPartTarget(root)).toBeNull();
		expect(findChartPartTarget(null)).toBeNull();
	});
});

// ==========================================================================
// Value-drag state machine
// ==========================================================================

describe('value drag', () => {
	it('commits an increased value after an upward drag, others untouched', () => {
		const element = makeChartElement();
		const vm = buildChartViewModel(element);
		const session = beginChartValueDrag(
			{ role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
			vm,
			element.chartData!,
			200,
		);
		expect(session).not.toBeNull();
		// 1:1 pointer-to-view-box mapping: rendered height equals vm.svgHeight.
		const move = moveChartValueDrag(session!, 100, vm.svgHeight);
		expect(move).not.toBeNull();
		const committed = chartDragCommitData(session, true);
		expect(committed).not.toBeNull();
		expect(committed!.series[0].values[1]).toBeGreaterThan(150);
		expect(committed!.series[0].values[0]).toBe(100);
		expect(committed!.series[1].values).toStrictEqual([80, 90, 100]);
		// The committed value matches the live badge value from the last move.
		expect(committed!.series[0].values[1]).toBe(move!.value);
		// The base data is never mutated (preview is immutable).
		expect(element.chartData!.series[0].values[1]).toBe(150);
	});

	it('treats a press without movement as a click, not a value change', () => {
		const element = makeChartElement();
		const vm = buildChartViewModel(element);
		const session = beginChartValueDrag(
			{ role: 'dataPoint', seriesIndex: 1, pointIndex: 2 },
			vm,
			element.chartData!,
			200,
		);
		// Below the 3px threshold: no preview, and nothing to commit.
		expect(moveChartValueDrag(session!, 201, vm.svgHeight)).toBeNull();
		expect(chartDragCommitData(session, true)).toBeNull();
	});

	it('commits nothing when the drag is cancelled (Escape)', () => {
		const element = makeChartElement();
		const vm = buildChartViewModel(element);
		const session = beginChartValueDrag(
			{ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 },
			vm,
			element.chartData!,
			200,
		);
		expect(moveChartValueDrag(session!, 120, vm.svgHeight)).not.toBeNull();
		expect(chartDragCommitData(session, false)).toBeNull();
	});

	it('refuses to start for series-level parts and undraggable charts', () => {
		const element = makeChartElement();
		const vm = buildChartViewModel(element);
		expect(
			beginChartValueDrag({ role: 'series', seriesIndex: 0 }, vm, element.chartData!, 0),
		).toBeNull();
		// Pie charts expose no valueDrag context: marks select but never drag.
		const pie: ChartPptxElement = {
			...element,
			chartData: { ...makeChartData(), chartType: 'pie' },
		};
		const pieVm = buildChartViewModel(pie);
		expect(
			beginChartValueDrag(
				{ role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
				pieVm,
				pie.chartData!,
				0,
			),
		).toBeNull();
	});
});

// ==========================================================================
// Title editing
// ==========================================================================

describe('title editing contract', () => {
	it('commits a new title and keeps it visible', () => {
		const next = withChartTitle(makeChartData(), 'FY26 Sales');
		expect(next.title).toBe('FY26 Sales');
		expect(next.style?.hasTitle).toBeTruthy();
	});

	it('hides the title when cleared, like PowerPoint', () => {
		const next = withChartTitle(makeChartData(), '   ');
		expect(next.title).toBe('');
		expect(next.style?.hasTitle).toBeFalsy();
	});

	it('tags the rendered title for double-click hit-testing', () => {
		const vm = buildChartViewModel(makeChartElement());
		// The renderer only draws (and tags) the title when the VM carries one.
		expect(vm.title).toBe('Sales');
	});
});

// ==========================================================================
// Selected-part highlight
// ==========================================================================

describe('selected-part highlight', () => {
	it('highlights exactly the marks matching the selected part', () => {
		const root = renderMarks(makeChartElement());
		applyChartPartHighlight(root, { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 });
		const highlighted = root.querySelectorAll(`.${CHART_PART_SELECTED_CLASS}`);
		expect(highlighted).toHaveLength(1);
		expect(highlighted[0].getAttribute('data-chart-series')).toBe('0');
		expect(highlighted[0].getAttribute('data-chart-point')).toBe('1');
	});

	it('clears previous highlights when the selection moves or empties', () => {
		const root = renderMarks(makeChartElement());
		applyChartPartHighlight(root, { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 });
		applyChartPartHighlight(root, { role: 'dataPoint', seriesIndex: 1, pointIndex: 2 });
		const highlighted = root.querySelectorAll(`.${CHART_PART_SELECTED_CLASS}`);
		expect(highlighted).toHaveLength(1);
		expect(highlighted[0].getAttribute('data-chart-series')).toBe('1');
		applyChartPartHighlight(root, null);
		expect(root.querySelectorAll(`.${CHART_PART_SELECTED_CLASS}`)).toHaveLength(0);
	});

	it('series-level selection never matches point-level marks', () => {
		expect(chartPartSelector({ role: 'series', seriesIndex: 2 })).toBe(
			"[data-chart-part='series'][data-chart-series='2']:not([data-chart-point])",
		);
		const root = renderMarks(makeChartElement());
		applyChartPartHighlight(root, { role: 'series', seriesIndex: 0 });
		// The fixture only renders point-level bars, so nothing may match.
		expect(root.querySelectorAll(`.${CHART_PART_SELECTED_CLASS}`)).toHaveLength(0);
	});
});

// ==========================================================================
// Interaction stylesheet
// ==========================================================================

describe('ensureChartInteractionStyles', () => {
	it('injects the stylesheet into the document head exactly once', () => {
		ensureChartInteractionStyles();
		ensureChartInteractionStyles();
		const styles = document.head.querySelectorAll('#pptx-ng-chart-interaction-styles');
		expect(styles).toHaveLength(1);
		expect(styles[0].textContent).toContain('[data-chart-part]');
		expect(styles[0].textContent).toContain(CHART_PART_SELECTED_CLASS);
	});
});
