import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import HomeSection from './HomeSection.vue';

function textShape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 's1',
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		text: 'hi',
		...overrides,
	} as PptxElement;
}

function mountHome(overrides: Record<string, unknown> = {}) {
	return mount(HomeSection, {
		props: {
			canEdit: true,
			clipboardPayload: null,
			onCopy: vi.fn(),
			onCut: vi.fn(),
			onPaste: vi.fn(),
			layoutOptions: [],
			onInsertSlideFromLayout: vi.fn(),
			...overrides,
		},
	});
}

/**
 * extractFontInfo's font-size fallback: shared `fontSizeOf` replaces a
 * hardcoded 24pt with PowerPoint's real 18pt presentation-level default
 * (`p:defaultTextStyle`), and this pins that repoint through the rendered
 * ribbon box rather than only unit-testing the shared function.
 */
describe('homeSection - font size box (shared fontSizeOf)', () => {
	it("shows 18pt (PowerPoint's real default) with nothing selected, not the old hardcoded 24", () => {
		const wrapper = mountHome({ selectedElement: null });
		expect(wrapper.find('[aria-label="Font size"]').text()).toBe('18');
	});

	it('shows 18pt for a text element with no explicit size', () => {
		const wrapper = mountHome({ selectedElement: textShape() });
		expect(wrapper.find('[aria-label="Font size"]').text()).toBe('18');
	});

	it('shows the element textStyle fontSize when set', () => {
		const wrapper = mountHome({ selectedElement: textShape({ textStyle: { fontSize: 32 } }) });
		expect(wrapper.find('[aria-label="Font size"]').text()).toBe('32');
	});

	it('prefers the first text segment style over the element textStyle', () => {
		const wrapper = mountHome({
			selectedElement: textShape({
				textStyle: { fontSize: 32 },
				textSegments: [{ text: 'hi', style: { fontSize: 40 } }],
			}),
		});
		expect(wrapper.find('[aria-label="Font size"]').text()).toBe('40');
	});

	it('falls back to 18pt for a non-text element (e.g. an image)', () => {
		const wrapper = mountHome({
			selectedElement: { id: 'i1', type: 'image', x: 0, y: 0, width: 1, height: 1 } as PptxElement,
		});
		expect(wrapper.find('[aria-label="Font size"]').text()).toBe('18');
	});
});
