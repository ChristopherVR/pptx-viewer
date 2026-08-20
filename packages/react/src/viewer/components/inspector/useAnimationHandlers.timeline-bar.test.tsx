// @vitest-environment happy-dom
/**
 * Regression coverage for `timelineBarData`: the hook now delegates the
 * left/width percentage maths to shared's `buildAnimationTimelineBars`
 * (`pptx-viewer-shared`) instead of computing it locally. This mounts the
 * real hook so a future re-introduction of a local computation (or a broken
 * hand-off to the shared helper) shows up here, not just in shared's own
 * unit tests.
 */
/* oxlint-disable eslint/one-var -- each `it`/fixture block below declares its
   own independent locals; merging unrelated declarations across these test
   cases would hurt readability, not help it. */
import type { PptxElement, PptxElementAnimation, PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAnimationHandlers } from './useAnimationHandlers';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

type TimelineBarData = ReturnType<typeof useAnimationHandlers>['timelineBarData'];

function renderHarness(
	activeSlide: PptxSlide,
	selectedElement: PptxElement,
	onRender: (bars: TimelineBarData) => void,
): void {
	function Harness(): null {
		const handlers = useAnimationHandlers({
			selectedElement,
			activeSlide,
			canEdit: true,
			onUpdateSlide: () => {},
		});
		onRender(handlers.timelineBarData);
		return null;
	}
	act(() => {
		root.render(<Harness />);
	});
}

function captureTimelineBarData(
	activeSlide: PptxSlide,
	selectedElement: PptxElement,
): TimelineBarData {
	let captured: TimelineBarData = [];
	renderHarness(activeSlide, selectedElement, (bars) => {
		captured = bars;
	});
	return captured;
}

describe('useAnimationHandlers timelineBarData', () => {
	it('returns empty for a slide with no animations', () => {
		const element = { id: 'a', type: 'shape', x: 0, y: 0, width: 1, height: 1 } as PptxElement;
		const slide = { elements: [element], animations: [] } as unknown as PptxSlide;
		expect(captureTimelineBarData(slide, element)).toStrictEqual([]);
	});

	it('computes left/width percentages against the longest end time', () => {
		const elementA = { id: 'a', type: 'shape', x: 0, y: 0, width: 1, height: 1 } as PptxElement;
		const elementB = { id: 'b', type: 'shape', x: 0, y: 0, width: 1, height: 1 } as PptxElement;
		const animations: PptxElementAnimation[] = [
			{ elementId: 'a', order: 0, delayMs: 0, durationMs: 500, trigger: 'onClick' },
			{ elementId: 'b', order: 1, delayMs: 500, durationMs: 500, trigger: 'onClick' },
		];
		const slide = { elements: [elementA, elementB], animations } as unknown as PptxSlide;
		const bars = captureTimelineBarData(slide, elementA);
		expect(bars).toHaveLength(2);
		expect(bars[0]).toMatchObject({ leftPercent: 0, widthPercent: 50 });
		expect(bars[0].anim.elementId).toBe('a');
		expect(bars[1]).toMatchObject({ leftPercent: 50, widthPercent: 50 });
		expect(bars[1].anim.elementId).toBe('b');
	});
});
