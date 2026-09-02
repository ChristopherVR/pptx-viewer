// @vitest-environment happy-dom
/**
 * `PresentationStage` stacks a slide's elements ABOVE its master/layout shapes
 * (`zIndex = templateElements.length + index`), so a morph's stacking-order
 * journeys have to be written in that offset space. This pins the WIRING: the
 * incoming slide's template count reaches `buildMorphTransitionPlan` as
 * `zIndexBase`. The journey maths itself is covered in shared
 * (`morph-z-order.test.ts`).
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import React, { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { usePresentationMode } from './usePresentationMode';
import type { UsePresentationModeResult } from './usePresentationMode';

const buildMorphTransitionPlan = vi.hoisted(() => vi.fn());

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	buildMorphTransitionPlan.mockImplementation(actual.buildMorphTransitionPlan);
	return { ...actual, buildMorphTransitionPlan };
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	buildMorphTransitionPlan.mockClear();
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

function shape(id: string): PptxElement {
	return { id, type: 'shape', x: 0, y: 0, width: 100, height: 100 } as PptxElement;
}

const slides: PptxSlide[] = [
	{ id: 's1', rId: 'rId1', elements: [shape('a')] } as PptxSlide,
	{
		id: 's2',
		rId: 'rId2',
		elements: [shape('b')],
		transition: { type: 'morph', duration: 500 },
	} as PptxSlide,
];

const templateElementsBySlideId: Record<string, PptxElement[]> = {
	s1: [shape('layout-1')],
	s2: [shape('layout-2'), shape('layout-3'), shape('layout-4')],
};

let latest: UsePresentationModeResult | undefined;

function Harness(): React.ReactElement {
	const containerRef = useRef<HTMLDivElement | null>(null);
	latest = usePresentationMode({
		mode: 'present',
		slides,
		templateElementsBySlideId,
		visibleSlideIndexes: [0, 1],
		activeSlideIndex: 0,
		containerRef,
		onSetMode: () => {},
		onSetActiveSlideIndex: () => {},
	});
	return <div ref={containerRef} />;
}

describe('usePresentationMode morph z-index base', () => {
	it("hands the incoming slide's template count to the morph plan as zIndexBase", () => {
		act(() => {
			root.render(<Harness />);
		});
		act(() => {
			latest?.movePresentationSlide(1);
		});
		expect(latest?.transitionOverlay?.transition.type).toBe('morph');
		// Slide 2 sits on three template shapes, so its first element is z 3.
		expect(buildMorphTransitionPlan).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: 's1' }),
			expect.objectContaining({ id: 's2' }),
			500,
			'object',
			{ zIndexBase: 3 },
		);
	});
});
