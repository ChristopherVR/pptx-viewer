import type { PptxSlide, PptxTextStyleLevels } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createNotesPanel } from './notes-panel';

function buildSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'slide-1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [],
		...overrides,
	};
}

function textarea(el: HTMLElement): HTMLTextAreaElement {
	const found = el.querySelector('.pptxv-notes-textarea');
	if (!found) {
		throw new Error('textarea not found');
	}
	return found as HTMLTextAreaElement;
}

function richEditor(el: HTMLElement): HTMLElement {
	const found = el.querySelector<HTMLElement>('.pptxv-notes-rich-editor');
	if (!found) {
		throw new Error('rich editor not found');
	}
	return found;
}

describe('createNotesPanel', () => {
	it('renders the current slide notes text', () => {
		const t = createTranslator();
		const panel = createNotesPanel(document, t, vi.fn(), vi.fn());
		panel.update({ slide: buildSlide({ notes: 'Remember the demo.' }), editable: false });
		expect(textarea(panel.el).value).toBe('Remember the demo.');
	});

	it('renders an empty textarea and the "no slide" placeholder without a slide', () => {
		const t = createTranslator();
		const panel = createNotesPanel(document, t, vi.fn(), vi.fn());
		panel.update({ slide: undefined, editable: false });
		const ta = textarea(panel.el);
		expect(ta.value).toBe('');
		expect(ta.disabled).toBeTruthy();
		expect(ta.placeholder).toBe(t('pptx.notes.noSlide'));
	});

	it('is readonly in view-only mode and editable when editable is true', () => {
		const t = createTranslator();
		const panel = createNotesPanel(document, t, vi.fn(), vi.fn());
		const slide = buildSlide({ notes: 'hello' });

		panel.update({ slide, editable: false });
		expect(textarea(panel.el).readOnly).toBeTruthy();

		panel.update({ slide, editable: true });
		expect(textarea(panel.el).readOnly).toBeFalsy();
	});

	it('reseeds the textarea only when the slide id changes', () => {
		const t = createTranslator();
		const panel = createNotesPanel(document, t, vi.fn(), vi.fn());
		const slideA = buildSlide({ id: 'a', notes: 'Notes A' });
		panel.update({ slide: slideA, editable: true });
		expect(textarea(panel.el).value).toBe('Notes A');

		// Simulate an in-progress edit: the live DOM value diverges from the
		// slide's stored notes. A re-render with the SAME slide id must not
		// stomp it (this is what keeps typing from being interrupted).
		textarea(panel.el).value = 'still typing...';
		panel.update({ slide: buildSlide({ id: 'a', notes: 'Notes A' }), editable: true });
		expect(textarea(panel.el).value).toBe('still typing...');

		// A genuine slide swap (different id) DOES reseed.
		const slideB = buildSlide({ id: 'b', notes: 'Notes B' });
		panel.update({ slide: slideB, editable: true });
		expect(textarea(panel.el).value).toBe('Notes B');
	});

	it('commits the plain text on change/blur only when editable', () => {
		const onCommit = vi.fn();
		const t = createTranslator();
		const panel = createNotesPanel(document, t, vi.fn(), onCommit);
		const slide = buildSlide({ notes: 'original' });

		panel.update({ slide, editable: false });
		const ta = textarea(panel.el);
		ta.value = 'edited while read-only';
		ta.dispatchEvent(new Event('change'));
		expect(onCommit).not.toHaveBeenCalled();

		panel.update({ slide, editable: true });
		ta.value = 'edited notes';
		ta.dispatchEvent(new Event('change'));
		expect(onCommit).toHaveBeenCalledExactlyOnceWith('edited notes');

		ta.value = 'edited again';
		ta.dispatchEvent(new Event('blur'));
		expect(onCommit).toHaveBeenLastCalledWith('edited again');
	});

	it('commits rich content as plain text and segments on blur', () => {
		const onCommit = vi.fn();
		const panel = createNotesPanel(document, createTranslator(), vi.fn(), onCommit);
		panel.update({ slide: buildSlide({ notes: 'original' }), editable: true });

		const editor = richEditor(panel.el);
		editor.innerHTML = '<strong>Bold</strong> note';
		editor.dispatchEvent(new Event('blur'));

		expect(onCommit).toHaveBeenLastCalledWith(
			'Bold note',
			expect.arrayContaining([expect.objectContaining({ text: 'Bold', style: { bold: true } })]),
		);
	});

	it('offers a rich/plain mode toggle while editing', () => {
		const panel = createNotesPanel(document, createTranslator(), vi.fn(), vi.fn());
		panel.update({ slide: buildSlide({ notes: 'original' }), editable: true });
		const toggle = panel.el.querySelector<HTMLButtonElement>('.pptxv-notes-mode');
		expect(toggle).not.toBeNull();
		expect(richEditor(panel.el).hidden).toBeFalsy();

		toggle?.click();
		expect(textarea(panel.el).hidden).toBeFalsy();
	});

	it('exposes the full rich-text command set while editing', () => {
		const t = createTranslator();
		const panel = createNotesPanel(document, t, vi.fn(), vi.fn());
		panel.update({ slide: buildSlide({ notes: 'original' }), editable: true });

		for (const key of [
			'pptx.notes.bold',
			'pptx.notes.italic',
			'pptx.notes.underline',
			'pptx.notes.strikethrough',
			'pptx.notes.bulletList',
			'pptx.notes.numberedList',
			'pptx.notes.indent',
			'pptx.notes.outdent',
			'pptx.notes.insertLink',
		] as const) {
			expect(panel.el.querySelector(`[aria-label="${t(key)}"]`)).not.toBeNull();
		}
	});

	it('prints the current slide notes into a hidden iframe via the shared buildNotesPrintHtml builder', () => {
		const t = createTranslator();
		const panel = createNotesPanel(document, t, vi.fn(), vi.fn());
		panel.update({
			slide: buildSlide({ notes: 'Remember the demo.', slideNumber: 3 }),
			editable: true,
		});

		const printButton = panel.el.querySelector<HTMLButtonElement>(
			`[aria-label="${t('pptx.notes.printNotes')}"]`,
		);
		expect(printButton).not.toBeNull();
		const framesBefore = document.body.querySelectorAll('iframe[aria-hidden="true"]').length;
		printButton?.click();

		const frames = document.body.querySelectorAll<HTMLIFrameElement>('iframe[aria-hidden="true"]');
		expect(frames).toHaveLength(framesBefore + 1);
		const frame = frames[frames.length - 1];
		expect(frame.contentDocument?.body.textContent).toContain('Remember the demo.');
		frame.remove();
	});

	it('does nothing when the print button is clicked with no slide selected', () => {
		const t = createTranslator();
		const panel = createNotesPanel(document, t, vi.fn(), vi.fn());
		panel.update({ slide: undefined, editable: true });

		const printButton = panel.el.querySelector<HTMLButtonElement>(
			`[aria-label="${t('pptx.notes.printNotes')}"]`,
		);
		const framesBefore = document.body.querySelectorAll('iframe[aria-hidden="true"]').length;
		printButton?.click();

		expect(document.body.querySelectorAll('iframe[aria-hidden="true"]')).toHaveLength(framesBefore);
	});

	it('applies the notes-master level-0 font size to segments missing an explicit size', () => {
		const t = createTranslator();
		const notesStyle: PptxTextStyleLevels = { 0: { fontSize: 32 } };

		const styledPanel = createNotesPanel(document, t, vi.fn(), vi.fn());
		styledPanel.update({
			slide: buildSlide({ notes: 'Remember the demo.' }),
			editable: true,
			notesStyle,
		});
		// 32px master default -> 24pt inline style on the rich editor's run.
		expect(richEditor(styledPanel.el).innerHTML).toContain('font-size:24pt');

		const unstyledPanel = createNotesPanel(document, t, vi.fn(), vi.fn());
		unstyledPanel.update({ slide: buildSlide({ notes: 'Remember the demo.' }), editable: true });
		expect(richEditor(unstyledPanel.el).innerHTML).not.toContain('font-size');
	});

	it('toggles expanded/collapsed state and fires onToggle from the header', () => {
		const onToggle = vi.fn();
		const t = createTranslator();
		const panel = createNotesPanel(document, t, onToggle, vi.fn());
		const body = panel.el.querySelector<HTMLElement>('.pptxv-notes-body');
		const header = panel.el.querySelector<HTMLButtonElement>('.pptxv-notes-header');
		expect(body?.hidden).toBeTruthy();

		panel.setExpanded(true);
		expect(body?.hidden).toBeFalsy();
		expect(header?.getAttribute('aria-expanded')).toBe('true');

		panel.setExpanded(false);
		expect(body?.hidden).toBeTruthy();

		header?.click();
		expect(onToggle).toHaveBeenCalledOnce();
	});
});
