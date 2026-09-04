/**
 * G8 (OpenXML parity audit, D3): `a:graphicFrameLocks/@noDrilldown` was
 * parsed but never enforced - double-clicking the title still opened the
 * inline editor on a locked chart.
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function chartElement(overrides: Partial<PptxElement> = {}): PptxElement {
	const chartData: PptxChartData = {
		chartType: 'bar',
		categories: ['Q1', 'Q2'],
		series: [{ name: 'North', values: [10, 20] }],
		title: 'Sales',
		style: { hasTitle: true },
	};
	return {
		type: 'chart',
		id: 'el-chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
		...overrides,
	} as PptxElement;
}

function mountChart(element: PptxElement): {
	target: HTMLElement;
	onchartpointcommit: ReturnType<typeof vi.fn>;
} {
	const onchartpointcommit = vi.fn();
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: {
			element,
			mediaDataUrls: new Map<string, string>(),
			zIndex: 0,
			interactive: true,
			selectedElementIds: [element.id],
			onchartpointcommit,
		},
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, onchartpointcommit };
}

describe('chart title drilldown with a:graphicFrameLocks/@noDrilldown', () => {
	it('does not open the title editor on double-click when noDrilldown is set', () => {
		const locked = chartElement({ locks: { noDrilldown: true } } as Partial<PptxElement>);
		const { target } = mountChart(locked);
		const root = target.querySelector('[data-element-id="el-chart"]') as HTMLElement;
		const title = root.querySelector("[data-chart-part='title']")!;
		title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		flushSync();
		expect(target.querySelector('input')).toBeNull();
	});

	it('opens the title editor on double-click on an unlocked chart', () => {
		const { target } = mountChart(chartElement());
		const root = target.querySelector('[data-element-id="el-chart"]') as HTMLElement;
		const title = root.querySelector("[data-chart-part='title']")!;
		title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		flushSync();
		expect(target.querySelector('input')).not.toBeNull();
	});
});
