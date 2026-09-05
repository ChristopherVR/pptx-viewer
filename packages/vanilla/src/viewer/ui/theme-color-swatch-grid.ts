import type { PptxThemeColorRef } from 'pptx-viewer-core';
import type { ThemeColorPickerCommit } from 'pptx-viewer-shared';
import {
	buildThemeColorSwatchGrid,
	findSelectedThemeSwatch,
	themeColorSwatchRows,
	themeSwatchCommit,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

/**
 * PowerPoint's "Theme Colors" grid: ten columns (Background 1, Text 1,
 * Background 2, Text 2, Accent 1..6) each with a base swatch and five
 * luminance variants, built from the loaded deck's real theme colours
 * rather than a hard-coded Office palette.
 *
 * Mirrors `recent-colors-row.ts`'s handle contract: a container hidden while
 * there is nothing to show (no theme loaded yet), rebuilt on
 * `setThemeColorMap`, and `onPick` fires the caller's own commit path with
 * BOTH the resolved hex and the ref to store.
 */
export interface ThemeColorSwatchGridHandle {
	el: HTMLElement;
	/** Replace the deck's theme colour map (scheme key -> hex); hides the grid when `undefined`. */
	setThemeColorMap(themeColorMap: Record<string, string> | undefined): void;
	/** Highlight the swatch matching the element's current ref/hex, if any. */
	setSelected(ref: PptxThemeColorRef | undefined, hex: string | undefined): void;
	setDisabled(disabled: boolean): void;
}

export function createThemeColorSwatchGrid(
	doc: Document,
	t: Translator,
	onPick: (commit: ThemeColorPickerCommit) => void,
): ThemeColorSwatchGridHandle {
	const el = createEl(doc, 'div', 'pptxv-theme-swatch-grid');
	el.hidden = true;

	const labelEl = createEl(doc, 'div', 'pptxv-theme-swatch-grid-label');
	labelEl.textContent = t('pptx.colorPicker.themeColors');
	el.appendChild(labelEl);

	const rowsEl = createEl(doc, 'div', 'pptxv-theme-swatch-grid-rows');
	el.appendChild(rowsEl);

	let disabled = false;
	let selectedRef: PptxThemeColorRef | undefined;
	let selectedHex: string | undefined;
	let columns = buildThemeColorSwatchGrid(undefined);
	const buttons: HTMLButtonElement[] = [];

	const rebuild = (): void => {
		rowsEl.replaceChildren();
		buttons.length = 0;
		const rows = themeColorSwatchRows(columns);
		const selected = findSelectedThemeSwatch(columns, selectedRef, selectedHex);
		for (const row of rows) {
			const rowEl = createEl(doc, 'div', 'pptxv-theme-swatch-grid-row');
			for (const swatch of row) {
				if (!swatch) {
					rowEl.appendChild(createEl(doc, 'div', 'pptxv-theme-swatch-grid-empty'));
					continue;
				}
				const btn = createEl(doc, 'button', 'pptxv-theme-swatch-grid-swatch');
				btn.type = 'button';
				btn.setAttribute('data-pptx-compact', '');
				btn.style.backgroundColor = swatch.hex;
				btn.title = swatch.label;
				btn.setAttribute('aria-label', swatch.label);
				btn.disabled = disabled;
				btn.classList.toggle('is-selected', swatch === selected);
				btn.addEventListener('click', () => onPick(themeSwatchCommit(swatch)));
				rowEl.appendChild(btn);
				buttons.push(btn);
			}
			rowsEl.appendChild(rowEl);
		}
		el.hidden = columns.length === 0;
	};

	return {
		el,
		setThemeColorMap(themeColorMap) {
			columns = buildThemeColorSwatchGrid(themeColorMap);
			rebuild();
		},
		setSelected(ref, hex) {
			selectedRef = ref;
			selectedHex = hex;
			rebuild();
		},
		setDisabled(next) {
			disabled = next;
			for (const btn of buttons) {
				btn.disabled = next;
			}
		},
	};
}
