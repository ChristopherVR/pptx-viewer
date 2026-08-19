/* oxlint-disable eslint/one-var -- independent per-test locals, not intended as one statement */
import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

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

/** The toolbar rich/plain toggle button (labelled "Plain" when rich is active). */
function toggleButton(wrapper: ReturnType<typeof mount>) {
	return wrapper.findAll('button').find((b) => b.text() === 'Plain' || b.text() === 'Rich');
}

describe('notesPanel', () => {
	it('defaults to the rich contentEditable editor and seeds it from notes', async () => {
		const wrapper = mount(NotesPanel, {
			props: { slide: makeSlide({ notes: 'Remember quarterly goals.' }) },
		});
		await nextTick();
		const rich = wrapper.get('.pptx-vue-notes-rich');
		expect(rich.attributes('contenteditable')).toBe('true');
		expect(rich.element.innerHTML).toContain('Remember quarterly goals.');
	});

	it('honours rich notesSegments when present', async () => {
		const wrapper = mount(NotesPanel, {
			props: {
				slide: makeSlide({
					notes: 'Bold note',
					notesSegments: [{ text: 'Bold note', style: { bold: true } }],
				}),
			},
		});
		await nextTick();
		expect(wrapper.get('.pptx-vue-notes-rich').element.innerHTML).toContain('font-weight:700');
	});

	it('toggles to a plain textarea and emits the committed text', async () => {
		const wrapper = mount(NotesPanel, {
			props: { slide: makeSlide({ notes: 'old' }) },
		});
		await nextTick();

		await toggleButton(wrapper)?.trigger('click');
		await nextTick();

		const textarea = wrapper.get('textarea');
		expect((textarea.element as HTMLTextAreaElement).value).toBe('old');

		(textarea.element as HTMLTextAreaElement).value = 'new notes text';
		await textarea.trigger('change');

		const emitted = wrapper.emitted('update');
		expect(emitted).toBeTruthy();
		expect(emitted?.at(-1)).toStrictEqual(['new notes text']);
	});

	it('re-seeds the rich editor when the active slide changes', async () => {
		const wrapper = mount(NotesPanel, {
			props: { slide: makeSlide({ id: 'a', notes: 'first' }) },
		});
		await nextTick();
		expect(wrapper.get('.pptx-vue-notes-rich').element.innerHTML).toContain('first');

		await wrapper.setProps({ slide: makeSlide({ id: 'b', notes: 'second' }) });
		await nextTick();
		expect(wrapper.get('.pptx-vue-notes-rich').element.innerHTML).toContain('second');
	});

	it('falls back to a disabled textarea when no slide is selected', () => {
		const wrapper = mount(NotesPanel, { props: { slide: undefined } });
		const textarea = wrapper.get('textarea');
		expect((textarea.element as HTMLTextAreaElement).disabled).toBeTruthy();
		// The toolbar is hidden with no slide to format.
		expect(wrapper.find('.pptx-vue-notes-toolbar').exists()).toBeFalsy();
	});

	it('reflects the controlled expanded prop and emits toggle on header click', async () => {
		const wrapper = mount(NotesPanel, { props: { slide: makeSlide(), expanded: true } });
		const header = wrapper.get('.pptx-vue-notes-header');
		expect(header.attributes('aria-expanded')).toBe('true');

		await header.trigger('click');
		// Collapse state is host-owned: the click emits `toggle` instead of
		// flipping locally (the footer strip is always visible).
		expect(wrapper.emitted('toggle')).toBeTruthy();
		expect(header.attributes('aria-expanded')).toBe('true');

		await wrapper.setProps({ expanded: false });
		expect(header.attributes('aria-expanded')).toBe('false');
	});

	it('suppresses the collapsible header when embedded, still rendering the body', async () => {
		const wrapper = mount(NotesPanel, {
			props: { slide: makeSlide({ notes: 'hi' }), expanded: true, embedded: true },
		});
		await nextTick();
		expect(wrapper.find('.pptx-vue-notes-header').exists()).toBeFalsy();
		expect(wrapper.find('.pptx-vue-notes-body').isVisible()).toBeTruthy();
	});
});
