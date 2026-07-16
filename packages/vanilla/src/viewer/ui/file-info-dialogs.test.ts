import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { openDigitalSignaturesDialog } from './digital-signatures-dialog';
import { openFontEmbeddingDialog } from './font-embedding-dialog';
import { openPasswordProtectionDialog } from './password-protection-dialog';

afterEach(() =>
	document.querySelectorAll('.pptxv-info-overlay').forEach((element) => element.remove()),
);

describe('file info dialogs', () => {
	it('shows used and embedded fonts and updates the toggle', async () => {
		const onToggle = vi.fn();
		const overlay = openFontEmbeddingDialog(document, createTranslator(), {
			slides: [
				{
					id: 'slide',
					rId: 'rId1',
					slideNumber: 1,
					elements: [
						{
							type: 'text',
							id: 'text',
							x: 0,
							y: 0,
							width: 10,
							height: 10,
							text: 'Text',
							textStyle: { fontFamily: 'Brand Font' },
						},
					],
				},
			],
			embeddedFonts: [{ name: 'Brand Font', dataUrl: 'data:font/woff;base64,AA==' }],
			enabled: false,
			onToggle,
		});
		await Promise.resolve();
		expect(overlay.textContent).toContain('Brand Font');
		const checkbox = overlay.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
		checkbox.checked = true;
		checkbox.dispatchEvent(new Event('change', { bubbles: true }));
		expect(onToggle).toHaveBeenCalledWith(true);
	});

	it('reports signature count and accepts a protection password', () => {
		const signatures = openDigitalSignaturesDialog(document, createTranslator(), true, 2);
		expect(signatures.textContent).toContain('2');
		const onSet = vi.fn();
		const protection = openPasswordProtectionDialog(document, createTranslator(), {
			protected: false,
			onSet,
			onRemove: vi.fn(),
		});
		const inputs = protection.querySelectorAll<HTMLInputElement>('input');
		inputs[0].value = 'Safe123!';
		inputs[1].value = 'Safe123!';
		const save = Array.from(protection.querySelectorAll('button')).find(
			(button) => button.textContent === 'Save',
		)!;
		save.click();
		expect(onSet).toHaveBeenCalledWith('Safe123!');
	});
});
