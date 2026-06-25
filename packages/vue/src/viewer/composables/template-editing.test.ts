import { mount } from '@vue/test-utils';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import SlideStage from '../components/SlideStage.vue';
import {
	isElementIdInteractive,
	isElementInteractive,
	isTemplateEditingHighlight,
} from './template-editing';

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

const templateShape = (): PptxElement => shape('layout-shape-3');
const masterShape = (): PptxElement => shape('master-shape-7');
const normalShape = (): PptxElement => shape('shape-1');

describe('isElementInteractive', () => {
	it('locks template elements when edit-template mode is off', () => {
		expect(isElementInteractive(templateShape(), true, false)).toBeFalsy();
		expect(isElementInteractive(masterShape(), true, false)).toBeFalsy();
	});

	it('unlocks template elements when edit-template mode is on', () => {
		expect(isElementInteractive(templateShape(), true, true)).toBeTruthy();
		expect(isElementInteractive(masterShape(), true, true)).toBeTruthy();
	});

	it('leaves normal slide elements interactive regardless of the mode', () => {
		expect(isElementInteractive(normalShape(), true, false)).toBeTruthy();
		expect(isElementInteractive(normalShape(), true, true)).toBeTruthy();
	});

	it('gates everything off when the canvas itself is not interactive', () => {
		expect(isElementInteractive(normalShape(), false, true)).toBeFalsy();
		expect(isElementInteractive(templateShape(), false, true)).toBeFalsy();
	});
});

describe('isElementIdInteractive', () => {
	it('mirrors the element gate keyed on the id prefix', () => {
		expect(isElementIdInteractive('layout-shape-3', false)).toBeFalsy();
		expect(isElementIdInteractive('master-shape-7', false)).toBeFalsy();
		expect(isElementIdInteractive('layout-shape-3', true)).toBeTruthy();
		expect(isElementIdInteractive('shape-1', false)).toBeTruthy();
	});
});

describe('isTemplateEditingHighlight', () => {
	it('highlights only template elements and only while the mode is on', () => {
		expect(isTemplateEditingHighlight(templateShape(), true)).toBeTruthy();
		expect(isTemplateEditingHighlight(templateShape(), false)).toBeFalsy();
		expect(isTemplateEditingHighlight(normalShape(), true)).toBeFalsy();
	});
});

function mountStage(editTemplateMode: boolean) {
	const slide = {
		id: 's1',
		elements: [templateShape(), normalShape()],
	} as unknown as PptxSlide;
	return mount(SlideStage, {
		props: {
			slide,
			canvasSize: { width: 1280, height: 720 },
			mediaDataUrls: new Map<string, string>(),
			interactive: true,
			editTemplateMode,
		},
	});
}

describe('slideStage template gating', () => {
	it('marks a template element non-interactive and unhighlighted when the mode is off', () => {
		const wrapper = mountStage(false);
		const template = wrapper.get('[data-element-id="layout-shape-3"]');
		expect(template.attributes('data-pptx-element')).toBeUndefined();
		expect(template.classes()).not.toContain('pptx-vue-template-editing');
		// A normal slide element stays interactive in either mode.
		const normal = wrapper.get('[data-element-id="shape-1"]');
		expect(normal.attributes('data-pptx-element')).toBe('true');
	});

	it('marks a template element interactive and highlighted when the mode is on', () => {
		const wrapper = mountStage(true);
		const template = wrapper.get('[data-element-id="layout-shape-3"]');
		expect(template.attributes('data-pptx-element')).toBe('true');
		expect(template.classes()).toContain('pptx-vue-template-editing');
		// A normal slide element is never highlighted by the affordance.
		const normal = wrapper.get('[data-element-id="shape-1"]');
		expect(normal.classes()).not.toContain('pptx-vue-template-editing');
	});
});
