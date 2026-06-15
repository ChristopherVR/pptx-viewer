import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import NotesPanel from './NotesPanel.vue';

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'slide1',
		rId: 'rId2',
		slideNumber: 1,
		elements: [],
		...overrides,
	};
}

describe('notesPanel', () => {
	it('prefills the textarea from the slide notes field', () => {
		const wrapper = mount(NotesPanel, {
			props: { slide: makeSlide({ notes: 'Remember quarterly goals.' }) },
		});
		const textarea = wrapper.get('textarea');
		expect((textarea.element as HTMLTextAreaElement).value).toBe('Remember quarterly goals.');
	});

	it('renders an empty textarea when the slide has no notes', () => {
		const wrapper = mount(NotesPanel, { props: { slide: makeSlide() } });
		const textarea = wrapper.get('textarea');
		expect((textarea.element as HTMLTextAreaElement).value).toBe('');
	});

	it('emits update with the new text when the edit is committed', async () => {
		const wrapper = mount(NotesPanel, {
			props: { slide: makeSlide({ notes: 'old' }) },
		});
		const textarea = wrapper.get('textarea');
		// The field is uncontrolled and commits on `change`/`blur` (not per
		// keystroke) so the host's history-aware reassignment cannot remount it
		// mid-typing (which on mobile dismisses the on-screen keyboard).
		(textarea.element as HTMLTextAreaElement).value = 'new notes text';
		await textarea.trigger('change');

		const emitted = wrapper.emitted('update');
		expect(emitted).toBeTruthy();
		expect(emitted?.at(-1)).toStrictEqual(['new notes text']);
	});

	it('re-syncs the textarea when the active slide changes', async () => {
		const wrapper = mount(NotesPanel, {
			props: { slide: makeSlide({ id: 'a', notes: 'first' }) },
		});
		expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('first');

		await wrapper.setProps({ slide: makeSlide({ id: 'b', notes: 'second' }) });
		expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('second');
	});

	it('disables the textarea when no slide is selected', () => {
		const wrapper = mount(NotesPanel, { props: { slide: undefined } });
		const textarea = wrapper.get('textarea');
		expect((textarea.element as HTMLTextAreaElement).disabled).toBeTruthy();
	});

	it('toggles collapse when the header is clicked', async () => {
		const wrapper = mount(NotesPanel, { props: { slide: makeSlide() } });
		const header = wrapper.get('button');
		expect(header.attributes('aria-expanded')).toBe('true');
		await header.trigger('click');
		expect(header.attributes('aria-expanded')).toBe('false');
	});
});
