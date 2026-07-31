/**
 * Outline view, Vue binding.
 *
 * The outline's rules are proved once in `pptx-viewer-shared/render/outline-view`
 * and `.../outline-view-edit`. What is worth proving here is the glue: that the
 * pane carries the neutral DOM contract `e2e/` addresses all five viewers
 * through, and above all that a keystroke in a row reaches the deck. Every one
 * of those has been the thing that broke in a past parity wave, never the
 * shared maths.
 */
import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { OUTLINE_LEVEL_ATTR, OUTLINE_ROW_ATTR, OUTLINE_VIEW_ATTR } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';
import { defineComponent, nextTick, reactive } from 'vue';

import type { CanvasSize } from '../types';
import OutlineViewOverlay from './OutlineViewOverlay.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

function textElement(id: string, partial: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id,
		name: 'Text Box',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: '',
		...partial,
	} as PptxElement;
}

const placeholder = (type: string): Record<string, unknown> => ({
	'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_type': type } } },
});

function deck(): PptxSlide[] {
	return [
		{
			id: 's1',
			rId: '',
			slideNumber: 1,
			elements: [
				textElement('t', { text: 'Agenda', rawXml: placeholder('title') }),
				textElement('b', {
					rawXml: placeholder('body'),
					text: 'First\nSecond',
					textSegments: [
						{ text: 'First', style: {} },
						{ text: '\n', style: {}, isParagraphBreak: true },
						{ text: 'Second', style: {} },
					],
				}),
			],
		},
		// A slide with no text at all: it must still appear, or the outline hides it.
		{ id: 's2', rId: '', slideNumber: 2, elements: [] },
	];
}

/**
 * Mount the pane inside a host that owns the deck and feeds every committed
 * deck straight back in, which is exactly what `PowerPointViewer.vue` does. A
 * commit that never reaches the DOM therefore fails here rather than only in a
 * browser.
 */
function mountOverlay(canEdit = true): {
	wrapper: VueWrapper;
	slides: () => PptxSlide[];
	commits: () => number;
} {
	const state = reactive({ slides: deck() as PptxSlide[], commits: 0 });
	const Host = defineComponent({
		components: { OutlineViewOverlay },
		setup() {
			return {
				state,
				canvasSize,
				canEdit,
				onCommit(next: PptxSlide[]) {
					state.slides = next;
					state.commits += 1;
				},
			};
		},
		template: `<OutlineViewOverlay :slides="state.slides" :canvas-size="canvasSize"
			:can-edit="canEdit" @commit="onCommit" />`,
	});
	const wrapper = mount(Host, { attachTo: document.body });
	return { wrapper, slides: () => state.slides, commits: () => state.commits };
}

function rows(wrapper: VueWrapper): HTMLInputElement[] {
	return Array.from(wrapper.element.querySelectorAll<HTMLInputElement>(`[${OUTLINE_ROW_ATTR}]`));
}

describe('outline view overlay', () => {
	it('exposes the neutral outline DOM contract', () => {
		const { wrapper } = mountOverlay();
		const root = wrapper.find(`[${OUTLINE_VIEW_ATTR}]`);
		expect(root.exists()).toBeTruthy();
		expect(root.attributes('aria-label')).toBe('Outline View');
		wrapper.unmount();
	});

	it('reflects the deck: title, body lines, and the titleless slide', () => {
		const { wrapper } = mountOverlay();
		expect(rows(wrapper).map((input) => input.value)).toStrictEqual([
			'Agenda',
			'First',
			'Second',
			'',
		]);
		expect(rows(wrapper).map((input) => input.getAttribute(OUTLINE_LEVEL_ATTR))).toStrictEqual([
			'0',
			'1',
			'1',
			'0',
		]);
		wrapper.unmount();
	});

	it('an edit reaches the slide', async () => {
		const { wrapper, slides } = mountOverlay();
		const input = rows(wrapper)[1];
		input.value = 'Rewritten';
		input.dispatchEvent(new Event('input'));
		await nextTick();
		const body = slides()[0].elements.find((element) => element.id === 'b');
		expect((body as { text?: string }).text).toBe('Rewritten\nSecond');
		expect(rows(wrapper)[1].value).toBe('Rewritten');
		wrapper.unmount();
	});

	it('demotes with Tab and promotes with Shift+Tab', async () => {
		const { wrapper } = mountOverlay();
		rows(wrapper)[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
		await nextTick();
		expect(rows(wrapper)[1].getAttribute(OUTLINE_LEVEL_ATTR)).toBe('2');
		rows(wrapper)[1].dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
		);
		await nextTick();
		expect(rows(wrapper)[1].getAttribute(OUTLINE_LEVEL_ATTR)).toBe('1');
		wrapper.unmount();
	});

	it('adds a slide when Enter lands on a title row', async () => {
		const { wrapper, slides } = mountOverlay();
		rows(wrapper)[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await nextTick();
		expect(slides()).toHaveLength(3);
		expect(rows(wrapper)).toHaveLength(5);
		wrapper.unmount();
	});

	it('typing into a titleless slide creates its title', async () => {
		const { wrapper, slides } = mountOverlay();
		const input = rows(wrapper)[3];
		input.value = 'Brand new';
		input.dispatchEvent(new Event('input'));
		await nextTick();
		expect(slides()[1].elements).toHaveLength(1);
		expect(rows(wrapper)[3].value).toBe('Brand new');
		wrapper.unmount();
	});

	it('is read-only when the viewer cannot edit', async () => {
		const { wrapper, commits } = mountOverlay(false);
		expect(rows(wrapper).every((input) => input.readOnly)).toBeTruthy();
		rows(wrapper)[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
		await nextTick();
		expect(commits()).toBe(0);
		wrapper.unmount();
	});
});
