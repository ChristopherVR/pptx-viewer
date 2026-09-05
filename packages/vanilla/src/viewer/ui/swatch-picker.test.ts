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

const OFFICE_THEME: Record<string, string> = {
	dk1: '#000000',
	lt1: '#ffffff',
	dk2: '#44546a',
	lt2: '#e7e6e6',
	accent1: '#4472c4',
	accent2: '#ed7d31',
	accent3: '#a5a5a5',
	accent4: '#ffc000',
	accent5: '#5b9bd5',
	accent6: '#70ad47',
	bg1: '#ffffff',
	tx1: '#000000',
	bg2: '#e7e6e6',
	tx2: '#44546a',
};

describe('makeSwatchPicker theme colour grid (W3-G2)', () => {
	it('renders no theme grid at all when onSelectTheme is not provided (highlight colour)', () => {
		const t = createTranslator();
		const picker = makeSwatchPicker(document, t, {
			label: 'Highlight',
			icon: 'highlight',
			swatches: OFFICE_STANDARD_SWATCHES,
			fallback: '#ffff00',
			onSelect: vi.fn(),
		});
		picker.setThemeColorMap(OFFICE_THEME);
		expect(picker.el.querySelector('.pptxv-theme-swatch-grid')).toBeNull();
	});

	it('shows the theme grid once a theme is set, and hides it again when cleared', () => {
		const t = createTranslator();
		const picker = makeSwatchPicker(document, t, {
			label: 'Font colour',
			icon: 'font-color',
			swatches: OFFICE_STANDARD_SWATCHES,
			fallback: '#000000',
			onSelect: vi.fn(),
			onSelectTheme: vi.fn(),
		});
		const grid = picker.el.querySelector<HTMLElement>('.pptxv-theme-swatch-grid')!;
		expect(grid.hidden).toBeTruthy();

		picker.setThemeColorMap(OFFICE_THEME);
		expect(grid.hidden).toBeFalsy();

		picker.setThemeColorMap(undefined);
		expect(grid.hidden).toBeTruthy();
	});

	it('clicking a theme swatch fires onSelectTheme with both hex and ref, and closes the menu', () => {
		const onSelectTheme = vi.fn();
		const t = createTranslator();
		const picker = makeSwatchPicker(document, t, {
			label: 'Font colour',
			icon: 'font-color',
			swatches: OFFICE_STANDARD_SWATCHES,
			fallback: '#000000',
			onSelect: vi.fn(),
			onSelectTheme,
		});
		picker.setThemeColorMap(OFFICE_THEME);
		const menu = picker.el.querySelector<HTMLElement>('.pptxv-swatch-menu')!;
		picker.el.querySelector<HTMLButtonElement>('.pptxv-dropdown-trigger')!.click();
		expect(menu.hidden).toBeFalsy();

		picker.el.querySelector<HTMLButtonElement>('button[title="Accent 2"]')!.click();
		expect(onSelectTheme).toHaveBeenCalledExactlyOnceWith({
			hex: '#ed7d31',
			ref: { scheme: 'accent2' },
		});
		expect(menu.hidden).toBeTruthy();
	});

	it('shows a "Standard Colors" label above the flat swatch row only when onSelectTheme is provided', () => {
		const t = createTranslator();
		const withTheme = makeSwatchPicker(document, t, {
			label: 'Font colour',
			icon: 'font-color',
			swatches: OFFICE_STANDARD_SWATCHES,
			fallback: '#000000',
			onSelect: vi.fn(),
			onSelectTheme: vi.fn(),
		});
		expect(withTheme.el.querySelector('.pptxv-swatch-standard-label')).not.toBeNull();

		const withoutTheme = makeSwatchPicker(document, t, {
			label: 'Highlight',
			icon: 'highlight',
			swatches: OFFICE_STANDARD_SWATCHES,
			fallback: '#ffff00',
			onSelect: vi.fn(),
		});
		expect(withoutTheme.el.querySelector('.pptxv-swatch-standard-label')).toBeNull();
	});

	it('setSelectedRef highlights the matching theme swatch', () => {
		const t = createTranslator();
		const picker = makeSwatchPicker(document, t, {
			label: 'Font colour',
			icon: 'font-color',
			swatches: OFFICE_STANDARD_SWATCHES,
			fallback: '#000000',
			onSelect: vi.fn(),
			onSelectTheme: vi.fn(),
		});
		picker.setThemeColorMap(OFFICE_THEME);
		picker.setSelectedRef({ scheme: 'accent2' });

		const swatch = picker.el.querySelector<HTMLButtonElement>('button[title="Accent 2"]')!;
		expect(swatch.classList.contains('is-selected')).toBeTruthy();
	});
});
