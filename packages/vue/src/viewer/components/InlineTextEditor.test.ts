import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { setElementBullets } from 'pptx-viewer-shared';
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
	it('toggles inherited underline off in a list whose marker has an empty style', async () => {
		const source = {
			...element,
			text: '◆ Body',
			textStyle: { underline: true },
			textSegments: [
				{ text: '◆ ', style: {}, bulletInfo: { char: '◆' } },
				{ text: 'Body', style: {} },
			],
		};
		const wrapper = mount(InlineTextEditor, {
			props: { element: source },
			attachTo: document.body,
		});
		try {
			await wrapper.get('[data-inline-editor]').trigger('keydown', { key: 'u', ctrlKey: true });
			expect(wrapper.emitted('format')).toStrictEqual([[{ underline: false }]]);
		} finally {
			wrapper.unmount();
		}
	});

	it('activates a list during a plain edit, restores its caret, and keeps the rich root after list-off', async () => {
		const source = {
			...element,
			text: 'Plain body',
			textSegments: [{ text: 'Plain body', style: {} }],
		};
		const wrapper = mount(InlineTextEditor, {
			props: { element: source },
			attachTo: document.body,
		});
		try {
			const oldRoot = wrapper.get('[data-inline-editor]').element;
			const range = document.createRange();
			range.setStart(oldRoot.firstChild!, 3);
			range.collapse(true);
			window.getSelection()!.removeAllRanges();
			window.getSelection()!.addRange(range);
			const listed = { ...source, ...setElementBullets(source, 'bullet') };
			await wrapper.setProps({ element: listed });
			await wrapper.vm.$nextTick();
			const root = wrapper.get('[data-inline-editor]').element;
			expect(root).not.toBe(oldRoot);
			expect(root.querySelector('[data-pptx-list-paragraph]')).not.toBeNull();
			expect(window.getSelection()!.anchorOffset).toBe(3);
			await wrapper.setProps({ element: { ...listed, ...setElementBullets(listed, 'none') } });
			expect(wrapper.get('[data-inline-editor]').element).toBe(root);
			expect(wrapper.emitted('commit')).toBeUndefined();
		} finally {
			wrapper.unmount();
		}
	});

	it('keeps list provenance in current input and blur snapshots without rebinding typed DOM', async () => {
		const listed: PptxElement = {
			...element,
			text: '◆ Original',
			textSegments: [
				{ text: '◆ ', style: {}, bulletInfo: { char: '◆' }, paragraphLevel: 1 },
				{ text: 'Original', style: { fontSize: 24, italic: true } },
			],
		};
		const wrapper = mount(InlineTextEditor, {
			props: { element: listed },
			attachTo: document.body,
		});
		try {
			const editor = wrapper.get('[data-inline-editor]');
			const paragraph = editor.element.querySelector('[data-pptx-list-paragraph]');
			expect(paragraph).not.toBeNull();
			const run = paragraph!.querySelector('span')!;
			run.textContent = 'Current';
			await editor.trigger('input');
			const last = wrapper.emitted('change')!.at(-1)!;
			expect(last[0]).toBe('Current');
			expect(last[1]).toMatchObject({
				elementId: listed.id,
				text: 'Current',
				textSegments: expect.arrayContaining([
					expect.objectContaining({
						text: 'Current',
						style: expect.objectContaining({ italic: true }),
					}),
				]),
			});
			await wrapper.setProps({ element: { ...listed, textStyle: { bold: true } } });
			expect(editor.element.querySelector('[data-pptx-list-paragraph]')).toBe(paragraph);
			await editor.trigger('blur');
			expect(wrapper.emitted('change')!.at(-1)![0]).toBe('Current');
			expect(wrapper.emitted('commit')).toHaveLength(1);
		} finally {
			wrapper.unmount();
		}
	});

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
