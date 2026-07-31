/**
 * Ruler-controller tests: the strips must repaint off STORE changes, not only
 * off stage renders. Toggling View > Rulers, changing the selection and zooming
 * never rebuild the stage in this binding, so a ruler wired solely into the
 * render path would silently stop tracking them.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { RULER_THICKNESS } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createRulerController } from './ruler-controller';
import type { ViewerState } from './state';
import { createInitialViewerState, createStore } from './state';

const CANVAS = { width: 960, height: 540 };

function shape(id: string): PptxElement {
	return { type: 'shape', id, x: 100, y: 50, width: 200, height: 80 } as PptxElement;
}

function slide(): PptxSlide {
	return {
		id: 'slide-1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [shape('shape-1')],
	} as PptxSlide;
}

function setup(overrides: Partial<ViewerState> = {}, scale = 1) {
	const stageWrap = document.createElement('div');
	document.body.appendChild(stageWrap);
	const store = createStore<ViewerState>({
		...createInitialViewerState(),
		slides: [slide()],
		canvasSize: CANVAS,
		editable: true,
		...overrides,
	});
	const onCreateGuide = vi.fn();
	const controller = createRulerController({
		doc: document,
		store,
		getStageWrap: () => stageWrap,
		getScale: () => scale,
		onCreateGuide,
	});
	controller.sync();
	return { stageWrap, store, controller, onCreateGuide };
}

describe('rulerController', () => {
	it('paints no ticks until the Rulers toggle goes on', () => {
		const { stageWrap, store } = setup();
		expect(stageWrap.querySelectorAll('[data-pptx-ruler="h"] text')).toHaveLength(0);

		store.set({ showRulers: true });
		expect(stageWrap.querySelectorAll('[data-pptx-ruler="h"] text').length).toBeGreaterThan(0);
		expect(stageWrap.querySelectorAll('[data-pptx-ruler="v"] text').length).toBeGreaterThan(0);
	});

	it('hides the strips again in presentation mode', () => {
		const { stageWrap, store } = setup({ showRulers: true });
		const strip = stageWrap.querySelector<SVGElement>('[data-pptx-ruler="h"]');
		expect(strip?.style.display).toBe('');

		store.set({ presenting: true });
		expect(strip?.style.display).toBe('none');
	});

	it('shades the single selected element on the strips', () => {
		const { stageWrap, store } = setup({ showRulers: true });
		expect(stageWrap.querySelector('.pptxv-ruler-highlight')).toBeNull();

		store.set({ selectedElementId: 'shape-1', selectedElementIds: ['shape-1'] });
		const highlight = stageWrap.querySelector('[data-pptx-ruler="h"] .pptxv-ruler-highlight');
		expect(highlight?.getAttribute('x')).toBe('100');
	});

	it('re-attaches the strips after the stage wrap is emptied by a render', () => {
		const { stageWrap, controller, store } = setup({ showRulers: true });
		stageWrap.replaceChildren();
		expect(stageWrap.querySelector('[data-pptx-ruler]')).toBeNull();

		controller.sync();
		expect(stageWrap.querySelectorAll('[data-pptx-ruler]')).toHaveLength(2);
		expect(store.get().showRulers).toBeTruthy();
	});

	it('routes a drag off a strip to exactly one guide', () => {
		const { stageWrap, onCreateGuide } = setup({ showRulers: true });
		const strip = stageWrap.querySelector<SVGElement>('[data-pptx-ruler="h"]');
		if (!strip) {
			throw new Error('strip missing');
		}
		strip.getBoundingClientRect = () =>
			({ top: 0, left: 0, width: 0, height: 0 }) as unknown as DOMRect;
		strip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		strip.dispatchEvent(
			new PointerEvent('pointerup', { bubbles: true, clientY: RULER_THICKNESS + 120 }),
		);
		expect(onCreateGuide).toHaveBeenCalledExactlyOnceWith('h', 120);
	});

	it('offers no guide drag on a read-only canvas', () => {
		const { stageWrap, onCreateGuide } = setup({ showRulers: true, editable: false });
		const strip = stageWrap.querySelector<SVGElement>('[data-pptx-ruler="h"]');
		if (!strip) {
			throw new Error('strip missing');
		}
		strip.getBoundingClientRect = () =>
			({ top: 0, left: 0, width: 0, height: 0 }) as unknown as DOMRect;
		strip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		strip.dispatchEvent(
			new PointerEvent('pointerup', { bubbles: true, clientY: RULER_THICKNESS + 120 }),
		);
		expect(onCreateGuide).not.toHaveBeenCalled();
	});
});
