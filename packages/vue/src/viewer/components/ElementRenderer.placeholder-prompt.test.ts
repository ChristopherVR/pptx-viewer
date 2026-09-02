import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.vue';

/**
 * ElementRenderer placeholder-prompt tests: an empty inherited placeholder's
 * greyed-out authoring hint ("Click to add title", shared
 * `placeholderPromptDescriptor`) must render only on the editing canvas
 * (`interactive`), never while presenting, exporting, or in a thumbnail, so
 * the hint never leaks onto the audience screen or a printed handout.
 */

const PROMPT = 'Click to add title';

function emptyPlaceholder(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id: 'title-1',
		x: 10,
		y: 10,
		width: 400,
		height: 80,
		text: '',
		textSegments: [],
		promptText: PROMPT,
		...overrides,
	} as unknown as PptxElement;
}

function mountEl(element: PptxElement, props: Record<string, unknown>) {
	return mount(ElementRenderer, {
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1, ...props },
	});
}

describe('elementRenderer placeholder prompt', () => {
	it('shows the hint on the editing canvas', () => {
		const wrapper = mountEl(emptyPlaceholder(), { interactive: true });
		expect(wrapper.find('.pptx-vue-placeholder-prompt').exists()).toBeTruthy();
		expect(wrapper.text()).toContain(PROMPT);
	});

	it('never shows the hint outside edit mode (presenting, export, thumbnail)', () => {
		const presenting = mountEl(emptyPlaceholder(), { interactive: false, presenting: true });
		expect(presenting.text()).not.toContain(PROMPT);

		const thumbnail = mountEl(emptyPlaceholder(), { interactive: false });
		expect(thumbnail.text()).not.toContain(PROMPT);
	});

	it('never shows the hint once the placeholder has real text', () => {
		const wrapper = mountEl(
			emptyPlaceholder({
				text: 'My Title',
				textSegments: [{ text: 'My Title', style: {} }],
			} as Partial<PptxElement>),
			{ interactive: true },
		);
		expect(wrapper.text()).not.toContain(PROMPT);
		expect(wrapper.text()).toContain('My Title');
	});
});
