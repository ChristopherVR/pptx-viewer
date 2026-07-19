import type { PptxSlide } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SlideCanvas from './SlideCanvas.svelte';

/**
 * SlideCanvas AI pick-mode interception: while the AI panel is picking, a click
 * on a slide element is routed to the assistant's focus (via `onaipickelement`)
 * instead of selecting / editing, and the stage-holder marks itself for the
 * crosshair cursor + colour tween.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function shapeSlide(): PptxSlide {
	return {
		id: 's1',
		slideNumber: 1,
		elements: [
			{
				id: 'ppt/slides/slide1.xml-shape-1',
				type: 'shape',
				x: 20,
				y: 20,
				width: 200,
				height: 120,
				shapeType: 'rect',
			},
		],
	} as unknown as PptxSlide;
}

function mountCanvas(props: Record<string, unknown>): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(SlideCanvas, {
		target,
		props: {
			slide: shapeSlide(),
			canvasSize: { width: 960, height: 540 },
			mediaDataUrls: new Map<string, string>(),
			scale: 1,
			editingActive: true,
			...props,
		},
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('slideCanvas AI pick mode', () => {
	it('routes an element click to onaipickelement and marks the stage', () => {
		const onaipickelement = vi.fn();
		const onstagepointerdown = vi.fn();
		const target = mountCanvas({
			aiPickMode: true,
			aiActive: true,
			onaipickelement,
			onstagepointerdown,
		});

		const holder = target.querySelector('.pptx-svelte-stage-holder') as HTMLElement;
		expect(holder.getAttribute('data-ai-pick-mode')).toBe('true');
		expect(holder.getAttribute('data-pptx-ai-active')).toBe('true');
		expect(holder.classList.contains('pptx-svelte-ai-picking')).toBeTruthy();

		const el = target.querySelector('[data-element-id="ppt/slides/slide1.xml-shape-1"]');
		expect(el).not.toBeNull();
		el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

		expect(onaipickelement).toHaveBeenCalledWith('ppt/slides/slide1.xml-shape-1');
		// A pick must not start a selection drag.
		expect(onstagepointerdown).not.toHaveBeenCalled();
	});

	it('does not intercept clicks when pick mode is off', () => {
		const onaipickelement = vi.fn();
		const target = mountCanvas({ aiPickMode: false, onaipickelement });
		const holder = target.querySelector('.pptx-svelte-stage-holder') as HTMLElement;
		expect(holder.getAttribute('data-ai-pick-mode')).toBeNull();
		const el = target.querySelector('[data-element-id="ppt/slides/slide1.xml-shape-1"]');
		el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(onaipickelement).not.toHaveBeenCalled();
	});
});
