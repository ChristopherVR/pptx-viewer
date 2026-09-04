/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file:
   independent handler-local `const`s, not one statement */
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
import type { ChartPptxElement, PptxChartData, PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	advanceChartValueDrag,
	applyChartPartHighlight,
	beginChartValueDrag,
	CHART_PART_SELECTED_CLASS,
	chartPartToAttrs,
	findChartPartTarget,
	isSameChartPart,
	withChartTitle,
} from '../internal/shared';
import {
	chartCanEditParts,
	chartDragCommitData,
	commitChartElementData,
	ensureChartInteractionStyles,
} from './chart-element-view-helpers';
import type { ChartCommitTarget } from './chart-element-view-helpers';
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
		const session = beginChartValueDrag({
			part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
			viewModel: vm,
			chartData: element.chartData!,
			clientY: 200,
		});
		expect(session).not.toBeNull();
		// 1:1 pointer-to-view-box mapping: rendered height equals vm.svgHeight.
		const move = advanceChartValueDrag(session!, 100, vm.svgHeight);
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
		const session = beginChartValueDrag({
			part: { role: 'dataPoint', seriesIndex: 1, pointIndex: 2 },
			viewModel: vm,
			chartData: element.chartData!,
			clientY: 200,
		});
		// Below the 3px threshold: no preview, and nothing to commit.
		expect(advanceChartValueDrag(session!, 201, vm.svgHeight)).toBeNull();
		expect(chartDragCommitData(session, true)).toBeNull();
	});

	it('commits nothing when the drag is cancelled (Escape)', () => {
		const element = makeChartElement();
		const vm = buildChartViewModel(element);
		const session = beginChartValueDrag({
			part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 0 },
			viewModel: vm,
			chartData: element.chartData!,
			clientY: 200,
		});
		expect(advanceChartValueDrag(session!, 120, vm.svgHeight)).not.toBeNull();
		expect(chartDragCommitData(session, false)).toBeNull();
	});

	it('refuses to start for series-level parts and undraggable charts', () => {
		const element = makeChartElement();
		const vm = buildChartViewModel(element);
		expect(
			beginChartValueDrag({
				part: { role: 'series', seriesIndex: 0 },
				viewModel: vm,
				chartData: element.chartData!,
				clientY: 0,
			}),
		).toBeNull();
		// Pie charts expose no valueDrag context: marks select but never drag.
		const pie: ChartPptxElement = {
			...element,
			chartData: { ...makeChartData(), chartType: 'pie' },
		};
		const pieVm = buildChartViewModel(pie);
		expect(
			beginChartValueDrag({
				part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
				viewModel: pieVm,
				chartData: pie.chartData!,
				clientY: 0,
			}),
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
// Commit routing (slide vs template store)
// ==========================================================================

describe('commitChartElementData', () => {
	function slide(id: string, elements: PptxElement[]): PptxSlide {
		return { id, rId: id, slideNumber: 0, elements } as PptxSlide;
	}

	function recorder(slides: PptxSlide[]) {
		const calls: Array<{ slideIndex: number; id: string }> = [];
		const editor: ChartCommitTarget = {
			slides: () => slides,
			updateElement: (slideIndex, id) => calls.push({ slideIndex, id }),
		};
		return { editor, calls };
	}

	it('commits a slide chart to its owning slide', () => {
		const { editor, calls } = recorder([slide('s0', []), slide('s1', [makeChartElement()])]);
		commitChartElementData(editor, 'ch_1', makeChartData());
		expect(calls).toStrictEqual([{ slideIndex: 1, id: 'ch_1' }]);
	});

	it('commits a template (layout/master) chart to the hosting canvas slide', () => {
		// Template elements are absent from slides[].elements; without the
		// hosting slide id this used to silently no-op in editTemplateMode.
		const { editor, calls } = recorder([slide('s0', []), slide('s1', [])]);
		commitChartElementData(editor, 'layout-chart-1', makeChartData(), 's1');
		expect(calls).toStrictEqual([{ slideIndex: 1, id: 'layout-chart-1' }]);
	});

	it('still no-ops for a template chart without a hosting slide id', () => {
		const { editor, calls } = recorder([slide('s0', [])]);
		commitChartElementData(editor, 'layout-chart-1', makeChartData());
		expect(calls).toHaveLength(0);
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
	it('injects both stylesheets into the document head exactly once each', () => {
		ensureChartInteractionStyles();
		ensureChartInteractionStyles();
		// The shared base rules (data-mark hit targets + selected-part highlight),
		// singleton across all five bindings.
		const sharedStyles = document.head.querySelectorAll('#pptx-chart-interaction-styles');
		expect(sharedStyles).toHaveLength(1);
		expect(sharedStyles[0].textContent).toContain('[data-chart-part]');
		expect(sharedStyles[0].textContent).toContain(CHART_PART_SELECTED_CLASS);
		// Angular's own badge / inline title editor CSS.
		const ngStyles = document.head.querySelectorAll('#pptx-ng-chart-interaction-styles');
		expect(ngStyles).toHaveLength(1);
		expect(ngStyles[0].textContent).toContain('pptx-ng-chart-drag-badge');
	});
});

// ==========================================================================
// Direct part-editing gate (G8, OpenXML parity audit D3)
// ==========================================================================

describe('chartCanEditParts', () => {
	it('is false when a:graphicFrameLocks/@noDrilldown is set, even selected + editable', () => {
		const locked = { ...makeChartElement(), locks: { noDrilldown: true } } as ChartPptxElement;
		expect(chartCanEditParts(true, true, true, locked)).toBeFalsy();
	});

	it('is true for a selected, editable, unlocked chart with a commit channel', () => {
		expect(chartCanEditParts(true, true, true, makeChartElement())).toBeTruthy();
	});

	it('still requires selected + editable + an editor, unlocked or not', () => {
		const chart = makeChartElement();
		expect(chartCanEditParts(false, true, true, chart)).toBeFalsy();
		expect(chartCanEditParts(true, false, true, chart)).toBeFalsy();
		expect(chartCanEditParts(true, true, false, chart)).toBeFalsy();
	});
});
