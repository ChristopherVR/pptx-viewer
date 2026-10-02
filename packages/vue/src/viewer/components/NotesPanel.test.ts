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

/** The shared toolbar's open shadow root. */
function toolbarRoot(wrapper: ReturnType<typeof mount>) {
	return wrapper.get('pptx-ui-notes-toolbar').element.shadowRoot!;
}

/** The toolbar rich/plain toggle button (labelled "Plain editor" when rich is active). */
function toggleButton(wrapper: ReturnType<typeof mount>) {
	return toolbarRoot(wrapper).querySelector<HTMLButtonElement>('.mode');
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

		toggleButton(wrapper)?.click();
		await nextTick();

		const textarea = wrapper.get('textarea');
		expect((textarea.element as HTMLTextAreaElement).value).toBe('old');

		(textarea.element as HTMLTextAreaElement).value = 'new notes text';
		await textarea.trigger('change');

		const emitted = wrapper.emitted('update');
		expect(emitted).toBeTruthy();
		expect(emitted?.at(-1)?.[0]).toBe('new notes text');
		// The plain edit also hands over its (plain) segments, replacing stale rich ones.
		expect(emitted?.at(-1)?.[1]).toStrictEqual([{ text: 'new notes text', style: {} }]);
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

	it('drives the shared toolbar: canonical labels, disabled plain mode and one link intent', async () => {
		const wrapper = mount(NotesPanel, {
			props: { slide: makeSlide({ notes: 'abc' }) },
			attachTo: document.body,
		});
		await nextTick();
		const root = toolbarRoot(wrapper);
		expect(toggleButton(wrapper)?.textContent).toBe('Plain editor');
		expect(root.querySelector('button[aria-label="Increase indent"]')).not.toBeNull();
		expect(root.querySelector('button[aria-label="Decrease indent"]')).not.toBeNull();
		const bold = root.querySelector<HTMLButtonElement>('button[aria-label="Bold"]')!;
		expect(bold.disabled).toBeFalsy();

		// A link intent inserts an anchor at the editor selection and commits it.
		const editor = wrapper.get('.pptx-vue-notes-rich').element;
		const range = document.createRange();
		range.selectNodeContents(editor);
		range.collapse(false);
		document.getSelection()?.removeAllRanges();
		document.getSelection()?.addRange(range);
		wrapper.get('pptx-ui-notes-toolbar').element.dispatchEvent(
			new CustomEvent('notes-request', {
				detail: { kind: 'link', url: 'https://example.com', text: 'Docs' },
				bubbles: true,
			}),
		);
		expect(editor.querySelector('a')?.getAttribute('href')).toBe('https://example.com');

		toggleButton(wrapper)?.click();
		await nextTick();
		expect(toggleButton(wrapper)?.textContent).toBe('Rich editor');
		expect(bold.disabled).toBeTruthy();
		wrapper.unmount();
	});

	it('commits the rich segments with the text on blur so formatting survives', async () => {
		const wrapper = mount(NotesPanel, { props: { slide: makeSlide({ notes: 'x' }) } });
		await nextTick();
		const rich = wrapper.get('.pptx-vue-notes-rich');
		rich.element.innerHTML = '<strong>Bold</strong> note';

		await rich.trigger('blur');

		const last = wrapper.emitted('update')!.at(-1)!;
		expect(last[0]).toBe('Bold note');
		expect(last[1]).toStrictEqual(
			expect.arrayContaining([expect.objectContaining({ text: 'Bold', style: { bold: true } })]),
		);
	});
});
