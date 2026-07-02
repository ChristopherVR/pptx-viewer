import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import InlineTextEditor from './InlineTextEditor.vue';

const element = {
	id: 't1',
	type: 'text',
	x: 0,
	y: 0,
	width: 200,
	height: 80,
	text: 'helo wrld',
} as unknown as PptxElement;

describe('inlineTextEditor', () => {
	it('enables the native spell-check attribute by default', () => {
		const wrapper = mount(InlineTextEditor, { props: { element } });
		expect(wrapper.get('[data-inline-editor]').attributes('spellcheck')).toBe('true');
	});

	it('disables spell-check when the host turns it off', () => {
		const wrapper = mount(InlineTextEditor, { props: { element, spellCheck: false } });
		expect(wrapper.get('[data-inline-editor]').attributes('spellcheck')).toBe('false');
	});

	it('emits a bold toggle on Ctrl+B', async () => {
		const wrapper = mount(InlineTextEditor, { props: { element } });
		await wrapper.get('[data-inline-editor]').trigger('keydown', { key: 'b', ctrlKey: true });
		expect(wrapper.emitted('format')).toStrictEqual([[{ bold: true }]]);
	});

	it('toggles italic off from the element style on Cmd+I', async () => {
		const italicElement = { ...element, textStyle: { italic: true } } as unknown as PptxElement;
		const wrapper = mount(InlineTextEditor, { props: { element: italicElement } });
		await wrapper.get('[data-inline-editor]').trigger('keydown', { key: 'i', metaKey: true });
		expect(wrapper.emitted('format')).toStrictEqual([[{ italic: false }]]);
	});

	it('does not emit format for plain typing or shifted shortcuts', async () => {
		const wrapper = mount(InlineTextEditor, { props: { element } });
		const editor = wrapper.get('[data-inline-editor]');
		await editor.trigger('keydown', { key: 'b' });
		await editor.trigger('keydown', { key: 'b', ctrlKey: true, shiftKey: true });
		expect(wrapper.emitted('format')).toBeUndefined();
	});
});
