// oxlint-disable react-hooks/rules-of-hooks -- Vue composable, not a React hook
import type { PptxElement } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { useMarqueeSelection } from './useMarqueeSelection';

/**
 * Rubber-band selection, which Vue simply did not have: dragging across empty
 * canvas selected nothing, so Group / Align / Distribute were unreachable in a
 * single gesture and the cross-binding parity spec reported Vue as offering no
 * usable Group at all.
 */

const CANVAS = { width: 1000, height: 500 };

function element(id: string, x: number, width = 100): PptxElement {
	return { id, type: 'shape', x, y: 100, width, height: 100 } as unknown as PptxElement;
}

const ELEMENTS = [element('a', 0), element('b', 200), element('c', 800)];

/** A stage that is on screen at 1:1, so slide space and client space agree. */
function mountStage(scale = 1): HTMLElement {
	const stage = document.createElement('div');
	stage.setAttribute('aria-roledescription', 'slide');
	stage.getBoundingClientRect = () =>
		({
			left: 0,
			top: 0,
			width: CANVAS.width * scale,
			height: CANVAS.height * scale,
		}) as DOMRect;
	document.body.appendChild(stage);
	return stage;
}

function press(stage: HTMLElement, x: number, y: number, modifier = false): PointerEvent {
	const event = new MouseEvent('pointerdown', {
		clientX: x,
		clientY: y,
		shiftKey: modifier,
	}) as unknown as PointerEvent;
	Object.defineProperty(event, 'pointerId', { value: 1 });
	Object.defineProperty(event, 'target', { value: stage });
	return event;
}

function move(kind: 'pointermove' | 'pointerup', x: number, y: number): void {
	const event = new MouseEvent(kind, { clientX: x, clientY: y });
	Object.defineProperty(event, 'pointerId', { value: 1 });
	window.dispatchEvent(event);
}

function setup(selected: string[] = []) {
	const selectedElementIds = ref<string[]>(selected);
	const menu = useMarqueeSelection({
		getSelectableElements: () => ELEMENTS,
		getCanvasSize: () => CANVAS,
		selectedElementIds,
	});
	return { ...menu, selectedElementIds };
}

afterEach(() => {
	for (const node of Array.from(document.body.children)) {
		node.remove();
	}
});

describe('useMarqueeSelection', () => {
	it('selects every element the band covers', () => {
		const stage = mountStage();
		const { beginMarquee, selectedElementIds } = setup();

		expect(beginMarquee(press(stage, 0, 90))).toBeTruthy();
		move('pointermove', 320, 260);
		move('pointerup', 320, 260);

		expect(selectedElementIds.value).toStrictEqual(['a', 'b']);
	});

	it('tracks the band in slide space while the stage is zoomed', () => {
		const stage = mountStage(2);
		const { beginMarquee, marquee } = setup();

		beginMarquee(press(stage, 100, 100));
		move('pointermove', 300, 400);

		// Client 100..300 at 2x is slide 50..150.
		expect(marquee.value).toStrictEqual({ x: 50, y: 50, width: 100, height: 150 });
		move('pointerup', 300, 400);
		expect(marquee.value).toBeNull();
	});

	it('extends the existing selection when the press carries a modifier', () => {
		const stage = mountStage();
		const { beginMarquee, selectedElementIds } = setup(['c']);

		beginMarquee(press(stage, 0, 90, true));
		move('pointerup', 320, 260);

		expect(selectedElementIds.value).toStrictEqual(['c', 'a', 'b']);
	});

	it('clears the selection when the band covers nothing', () => {
		const stage = mountStage();
		const { beginMarquee, selectedElementIds } = setup(['a']);

		beginMarquee(press(stage, 400, 400));
		move('pointerup', 500, 450);

		expect(selectedElementIds.value).toStrictEqual([]);
	});

	it('does not start on a press that missed the stage', () => {
		const outside = document.createElement('div');
		document.body.appendChild(outside);
		const { beginMarquee, marquee } = setup();

		expect(beginMarquee(press(outside, 10, 10))).toBeFalsy();
		expect(marquee.value).toBeNull();
	});

	it('drops its listeners when cancelled mid-drag', () => {
		const stage = mountStage();
		const { beginMarquee, cancelMarquee, marquee, selectedElementIds } = setup();

		beginMarquee(press(stage, 0, 90));
		cancelMarquee();
		move('pointerup', 320, 260);

		expect(marquee.value).toBeNull();
		expect(selectedElementIds.value).toStrictEqual([]);
	});
});
