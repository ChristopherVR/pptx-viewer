import { mount } from '@vue/test-utils';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { FieldSubstitutionContext } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import { FieldContextKey } from '../composables/field-context';
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

/**
 * Motion-path keyframes translate by a fraction of the SLIDE, expressed as
 * `calc(var(--pptx-slide-w) * f)`. A CSS `translate(%)` would have resolved
 * against the element's own box instead, so a small shape barely moved. The
 * stage is what publishes the slide size those calc() offsets read.
 */
describe('slideStage slide-size custom properties', () => {
	it('publishes the slide size for motion-path keyframes', () => {
		const style = mountStage({ interactive: true }).get('.pptx-vue-stage').attributes('style');
		expect(style).toContain('--pptx-slide-w: 960px');
		expect(style).toContain('--pptx-slide-h: 540px');
	});

	it('publishes it on the presentation stage too', () => {
		const style = mountStage({ presenting: true }).get('.pptx-vue-stage').attributes('style');
		expect(style).toContain('--pptx-slide-w: 960px');
		expect(style).toContain('--pptx-slide-h: 540px');
	});
});

describe('slideStage "Hide Background Graphics"', () => {
	it('renders the template layer by default', () => {
		const wrapper = mountStage({
			slide: slideWith([shape('own-1')]),
			templateElements: [shape('tpl-1')],
			interactive: true,
		});
		expect(wrapper.text()).toContain('tpl-1');
	});

	it('omits the template layer when showMasterShapes is false', () => {
		const wrapper = mountStage({
			slide: { ...slideWith([shape('own-1')]), showMasterShapes: false },
			templateElements: [shape('tpl-1')],
			interactive: true,
		});
		expect(wrapper.text()).not.toContain('tpl-1');
		expect(wrapper.text()).toContain('own-1');
	});
});

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

describe('slideStage per-slide field substitution', () => {
	// Regression: the viewer root provided ONE field context built from the
	// ACTIVE slide, and nothing re-provided it per stage, so every thumbnail in
	// the rail (and the presenter preview) printed the active slide's number and
	// title. Each stage must re-point the deck context at the slide it paints.
	const DECK_CONTEXT: FieldSubstitutionContext = {
		slideNumber: 1,
		slideTitle: 'Cover',
		footerText: 'Confidential',
	};

	function fieldElement(id: string, fieldType: string, placeholder: string): PptxElement {
		return {
			type: 'text',
			id,
			x: 0,
			y: 0,
			width: 200,
			height: 40,
			textSegments: [{ text: placeholder, style: {}, fieldType }],
		} as unknown as PptxElement;
	}

	function titleElement(text: string): PptxElement {
		return {
			type: 'text',
			id: 'title-1',
			x: 0,
			y: 60,
			width: 200,
			height: 40,
			text,
			placeholderType: 'title',
		} as unknown as PptxElement;
	}

	function mountWithDeckContext(slide: PptxSlide) {
		return mount(SlideStage, {
			props: { slide, canvasSize, mediaDataUrls: new Map<string, string>() },
			global: { provide: { [FieldContextKey as symbol]: () => DECK_CONTEXT } },
		});
	}

	function slide4(elements: PptxElement[]): PptxSlide {
		return { id: 'slide-4', slideNumber: 4, elements } as unknown as PptxSlide;
	}

	it('substitutes the stage own slide number, not the active slide number', () => {
		const wrapper = mountWithDeckContext(
			slide4([fieldElement('f1', 'slidenum', 'Slide #'), titleElement('Results')]),
		);
		expect(wrapper.text()).toContain('4');
		expect(wrapper.text()).not.toContain('Slide #');
		expect(wrapper.text()).not.toContain('Slide 1');
	});

	it('substitutes the stage own slide title, not the active slide title', () => {
		const wrapper = mountWithDeckContext(
			slide4([fieldElement('f1', 'slidetitle', '<title>'), titleElement('Results')]),
		);
		expect(wrapper.text()).toContain('Results');
		expect(wrapper.text()).not.toContain('Cover');
	});

	it('keeps the deck-wide fields (footer) from the injected context', () => {
		const wrapper = mountWithDeckContext(slide4([fieldElement('f1', 'footer', '<footer>')]));
		expect(wrapper.text()).toContain('Confidential');
	});

	it('leaves field runs untouched when nothing provides a context', () => {
		const wrapper = mount(SlideStage, {
			props: {
				slide: slide4([fieldElement('f1', 'slidenum', 'Slide #')]),
				canvasSize,
				mediaDataUrls: new Map<string, string>(),
			},
		});
		expect(wrapper.text()).toContain('Slide #');
	});
});
