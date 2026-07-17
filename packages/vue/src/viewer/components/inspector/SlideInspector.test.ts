import { mount } from '@vue/test-utils';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import SlideInspector from './SlideInspector.vue';

/**
 * SlideInspector (Vue): the tabbed no-selection inspector mirroring React's
 * `InspectorPane` (Elements | Properties | Comments; Properties active by
 * default with React's section order, Background last).
 */
function slide(elements: PptxElement[] = []): PptxSlide {
	return { id: 's1', elements } as unknown as PptxSlide;
}

function textElement(id: string, text: string): PptxElement {
	return { id, type: 'text', text } as unknown as PptxElement;
}

const baseProps = {
	slide: slide(),
	presentationProperties: {},
	canvasSize: { width: 960, height: 540 },
};

describe('slideInspector', () => {
	it('renders the Elements | Properties | Comments tab strip', () => {
		const wrapper = mount(SlideInspector, { props: baseProps });
		const labels = wrapper.text();
		expect(labels).toContain('Elements');
		expect(labels).toContain('Properties');
		expect(labels).toContain('Comments');
	});

	it('shows the Properties tab by default with React section order', () => {
		const wrapper = mount(SlideInspector, { props: baseProps });
		const text = wrapper.text();
		const order = [
			'Presentation',
			'Theme',
			'Theme Override',
			'Slide Size',
			'Notes & Handout',
			'Document',
			'Background',
		];
		let last = -1;
		for (const heading of order) {
			const index = text.indexOf(heading, last + 1);
			expect(index, `section "${heading}" out of order`).toBeGreaterThan(last);
			last = index;
		}
	});

	it('renders the Tags card when tag collections are provided', async () => {
		const wrapper = mount(SlideInspector, {
			props: {
				...baseProps,
				tagCollections: [
					{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'DECK_ID', value: 'deck-123' }] },
				],
			},
		});
		expect(wrapper.text()).toContain('Tags');
		// Collapsed by default (React parity); expanding reveals the tag row.
		const toggle = wrapper.findAll('button').find((b) => b.text().includes('Tags'));
		await toggle!.trigger('click');
		const name = wrapper
			.findAll('input')
			.find((i) => (i.element as HTMLInputElement).value === 'DECK_ID');
		expect(name).toBeDefined();
		await name!.setValue('DECK');
		const next = wrapper.emitted('update-tag-collections')?.[0]?.[0];
		expect(next).toStrictEqual([
			{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'DECK', value: 'deck-123' }] },
		]);
	});

	it('hides the Tags card when no tag collections are provided', () => {
		const wrapper = mount(SlideInspector, { props: baseProps });
		expect(wrapper.text()).not.toContain('Tags');
	});

	it('no longer renders a Slide Transition section on the default tab', () => {
		const wrapper = mount(SlideInspector, { props: baseProps });
		expect(wrapper.text()).not.toContain('Slide transition');
	});

	it('relays background edits as slide-update patches', async () => {
		const wrapper = mount(SlideInspector, { props: baseProps });
		const color = wrapper.get('input[type="color"]');
		await color.setValue('#ff0000');
		const patches = wrapper.emitted('slide-update');
		expect(patches?.some((args) => 'backgroundColor' in (args[0] as object))).toBeTruthy();
	});

	it('emits apply-theme with the selected path and all-masters flag', async () => {
		const wrapper = mount(SlideInspector, {
			props: {
				...baseProps,
				themeOptions: [{ path: 'ppt/theme/theme1.xml', name: 'Office' }],
			},
		});
		const applyAll = wrapper.findAll('button').find((b) => b.text() === 'Apply All Masters');
		await applyAll!.trigger('click');
		expect(wrapper.emitted('apply-theme')?.[0]).toStrictEqual(['ppt/theme/theme1.xml', true]);
	});

	it('emits canvas-size-update from the Slide Size card', async () => {
		const wrapper = mount(SlideInspector, { props: baseProps });
		// number inputs on the Properties tab: [0] slides/page, [1] W, [2] H.
		const width = wrapper.findAll('input[type="number"]')[1];
		await width.setValue('1280');
		expect(wrapper.emitted('canvas-size-update')?.[0]).toStrictEqual([
			{ width: 1280, height: 540 },
		]);
	});

	it('lists elements on the Elements tab and emits select-element', async () => {
		const wrapper = mount(SlideInspector, {
			props: { ...baseProps, slide: slide([textElement('a', 'Hello'), textElement('b', 'World')]) },
		});
		const elementsTab = wrapper.findAll('button').find((b) => b.text().includes('Elements'));
		await elementsTab!.trigger('click');
		expect(wrapper.text()).toContain('Layer Order');
		// Top-most element (last in z-order) is listed first.
		expect(wrapper.text().indexOf('World')).toBeLessThan(wrapper.text().indexOf('Hello'));
		const row = wrapper.findAll('[title]').find((n) => n.attributes('title')?.includes('text - a'));
		await row!.trigger('click');
		expect(wrapper.emitted('select-element')?.[0]).toStrictEqual(['a']);
	});

	it('hosts the comments panel on the Comments tab and relays adds', async () => {
		const wrapper = mount(SlideInspector, { props: { ...baseProps, comments: [] } });
		const commentsTab = wrapper.findAll('button').find((b) => b.text().includes('Comments'));
		await commentsTab!.trigger('click');
		await wrapper.get('textarea').setValue('First!');
		await wrapper.get('form').trigger('submit.prevent');
		expect(wrapper.emitted('comment-add')?.[0]).toStrictEqual(['First!']);
	});

	it('emits close from the tab strip close button', async () => {
		const wrapper = mount(SlideInspector, { props: baseProps });
		await wrapper.get('button[title="Close"]').trigger('click');
		expect(wrapper.emitted('close')).toHaveLength(1);
	});
});
