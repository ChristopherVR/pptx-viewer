import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { openDocumentPropertiesDialog } from './document-properties-dialog';

afterEach(() => {
	document.querySelectorAll('.pptxv-props-overlay').forEach((element) => element.remove());
});

describe('openDocumentPropertiesDialog', () => {
	it('edits metadata, reports statistics, and saves a typed custom property', () => {
		const onSave = vi.fn();
		const overlay = openDocumentPropertiesDialog(document, createTranslator(), {
			slides: [
				{
					id: 'slide-1',
					rId: 'rId1',
					slideNumber: 1,
					notes: 'Speaker note',
					elements: [],
				},
			],
			core: { title: 'Original' },
			app: { company: 'Example Co' },
			custom: [{ name: 'Approved', value: 'false', type: 'bool' }],
			editable: true,
			onSave,
		});
		const dialog = overlay.querySelector<HTMLElement>('[role="dialog"]');
		expect(dialog).not.toBeNull();
		const title = dialog!.querySelector<HTMLInputElement>('input');
		expect(title?.value).toBe('Original');
		title!.value = 'Updated';
		title!.dispatchEvent(new Event('input', { bubbles: true }));

		const buttons = Array.from(dialog!.querySelectorAll('button'));
		buttons.find((button) => button.textContent === 'Statistics')?.click();
		expect(dialog!.textContent).toContain('1');
		buttons.find((button) => button.textContent === 'Custom')?.click();
		expect(dialog!.querySelector('select[aria-label="Type"]')).not.toBeNull();

		buttons.find((button) => button.textContent === 'Save')?.click();
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ title: 'Updated' }),
			expect.objectContaining({ company: 'Example Co' }),
			[{ name: 'Approved', value: 'false', type: 'bool' }],
		);
		expect(document.body.contains(overlay)).toBeFalsy();
	});

	it('keeps editing and saving disabled in read-only mode', () => {
		const overlay = openDocumentPropertiesDialog(document, createTranslator(), {
			slides: [],
			core: { title: 'Read only' },
			custom: [],
			editable: false,
			onSave: vi.fn(),
		});

		expect(overlay.querySelector<HTMLInputElement>('input')?.disabled).toBeTruthy();
		const save = Array.from(overlay.querySelectorAll('button')).find(
			(button) => button.textContent === 'Save',
		);
		expect(save?.disabled).toBeTruthy();
	});
});
