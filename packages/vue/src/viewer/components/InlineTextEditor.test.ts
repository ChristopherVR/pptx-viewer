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
});
