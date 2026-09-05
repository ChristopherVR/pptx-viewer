import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import AccessibilityPanel from './AccessibilityPanel.vue';

function shapeEl(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'shp1',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		...overrides,
	} as PptxElement;
}

describe('accessibilityPanel', () => {
	it('shows alt text and title fields for a shape', () => {
		const wrapper = mount(AccessibilityPanel, {
			props: { element: shapeEl({ altText: 'A red rectangle', title: 'Callout' }), canEdit: true },
		});
		const textarea = wrapper.find('textarea').element as HTMLTextAreaElement;
		const input = wrapper.find('input[type="text"]').element as HTMLInputElement;
		expect(textarea.value).toBe('A red rectangle');
		expect(input.value).toBe('Callout');
	});

	it('emits an altText patch on input', async () => {
		const wrapper = mount(AccessibilityPanel, {
			props: { element: shapeEl(), canEdit: true },
		});
		const textarea = wrapper.find('textarea');
		await textarea.setValue('Updated description');
		const emitted = wrapper.emitted('update');
		expect(emitted).toBeTruthy();
		expect(emitted![emitted!.length - 1][0]).toStrictEqual({ altText: 'Updated description' });
	});

	it('emits a title patch on input', async () => {
		const wrapper = mount(AccessibilityPanel, {
			props: { element: shapeEl(), canEdit: true },
		});
		const input = wrapper.find('input[type="text"]');
		await input.setValue('Updated title');
		const emitted = wrapper.emitted('update');
		expect(emitted).toBeTruthy();
		expect(emitted![emitted!.length - 1][0]).toStrictEqual({ title: 'Updated title' });
	});

	it('shows only altText (no title field) for a picture', () => {
		const wrapper = mount(AccessibilityPanel, {
			props: { element: { type: 'picture', id: 'pic1', altText: 'A sunset' } as PptxElement },
		});
		expect(wrapper.find('textarea').exists()).toBeTruthy();
		expect(wrapper.find('input[type="text"]').exists()).toBeFalsy();
	});

	it('renders nothing for a kind with neither field, like a group', () => {
		const wrapper = mount(AccessibilityPanel, {
			props: { element: { type: 'group', id: 'g1', children: [] } as unknown as PptxElement },
		});
		expect(wrapper.find('[data-pptx-accessibility-text]').exists()).toBeFalsy();
	});

	it('disables both fields when canEdit is false', () => {
		const wrapper = mount(AccessibilityPanel, {
			props: { element: shapeEl({ altText: 'x', title: 'y' }), canEdit: false },
		});
		expect((wrapper.find('textarea').element as HTMLTextAreaElement).disabled).toBeTruthy();
		expect((wrapper.find('input[type="text"]').element as HTMLInputElement).disabled).toBeTruthy();
	});
});
