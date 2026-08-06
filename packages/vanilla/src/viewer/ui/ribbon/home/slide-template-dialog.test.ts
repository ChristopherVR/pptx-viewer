import { SLIDE_TEMPLATES } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createSlideTemplateDialog } from './slide-template-dialog';

describe('createSlideTemplateDialog', () => {
	it('renders the shared aria contract: modal dialog, listbox, 12 option tiles', () => {
		const t = createTranslator();
		const dialog = createSlideTemplateDialog(document, t, { onInsert: vi.fn() });
		dialog.open(document.body);

		const panel = dialog.el.querySelector<HTMLElement>('[role="dialog"]');
		expect(panel).not.toBeNull();
		expect(panel!.getAttribute('aria-modal')).toBe('true');
		expect(panel!.getAttribute('aria-label')).toBe(t('pptx.slideTemplates.galleryTitle'));

		const listbox = dialog.el.querySelector<HTMLElement>('[role="listbox"]');
		expect(listbox?.getAttribute('aria-label')).toBe(t('pptx.slideTemplates.gallery'));

		const options = dialog.el.querySelectorAll<HTMLElement>('[role="option"]');
		expect(options).toHaveLength(12);
		for (const [index, option] of Array.from(options).entries()) {
			const spec = SLIDE_TEMPLATES[index];
			expect(option.getAttribute('aria-selected')).toBe('false');
			expect(option.getAttribute('aria-label')).toBe(t(spec.nameKey));
			expect(option.title).toBe(t(spec.descriptionKey));
			// Every tile carries a live preview stage, not a static icon.
			expect(option.querySelector('.pptxv-tpl-preview .pptxv-stage')).not.toBeNull();
		}
		dialog.close();
	});

	it('click selects (aria-selected sync), Insert stays disabled until then, then inserts', () => {
		const onInsert = vi.fn();
		const dialog = createSlideTemplateDialog(document, createTranslator(), { onInsert });
		dialog.open(document.body);

		const insertButton = dialog.el.querySelector<HTMLButtonElement>('.pptxv-tpl-dialog-insert');
		expect(insertButton!.disabled).toBeTruthy();

		const options = dialog.el.querySelectorAll<HTMLButtonElement>('[role="option"]');
		options[3].click();
		expect(options[3].getAttribute('aria-selected')).toBe('true');
		expect(options[0].getAttribute('aria-selected')).toBe('false');
		expect(insertButton!.disabled).toBeFalsy();

		insertButton!.click();
		expect(onInsert).toHaveBeenCalledExactlyOnceWith(SLIDE_TEMPLATES[3].id);
		expect(dialog.el.hidden).toBeTruthy();
	});

	it('double click inserts the tile directly and closes', () => {
		const onInsert = vi.fn();
		const dialog = createSlideTemplateDialog(document, createTranslator(), { onInsert });
		dialog.open(document.body);

		const first = dialog.el.querySelector<HTMLButtonElement>('[role="option"]');
		first!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		expect(onInsert).toHaveBeenCalledExactlyOnceWith(SLIDE_TEMPLATES[0].id);
		expect(dialog.el.hidden).toBeTruthy();
	});

	it('escape closes and focus returns to the opener', () => {
		const opener = document.createElement('button');
		document.body.appendChild(opener);
		opener.focus();

		const dialog = createSlideTemplateDialog(document, createTranslator(), { onInsert: vi.fn() });
		dialog.open(document.body);
		expect(dialog.el.hidden).toBeFalsy();

		dialog.el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(dialog.el.hidden).toBeTruthy();
		expect(document.activeElement).toBe(opener);
		opener.remove();
	});

	it('builds previews with the scheme returned by getScheme', () => {
		const getScheme = vi.fn(() => ({ bg1: '#123456' }));
		const dialog = createSlideTemplateDialog(document, createTranslator(), {
			onInsert: vi.fn(),
			getScheme,
		});
		dialog.open(document.body);
		expect(getScheme).toHaveBeenCalledWith();
		const preview = dialog.el.querySelector<HTMLElement>('.pptxv-tpl-preview');
		expect(preview?.style.backgroundColor).toBeTruthy();
		dialog.close();
	});
});
