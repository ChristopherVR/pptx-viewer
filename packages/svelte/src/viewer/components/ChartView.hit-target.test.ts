import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ChartView from './ChartView.svelte';

/**
 * Issue #285 follow-up: `ElementRenderer` originally only mounted the
 * degenerate-shape hit target overlay on its own text/shape branch. A chart
 * delegates to `ChartView` and never got one, so a sub-MIN_ELEMENT_SIZE chart
 * stayed ungrabbable on the editing canvas. `ChartView` now renders the same
 * `[data-pptx-hit-target]` overlay, gated by the shared
 * `shouldRenderHitTarget(editable, presenting)` (kept apart from this
 * component's own `chartEditable`, which gates drilldown point-editing).
 */

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
});

/** A degenerate chart: 400 wide, sub-MIN_ELEMENT_SIZE tall. */
function thinChart(): PptxElement {
	return {
		type: 'chart',
		id: 'chart-thin',
		x: 0,
		y: 0,
		width: 400,
		height: 1,
		chartData: {
			chartType: 'bar',
			series: [{ name: 'S1', values: [1, 2, 3] }],
			categories: ['A', 'B', 'C'],
		},
	} as unknown as PptxElement;
}

function render(element: PptxElement, props: Record<string, unknown> = {}): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted = mount(ChartView, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1, ...props },
	});
	flushSync();
	return target;
}

describe('chartView degenerate hit target (issue #285)', () => {
	it('adds an invisible, bigger hit target only while editable and not presenting', () => {
		const target = render(thinChart(), { editable: true, presenting: false });
		const hitTarget = target.querySelector<HTMLElement>('[data-pptx-hit-target]');
		expect(hitTarget).not.toBeNull();
		expect(hitTarget?.style.pointerEvents).toBe('auto');
		expect(hitTarget?.style.height).toBe('12px');
	});

	it('never adds the hit target on a read-only (non-editable) render', () => {
		const target = render(thinChart(), { editable: false, presenting: false });
		expect(target.querySelector('[data-pptx-hit-target]')).toBeNull();
	});

	it('never adds the hit target while presenting', () => {
		const target = render(thinChart(), { editable: true, presenting: true });
		expect(target.querySelector('[data-pptx-hit-target]')).toBeNull();
	});
});
