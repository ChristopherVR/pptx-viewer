import { mount } from '@vue/test-utils';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import SlideStage from '../components/SlideStage.vue';
import type { TemplateElementMap } from './template-editing';
import {
	buildSaveSlides,
	isElementIdInteractive,
	partitionTemplateElements,
} from './template-editing';
import { useEditorOperations } from './useEditorOperations';

interface TextHolder {
	text?: string;
}

function shape(id: string, text?: string): PptxElement {
	return {
		type: 'shape',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		text: text ?? id,
	} as PptxElement;
}

const templateShape = (): PptxElement => shape('layout-shape-3');
const masterShape = (): PptxElement => shape('master-shape-7');
const normalShape = (): PptxElement => shape('shape-1');

function slideWith(elements: PptxElement[]): PptxSlide {
	return { id: 's1', elements } as unknown as PptxSlide;
}

describe('partitionTemplateElements', () => {
	it('pulls template elements into the store and out of slide.elements', () => {
		const input = [slideWith([templateShape(), masterShape(), normalShape()])];
		const { slides, templateElementsBySlideId } = partitionTemplateElements(input);

		// Normal content stays on the slide; template elements are removed from it.
		const ids = slides[0].elements.map((el) => el.id);
		expect(ids).toStrictEqual(['shape-1']);

		// Template elements land in the per-slide store, in original order.
		const stored = templateElementsBySlideId.s1 ?? [];
		expect(stored.map((el) => el.id)).toStrictEqual(['layout-shape-3', 'master-shape-7']);
	});

	it('leaves a slide untouched when it has no template elements', () => {
		const original = slideWith([normalShape()]);
		const { slides, templateElementsBySlideId } = partitionTemplateElements([original]);
		expect(slides[0]).toBe(original);
		expect(templateElementsBySlideId.s1).toBeUndefined();
	});
});

describe('isElementIdInteractive', () => {
	it('gates template ids on edit-template mode and always allows normal ids', () => {
		expect(isElementIdInteractive('layout-shape-3', false)).toBeFalsy();
		expect(isElementIdInteractive('master-shape-7', false)).toBeFalsy();
		expect(isElementIdInteractive('layout-shape-3', true)).toBeTruthy();
		expect(isElementIdInteractive('shape-1', false)).toBeTruthy();
	});
});

function mountStage(editTemplateMode: boolean) {
	return mount(SlideStage, {
		props: {
			slide: slideWith([normalShape()]),
			templateElements: [templateShape()],
			canvasSize: { width: 1280, height: 720 },
			mediaDataUrls: new Map<string, string>(),
			interactive: true,
			editTemplateMode,
		},
	});
}

describe('slideStage template layer', () => {
	it('renders the template layer non-interactive and unhighlighted when the mode is off', () => {
		const wrapper = mountStage(false);
		const template = wrapper.get('[data-element-id="layout-shape-3"]');
		expect(template.attributes('data-pptx-element')).toBeUndefined();
		expect(template.classes()).not.toContain('pptx-vue-template-editing');
		// Slide content stays interactive regardless of the mode.
		const normal = wrapper.get('[data-element-id="shape-1"]');
		expect(normal.attributes('data-pptx-element')).toBe('true');
		expect(normal.classes()).not.toContain('pptx-vue-template-editing');
	});

	it('renders the template layer interactive and highlighted when the mode is on', () => {
		const wrapper = mountStage(true);
		const template = wrapper.get('[data-element-id="layout-shape-3"]');
		expect(template.attributes('data-pptx-element')).toBe('true');
		expect(template.classes()).toContain('pptx-vue-template-editing');
		// Slide content is never highlighted by the template affordance.
		const normal = wrapper.get('[data-element-id="shape-1"]');
		expect(normal.classes()).not.toContain('pptx-vue-template-editing');
	});
});

describe('buildSaveSlides', () => {
	it('merges template elements back behind the slide content', () => {
		const slides = [slideWith([normalShape()])];
		const map: TemplateElementMap = { s1: [templateShape()] };
		const merged = buildSaveSlides(slides, map);
		expect(merged[0].elements.map((el) => el.id)).toStrictEqual(['layout-shape-3', 'shape-1']);
	});
});

describe('useEditorOperations template routing', () => {
	it('routes a template-id edit to the template store and merges it back on save', () => {
		const slides = ref<PptxSlide[]>([slideWith([normalShape()])]);
		const templateElementsBySlideId = ref<TemplateElementMap>({ s1: [templateShape()] });
		const activeSlideIndex = ref(0);
		const ops = useEditorOperations({
			slides,
			activeSlideIndex,
			pushHistory: () => {},
			templateElementsBySlideId,
		});

		ops.updateElementText('layout-shape-3', 'edited template text');

		// The edit lands in the template store, not on the slide.
		const stored = templateElementsBySlideId.value.s1 ?? [];
		expect((stored[0] as TextHolder).text).toBe('edited template text');
		expect(slides.value[0].elements.map((el) => el.id)).toStrictEqual(['shape-1']);

		// A save merges the EDITED template element back into the slide's elements.
		const merged = buildSaveSlides(slides.value, templateElementsBySlideId.value);
		const mergedTemplate = merged[0].elements.find((el) => el.id === 'layout-shape-3');
		expect((mergedTemplate as TextHolder | undefined)?.text).toBe('edited template text');
	});

	it('routes a normal-id edit to the slide and leaves the template store untouched', () => {
		const slides = ref<PptxSlide[]>([slideWith([normalShape()])]);
		const templateElementsBySlideId = ref<TemplateElementMap>({ s1: [templateShape()] });
		const activeSlideIndex = ref(0);
		const ops = useEditorOperations({
			slides,
			activeSlideIndex,
			pushHistory: () => {},
			templateElementsBySlideId,
		});

		ops.updateElementText('shape-1', 'edited slide text');

		const normal = slides.value[0].elements.find((el) => el.id === 'shape-1');
		expect((normal as TextHolder | undefined)?.text).toBe('edited slide text');
		// The template store is unchanged by a normal-element edit.
		const stored = templateElementsBySlideId.value.s1 ?? [];
		expect((stored[0] as TextHolder).text).toBe('layout-shape-3');
	});
});
