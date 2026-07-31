import type { PptxThemeColorScheme } from 'pptx-viewer-core';
import { THEME_COLOR_SCHEME_KEYS } from 'pptx-viewer-core';
import { COMMON_FONTS, PRESET_THEMES } from 'pptx-viewer-shared';
import type { PresetTheme } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';

/**
 * DOM builders for the theme editor card, split out of `theme-editor-card.ts`
 * so each file stays inside the project's size budget. Pure assembly: the card
 * owns all the state and passes the change callbacks in.
 */

/** i18n key per scheme slot, matching React's `ThemeColorSchemeEditor` labels. */
const COLOR_LABEL_KEYS: Record<keyof PptxThemeColorScheme, string> = {
	dk1: 'pptx.themeEditor.colorDark1',
	lt1: 'pptx.themeEditor.colorLight1',
	dk2: 'pptx.themeEditor.colorDark2',
	lt2: 'pptx.themeEditor.colorLight2',
	accent1: 'pptx.themeEditor.colorAccent1',
	accent2: 'pptx.themeEditor.colorAccent2',
	accent3: 'pptx.themeEditor.colorAccent3',
	accent4: 'pptx.themeEditor.colorAccent4',
	accent5: 'pptx.themeEditor.colorAccent5',
	accent6: 'pptx.themeEditor.colorAccent6',
	hlink: 'pptx.themeEditor.colorHyperlink',
	folHlink: 'pptx.themeEditor.colorFollowedLink',
};

/** Normalise a stored theme colour to the `#rrggbb` a native picker accepts. */
export function themeHex(raw: string | undefined, fallback = '#000000'): string {
	const value = typeof raw === 'string' ? (raw.startsWith('#') ? raw : `#${raw}`) : '';
	return /^#[0-9a-fA-F]{6}$/u.test(value) ? value : fallback;
}

export interface ColorSlotGrid {
	el: HTMLElement;
	update(scheme: PptxThemeColorScheme, editable: boolean): void;
}

/** The 12 scheme-colour swatches, each a labelled native colour input. */
export function createColorSlotGrid(
	doc: Document,
	t: Translator,
	onChange: (key: keyof PptxThemeColorScheme, hex: string) => void,
): ColorSlotGrid {
	const el = createEl(doc, 'div', 'pptxv-theme-slots');
	const inputs = new Map<keyof PptxThemeColorScheme, HTMLInputElement>();
	for (const key of THEME_COLOR_SCHEME_KEYS) {
		const label = createEl(doc, 'label', 'pptxv-theme-slot');
		const caption = createEl(doc, 'span', 'pptxv-theme-slot-label');
		caption.textContent = t(COLOR_LABEL_KEYS[key]);
		const input = doc.createElement('input');
		input.type = 'color';
		input.className = 'pptxv-theme-slot-input';
		input.setAttribute('aria-label', t(COLOR_LABEL_KEYS[key]));
		input.addEventListener('change', () => onChange(key, input.value));
		label.append(caption, input);
		el.appendChild(label);
		inputs.set(key, input);
	}
	return {
		el,
		update(scheme, editable) {
			for (const [key, input] of inputs) {
				input.value = themeHex(scheme[key]);
				input.disabled = !editable;
			}
		},
	};
}

export interface PresetGallery {
	el: HTMLElement;
	update(activeName: string, editable: boolean): void;
}

/** The preset-theme gallery: one button per Office palette, accents previewed. */
export function createPresetGallery(
	doc: Document,
	t: Translator,
	onSelect: (preset: PresetTheme) => void,
): PresetGallery {
	const el = createEl(doc, 'div', 'pptxv-theme-presets');
	const caption = createEl(doc, 'span', 'pptxv-field-label');
	caption.textContent = t('pptx.themeEditor.presetThemes');
	const grid = createEl(doc, 'div', 'pptxv-theme-preset-grid');
	el.append(caption, grid);
	const buttons: Array<{ node: HTMLButtonElement; preset: PresetTheme }> = [];
	for (const preset of PRESET_THEMES) {
		const node = createEl(doc, 'button', 'pptxv-theme-preset');
		node.type = 'button';
		node.title = preset.name;
		node.setAttribute('aria-label', preset.name);
		const swatches = createEl(doc, 'span', 'pptxv-theme-preset-swatches');
		for (const key of ['accent1', 'accent2', 'accent3', 'accent4'] as const) {
			const dot = createEl(doc, 'span', 'pptxv-theme-preset-dot');
			dot.style.background = themeHex(preset.colorScheme[key], '#888888');
			swatches.appendChild(dot);
		}
		const name = createEl(doc, 'span', 'pptxv-theme-preset-name');
		name.textContent = preset.name;
		node.append(swatches, name);
		node.addEventListener('click', () => onSelect(preset));
		grid.appendChild(node);
		buttons.push({ node, preset });
	}
	return {
		el,
		update(activeName, editable) {
			for (const { node, preset } of buttons) {
				node.classList.toggle('is-active', preset.name === activeName);
				node.disabled = !editable;
			}
		},
	};
}

export interface FontField {
	el: HTMLElement;
	select: HTMLSelectElement;
}

/**
 * A font dropdown seeded with `COMMON_FONTS`. The deck's own font is appended
 * when it is not one of the common ones, so opening the editor never silently
 * rewrites a theme font the picker happens not to list.
 */
export function createFontField(
	doc: Document,
	label: string,
	onChange: (font: string) => void,
): FontField {
	const el = createEl(doc, 'label', 'pptxv-field pptxv-field-select');
	const caption = createEl(doc, 'span', 'pptxv-field-label');
	caption.textContent = label;
	const select = doc.createElement('select');
	select.className = 'pptxv-field-select-input';
	select.setAttribute('aria-label', label);
	for (const font of COMMON_FONTS) {
		const option = doc.createElement('option');
		option.value = font;
		option.textContent = font;
		select.appendChild(option);
	}
	select.addEventListener('change', () => onChange(select.value));
	el.append(caption, select);
	return { el, select };
}

/** Select a font, adding it as an option first when the list lacks it. */
export function setFontValue(select: HTMLSelectElement, font: string): void {
	if (!Array.from(select.options).some((option) => option.value === font)) {
		const option = select.ownerDocument.createElement('option');
		option.value = font;
		option.textContent = font;
		select.appendChild(option);
	}
	select.value = font;
}
