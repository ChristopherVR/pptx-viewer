import { mount } from '@vue/test-utils';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import type { CanvasSize } from '../types';
import PresentationMode from './PresentationMode.vue';

/**
 * A click on a shape carrying an Action Setting must FOLLOW the action and stop
 * there; only a click on inert slide content advances the show. The reporter's
 * deck (`e2e/fixtures/solution-explorer.pptx`) navigates entirely through such
 * shapes - a wheel of eight `ppaction://hlinksldjump` slices - and this binding
 * used to step to the NEXT slide on every one of them, so the red arrow in the
 * hub swept to the wrong position on every click.
 */

const canvasSize: CanvasSize = { width: 960, height: 540 };

function actionShape(id: string, actionClick?: PptxElement['actionClick']): PptxElement {
	return {
		type: 'shape',
		id,
		name: id,
		x: 10,
		y: 10,
		width: 100,
		height: 100,
		actionClick,
	} as PptxElement;
}

function slideWith(id: string, elements: PptxElement[], transition?: PptxSlide['transition']) {
	return { id, rId: `r-${id}`, elements, backgroundColor: '#ffffff', transition } as PptxSlide;
}

function mountShow(first: PptxSlide) {
	return mount(PresentationMode, {
		props: {
			slides: [first, slideWith('s2', []), slideWith('s3', []), slideWith('s4', [])],
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			startIndex: 0,
		},
		attachTo: document.body,
	});
}

/** Click the rendered node of `elementId` inside the presentation overlay. */
function clickElement(elementId: string): void {
	const overlay = document.querySelector('.pptx-vue-presentation');
	const node = overlay?.querySelector<HTMLElement>(`[data-element-id="${elementId}"]`);
	expect(node).not.toBeNull();
	node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('presentationMode action clicks', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('follows a slice’s slide jump instead of advancing the show', async () => {
		const wrapper = mountShow(
			slideWith('s1', [
				actionShape('slice', { action: 'ppaction://hlinksldjump', targetSlideIndex: 3 }),
			]),
		);
		await wrapper.vm.$nextTick();
		clickElement('slice');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.[0]).toStrictEqual([3]);
		wrapper.unmount();
	});

	it('still advances on a click on inert slide content', async () => {
		const wrapper = mountShow(slideWith('s1', [actionShape('art')]));
		await wrapper.vm.$nextTick();
		clickElement('art');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.[0]).toStrictEqual([1]);
		wrapper.unmount();
	});

	it('does not advance on a click when the slide sets advClick="0"', async () => {
		const wrapper = mountShow(
			slideWith('s1', [actionShape('art')], { type: 'fade', advanceOnClick: false }),
		);
		await wrapper.vm.$nextTick();
		clickElement('art');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')).toBeUndefined();
		wrapper.unmount();
	});

	it('leaves an "Action: None" shape to the show’s own click-to-advance', async () => {
		const wrapper = mountShow(
			slideWith('s1', [actionShape('dead', { action: 'ppaction://noaction' })]),
		);
		await wrapper.vm.$nextTick();
		clickElement('dead');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.[0]).toStrictEqual([1]);
		wrapper.unmount();
	});
});
