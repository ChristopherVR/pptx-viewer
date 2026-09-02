import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { makeSwatchPicker, OFFICE_STANDARD_SWATCHES } from './swatch-picker';

describe('makeSwatchPicker', () => {
	it('renders one swatch button per catalogue colour', () => {
		const t = createTranslator();
		const picker = makeSwatchPicker(document, t, {
			label: 'Font colour',
			icon: 'font-color',
			swatches: OFFICE_STANDARD_SWATCHES,
			fallback: '#000000',
			onSelect: vi.fn(),
		});
		expect(picker.el.querySelectorAll('.pptxv-swatch')).toHaveLength(
			OFFICE_STANDARD_SWATCHES.length,
		);
	});

	it('opens on trigger click and fires onSelect for a swatch, then closes', () => {
		const onSelect = vi.fn();
		const t = createTranslator();
		const picker = makeSwatchPicker(document, t, {
			label: 'Font colour',
			icon: 'font-color',
			swatches: OFFICE_STANDARD_SWATCHES,
			fallback: '#000000',
			onSelect,
		});
		const trigger = picker.el.querySelector<HTMLButtonElement>('.pptxv-dropdown-trigger')!;
		const menu = picker.el.querySelector<HTMLElement>('.pptxv-swatch-menu')!;
		trigger.click();
		expect(menu.hidden).toBeFalsy();

		const swatch = picker.el.querySelector<HTMLButtonElement>('.pptxv-swatch')!;
		swatch.click();
		expect(onSelect).toHaveBeenCalledExactlyOnceWith(OFFICE_STANDARD_SWATCHES[0]);
		expect(menu.hidden).toBeTruthy();
	});

	it('fires onSelect from the custom colour input', () => {
		const onSelect = vi.fn();
		const t = createTranslator();
		const picker = makeSwatchPicker(document, t, {
			label: 'Highlight',
			icon: 'highlight',
			swatches: OFFICE_STANDARD_SWATCHES,
			fallback: '#ffff00',
			onSelect,
		});
		const custom = picker.el.querySelector<HTMLInputElement>('.pptxv-swatch-custom-input')!;
		custom.value = '#123456';
		custom.dispatchEvent(new Event('input'));
		expect(onSelect).toHaveBeenCalledExactlyOnceWith('#123456');
	});

	it('setValue normalises invalid input to the fallback and reflects the swab colour', () => {
		const t = createTranslator();
		const picker = makeSwatchPicker(document, t, {
			label: 'Font colour',
			icon: 'font-color',
			swatches: OFFICE_STANDARD_SWATCHES,
			fallback: '#4f86ff',
			onSelect: vi.fn(),
		});
		picker.setValue('not-a-colour');
		const swab = picker.el.querySelector<HTMLElement>('.pptxv-swatch-swab')!;
		expect(swab.style.backgroundColor).toBe('#4f86ff');

		picker.setValue('#ff0000');
		expect(swab.style.backgroundColor).toBe('#ff0000');
	});

	// B6: "Recent colours" (`p:clrMru`) row.
	it('hides the recent-colours row until setRecentColors is called with entries', () => {
		const t = createTranslator();
		const picker = makeSwatchPicker(document, t, {
			label: 'Font colour',
			icon: 'font-color',
			swatches: OFFICE_STANDARD_SWATCHES,
			fallback: '#000000',
			onSelect: vi.fn(),
		});
		expect(
			picker.el.querySelector('[data-testid="pptx-color-recent"]')?.hasAttribute('hidden'),
		).toBeTruthy();

		picker.setRecentColors(['#112233', '#445566']);

		const row = picker.el.querySelector<HTMLElement>('[data-testid="pptx-color-recent"]')!;
		expect(row.hidden).toBeFalsy();
		expect(row.querySelectorAll('.pptxv-swatch')).toHaveLength(2);
	});

	it('fires onSelect from a recent-colours swatch', () => {
		const onSelect = vi.fn();
		const t = createTranslator();
		const picker = makeSwatchPicker(document, t, {
			label: 'Font colour',
			icon: 'font-color',
			swatches: OFFICE_STANDARD_SWATCHES,
			fallback: '#000000',
			onSelect,
		});
		picker.setRecentColors(['#112233']);

		picker.el
			.querySelector<HTMLButtonElement>('[data-testid="pptx-color-recent"] .pptxv-swatch')!
			.click();

		expect(onSelect).toHaveBeenCalledExactlyOnceWith('#112233');
	});

	it('replaces the recent-colours row on repeated calls rather than accumulating', () => {
		const t = createTranslator();
		const picker = makeSwatchPicker(document, t, {
			label: 'Font colour',
			icon: 'font-color',
			swatches: OFFICE_STANDARD_SWATCHES,
			fallback: '#000000',
			onSelect: vi.fn(),
		});
		picker.setRecentColors(['#112233', '#445566']);
		picker.setRecentColors(['#778899']);

		const row = picker.el.querySelector<HTMLElement>('[data-testid="pptx-color-recent"]')!;
		expect(row.querySelectorAll('.pptxv-swatch')).toHaveLength(1);
	});

	it('setDisabled disables the trigger', () => {
		const t = createTranslator();
		const picker = makeSwatchPicker(document, t, {
			label: 'Font colour',
			icon: 'font-color',
			swatches: OFFICE_STANDARD_SWATCHES,
			fallback: '#000000',
			onSelect: vi.fn(),
		});
		picker.setDisabled(true);
		expect(
			picker.el.querySelector<HTMLButtonElement>('.pptxv-dropdown-trigger')!.disabled,
		).toBeTruthy();
	});
});
