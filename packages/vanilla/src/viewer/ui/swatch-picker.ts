import type { PptxThemeColorRef } from 'pptx-viewer-core';
import type { ThemeColorPickerCommit } from 'pptx-viewer-shared';
import { OFFICE_COLOR_SWATCH_HEXES } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { AnchoredPopupHandle } from './anchored-popup';
import { attachAnchoredPopup } from './anchored-popup';
import type { IconName } from './icons';
import { createIcon } from './icons';
import { createRecentColorsRow } from './recent-colors-row';
import { createThemeColorSwatchGrid } from './theme-color-swatch-grid';

/**
 * Office "Standard Colors" swatch set, shared by both the font-colour and
 * highlight-colour pickers (`pptx-viewer-shared`'s canonical catalogue, so
 * this binding cannot drift from the others' standard-colour row).
 */
export const OFFICE_STANDARD_SWATCHES: readonly string[] = OFFICE_COLOR_SWATCH_HEXES;

export interface SwatchPickerOptions {
	/** Accessible label / title for the trigger button. */
	label: string;
	/** Icon shown in the trigger (a small colour bar under it reflects the value). */
	icon: IconName;
	swatches: readonly string[];
	/** Fallback colour when no value is set yet. */
	fallback: string;
	onSelect(hex: string): void;
	/**
	 * Fired ONLY by a theme-swatch click, carrying both the hex and the ref.
	 * Provide alongside `themeColorMap` to show the deck's real "Theme Colors"
	 * grid above the standard swatches (font colour only: highlight colour has
	 * no theme-ref concept on the model).
	 */
	onSelectTheme?(commit: ThemeColorPickerCommit): void;
}

export interface SwatchPickerHandle {
	el: HTMLElement;
	setValue(hex: string | undefined): void;
	setDisabled(disabled: boolean): void;
	/** B6: refresh the "Recent colours" row (most-recent-first); hidden when empty. */
	setRecentColors(colors: readonly string[]): void;
	/** Set the deck's theme colour map; the theme-swatch grid hides itself when `undefined`. */
	setThemeColorMap(themeColorMap: Record<string, string> | undefined): void;
	/** Highlight the swatch matching the element's current theme ref, if any. */
	setSelectedRef(ref: PptxThemeColorRef | undefined): void;
}

/** Normalise an arbitrary colour string to `#rrggbb`, or the fallback when invalid. */
function toHex(hex: string | undefined, fallback: string): string {
	if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/u.test(hex)) {
		return hex.toLowerCase();
	}
	return fallback;
}

/**
 * A reusable swatch-grid colour picker: a small pill trigger (icon + a
 * colour-bar swab of the current value) that opens a grid of preset swatches
 * plus a "Custom colour..." row backed by a native `<input type="color">`.
 * Used by the ribbon's font-colour and highlight-colour controls (upgrading
 * them from the bare native colour input the format toolbar used).
 */
export function makeSwatchPicker(
	doc: Document,
	t: Translator,
	options: SwatchPickerOptions,
): SwatchPickerHandle {
	const el = createEl(doc, 'div', 'pptxv-swatch-picker');

	const trigger = createEl(doc, 'button', 'pptxv-dropdown-trigger pptxv-swatch-trigger');
	trigger.type = 'button';
	trigger.title = options.label;
	trigger.setAttribute('aria-label', options.label);
	trigger.setAttribute('aria-haspopup', 'true');
	trigger.setAttribute('aria-expanded', 'false');
	trigger.appendChild(createIcon(doc, options.icon));
	const swab = createEl(doc, 'span', 'pptxv-swatch-swab');
	trigger.appendChild(swab);
	el.appendChild(trigger);

	const menu = createEl(doc, 'div', 'pptxv-swatch-menu');
	menu.hidden = true;
	el.appendChild(menu);

	// W3-G2: the deck's real "Theme Colors" grid, shown above the standard
	// swatches only when the caller provided `onSelectTheme` (font colour,
	// shape fill/outline). A "Standard Colors" label separates it from the
	// flat swatch row below, matching React/Vue's popovers.
	let themeGrid: ReturnType<typeof createThemeColorSwatchGrid> | null = null;
	if (options.onSelectTheme) {
		const onSelectTheme = options.onSelectTheme;
		themeGrid = createThemeColorSwatchGrid(doc, t, (commit) => {
			setOpen(false);
			onSelectTheme(commit);
		});
		menu.appendChild(themeGrid.el);
		const standardLabel = createEl(doc, 'div', 'pptxv-swatch-standard-label');
		standardLabel.textContent = t('pptx.colorPicker.standardColors');
		menu.appendChild(standardLabel);
	}

	const grid = createEl(doc, 'div', 'pptxv-swatch-grid');
	menu.appendChild(grid);

	// B6: "Recent colours" - MRU picks, seeded from the deck's `p:clrMru` and
	// folded forward by every commit (`editor-recent-colors.ts`). Built below
	// the preset grid, matching React/Vue's ordering, and hidden while empty.
	const recent = createRecentColorsRow(doc, t, (hex) => {
		setOpen(false);
		options.onSelect(hex);
	});
	menu.appendChild(recent.el);

	let value = options.fallback;
	let selectedRef: PptxThemeColorRef | undefined;
	const swatchButtons = new Map<HTMLButtonElement, string>();

	const applySelected = (): void => {
		for (const [btn, hex] of swatchButtons) {
			btn.classList.toggle('is-selected', hex === value);
		}
		recent.setSelected(value);
		themeGrid?.setSelected(selectedRef, value);
		swab.style.backgroundColor = value;
	};

	let isOpen = false;
	let popup: AnchoredPopupHandle | null = null;
	const setOpen = (open: boolean): void => {
		isOpen = open;
		menu.hidden = !open;
		trigger.setAttribute('aria-expanded', String(open));
		trigger.classList.toggle('is-active', open);
		if (open) {
			popup?.destroy();
			popup = attachAnchoredPopup(menu, trigger);
		} else {
			popup?.destroy();
			popup = null;
		}
	};

	for (const hex of options.swatches) {
		const btn = createEl(doc, 'button', 'pptxv-swatch');
		btn.type = 'button';
		btn.setAttribute('data-pptx-compact', '');
		btn.style.backgroundColor = hex;
		btn.setAttribute('aria-label', hex);
		btn.addEventListener('click', () => {
			setOpen(false);
			options.onSelect(hex);
		});
		grid.appendChild(btn);
		swatchButtons.set(btn, hex);
	}

	const customRow = createEl(doc, 'label', 'pptxv-swatch-custom');
	customRow.textContent = t('pptx.ribbon.customColour');
	const customInput = doc.createElement('input');
	customInput.type = 'color';
	customInput.className = 'pptxv-swatch-custom-input';
	customInput.addEventListener('input', () => options.onSelect(customInput.value));
	customRow.appendChild(customInput);
	menu.appendChild(customRow);

	trigger.addEventListener('click', (event) => {
		event.stopPropagation();
		setOpen(!isOpen);
	});
	doc.addEventListener('pointerdown', (event) => {
		if (isOpen && !el.contains(event.target as Node)) {
			setOpen(false);
		}
	});

	applySelected();

	return {
		el,
		setValue(hex) {
			value = toHex(hex, options.fallback);
			customInput.value = value;
			applySelected();
		},
		setDisabled(disabled) {
			trigger.disabled = disabled;
			recent.setDisabled(disabled);
			themeGrid?.setDisabled(disabled);
			if (disabled) {
				setOpen(false);
			}
		},
		setRecentColors(colors) {
			recent.setColors(colors);
		},
		setThemeColorMap(themeColorMap) {
			themeGrid?.setThemeColorMap(themeColorMap);
		},
		setSelectedRef(ref) {
			selectedRef = ref;
			applySelected();
		},
	};
}
