import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * Chart marks must be pointer-armed (`pptx-chart-interactive`) only while the
 * chart is SELECTED (wave-4 B3): armed as soon as the canvas was merely
 * editable, a mark's own `stopPropagation` on pointerdown ate the FIRST click
 * on an unselected chart, so it could never be selected by clicking a mark.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function chartElement(): PptxElement {
	const chartData: PptxChartData = {
		chartType: 'bar',
		categories: ['Q1', 'Q2'],
		series: [{ name: 'North', values: [10, 20] }],
		style: {},
	};
	return { type: 'chart', id: 'el-chart', x: 0, y: 0, width: 400, height: 300, chartData };
}

function mountChart(selectedElementIds: readonly string[] | undefined): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: {
			element: chartElement(),
			mediaDataUrls: new Map<string, string>(),
			zIndex: 0,
			interactive: true,
			selectedElementIds,
			onchartpointcommit: vi.fn(),
		},
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('chartView selection-gated interactivity', () => {
	it('does not arm pptx-chart-interactive while the chart is unselected', () => {
		const target = mountChart([]);
		const root = target.querySelector('[data-element-id="el-chart"]');
		expect(root?.classList.contains('pptx-chart-interactive')).toBeFalsy();
	});

	it('arms pptx-chart-interactive once the chart is selected', () => {
		const target = mountChart(['el-chart']);
		const root = target.querySelector('[data-element-id="el-chart"]');
		expect(root?.classList.contains('pptx-chart-interactive')).toBeTruthy();
	});

	it('does not intercept pointerdown on an unselected chart, so the click reaches the stage selection handler', () => {
		const target = mountChart([]);
		const root = target.querySelector('[data-element-id="el-chart"]') as HTMLElement;
		const mark = root.querySelector('[data-chart-part="dataPoint"]') as SVGElement;
		let bubbled = false;
		target.addEventListener('pointerdown', () => {
			bubbled = true;
		});
		mark.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientY: 10 }));
		expect(bubbled).toBeTruthy();
	});
});
