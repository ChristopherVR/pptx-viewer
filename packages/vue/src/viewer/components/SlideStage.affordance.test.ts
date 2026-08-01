/**
 * On-canvas action affordances, Vue side.
 *
 * The badge and the tooltip are painted at the STAGE boundary rather than
 * inside `ElementRenderer`, because that component dispatches every non-shape
 * type straight to a per-type view whose root is the element node. Vue's old
 * inline tooltip therefore only ever appeared on text / shape elements, while
 * React drew it on all of them; these tests pin the stage pass instead.
 */
import { mount } from '@vue/test-utils';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	ACTION_INDICATOR_CLASS,
	LINK_TOOLTIP_CLASS,
	LINK_TOOLTIP_HOST_CLASS,
} from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

function element(overrides: Partial<PptxElement>): PptxElement {
	return {
		type: 'shape',
		id: 'shape-1',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		...overrides,
	} as PptxElement;
}

function slideWith(elements: PptxElement[]): PptxSlide {
	return { id: 's1', elements } as unknown as PptxSlide;
}

async function mountStage(elements: PptxElement[], extra: Record<string, unknown> = {}) {
	const wrapper = mount(SlideStage, {
		props: {
			slide: slideWith(elements),
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			...extra,
		},
		attachTo: document.body,
	});
	await nextTick();
	await nextTick();
	return wrapper;
}

describe('slideStage action affordances', () => {
	it('badges an action shape and offers its destination tooltip', async () => {
		const wrapper = await mountStage([element({ actionClick: { url: 'https://example.test' } })], {
			interactive: true,
		});
		const node = wrapper.get('[data-element-id="shape-1"]');
		expect(node.find(`.${ACTION_INDICATOR_CLASS}`).exists()).toBeTruthy();
		expect(node.get(`.${LINK_TOOLTIP_CLASS}`).text()).toContain('https://example.test');
		expect(node.classes()).toContain(LINK_TOOLTIP_HOST_CLASS);
		wrapper.unmount();
	});

	it('badges a PICTURE too, which the old inline tooltip could never reach', async () => {
		const wrapper = await mountStage(
			[element({ id: 'pic-1', type: 'picture', actionClick: { url: 'https://example.test' } })],
			{ interactive: true },
		);
		expect(
			wrapper.get('[data-element-id="pic-1"]').find(`.${ACTION_INDICATOR_CLASS}`).exists(),
		).toBeTruthy();
		wrapper.unmount();
	});

	it('draws nothing on a static stage (thumbnail / preview)', async () => {
		const wrapper = await mountStage([element({ actionClick: { url: 'https://example.test' } })]);
		expect(wrapper.find(`.${ACTION_INDICATOR_CLASS}`).exists()).toBeFalsy();
		wrapper.unmount();
	});

	it('draws nothing while a show is running', async () => {
		const wrapper = await mountStage([element({ actionClick: { url: 'https://example.test' } })], {
			presenting: true,
		});
		expect(wrapper.find(`.${ACTION_INDICATOR_CLASS}`).exists()).toBeFalsy();
		expect(wrapper.find(`.${LINK_TOOLTIP_CLASS}`).exists()).toBeFalsy();
		wrapper.unmount();
	});

	it('draws nothing for an element with no action', async () => {
		const wrapper = await mountStage([element({})], { interactive: true });
		expect(wrapper.find(`.${ACTION_INDICATOR_CLASS}`).exists()).toBeFalsy();
		wrapper.unmount();
	});
});
