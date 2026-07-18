import { mount } from '@vue/test-utils';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

function shape(id: string): PptxElement {
	return {
		type: 'shape',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		text: id,
	} as PptxElement;
}

function slideWith(elements: PptxElement[]): PptxSlide {
	return { id: 's1', elements } as unknown as PptxSlide;
}

function mountStage(extra: Record<string, unknown> = {}) {
	return mount(SlideStage, {
		props: {
			slide: slideWith([shape('shape-1')]),
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			...extra,
		},
	});
}

describe('slideStage accessibility contract', () => {
	// The e2e contract is ONE aria-roledescription="slide" region per surface.
	// On the editable canvas that region is the SlideCanvas wrapper, so the
	// interactive stage itself must NOT self-label (mirrors React, where only
	// SlideCanvas.tsx carries the roledescription).
	it('does not label the interactive stage as a slide region (the canvas wrapper owns it)', () => {
		const wrapper = mountStage({ interactive: true });
		const stage = wrapper.get('.pptx-vue-stage');
		expect(stage.attributes('aria-roledescription')).toBeUndefined();
		expect(stage.attributes('role')).toBeUndefined();
		expect(stage.attributes('aria-hidden')).toBeUndefined();
	});

	it('labels the standalone presentation stage as the slide region', () => {
		const wrapper = mountStage({ presenting: true });
		const stage = wrapper.get('.pptx-vue-stage');
		expect(stage.attributes('aria-roledescription')).toBe('slide');
		expect(stage.attributes('role')).toBe('region');
		expect(stage.attributes('aria-hidden')).toBeUndefined();
	});

	it('hides static stages (thumbnails/previews) from the accessibility tree', () => {
		const wrapper = mountStage();
		const stage = wrapper.get('.pptx-vue-stage');
		expect(stage.attributes('aria-roledescription')).toBeUndefined();
		expect(stage.attributes('aria-hidden')).toBe('true');
	});
});

describe('slideStage element-id markers', () => {
	// Only the real canvas / presentation stage may expose `data-element-id`:
	// e2e specs and internal document-wide queries rely on the first match
	// being the interactive copy, not a thumbnail's.
	it('keeps data-element-id on the interactive stage', async () => {
		const wrapper = mountStage({ interactive: true });
		await nextTick();
		expect(wrapper.find('[data-element-id="shape-1"]').exists()).toBeTruthy();
	});

	it('keeps data-element-id on the presenting stage', async () => {
		const wrapper = mountStage({ presenting: true });
		await nextTick();
		expect(wrapper.find('[data-element-id="shape-1"]').exists()).toBeTruthy();
	});

	it('strips data-element-id from static stages after render', async () => {
		const wrapper = mountStage();
		await nextTick();
		expect(wrapper.find('[data-element-id]').exists()).toBeFalsy();
		// The element itself still renders; only the marker is removed.
		expect(wrapper.text()).toContain('shape-1');
	});

	it('re-strips markers when the rendered element set changes', async () => {
		const wrapper = mountStage();
		await nextTick();
		await wrapper.setProps({ slide: slideWith([shape('shape-1'), shape('shape-2')]) });
		await nextTick();
		expect(wrapper.find('[data-element-id]').exists()).toBeFalsy();
		expect(wrapper.text()).toContain('shape-2');
	});
});
