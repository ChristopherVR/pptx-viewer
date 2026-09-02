import type { Translator } from '../i18n';
import { createEl } from '../render';

/**
 * B6: the reusable "Recent colours" (`p:clrMru`) swatch row, shown under a
 * colour input (fill, stroke, text) or inside a swatch-picker's popup menu
 * (ribbon font-colour / shape-fill / shape-outline). Extracted from
 * `swatch-picker.ts`'s previously inline recent grid so every colour surface
 * (ribbon popovers AND the property inspector) shares one implementation
 * instead of a copy-pasted grid each.
 *
 * Row contract (asserted by the cross-binding e2e spec): a single container
 * carrying `data-testid="pptx-color-recent"` and an `aria-label` matching the
 * visible label text, one `<button type="button">` per colour (most-recent
 * first) with `title="<hex>"` / `aria-label="Recent <hex>"`, and the whole
 * row hidden while the list is empty.
 */
export interface RecentColorsRowHandle {
	el: HTMLElement;
	/** Replace the shown colours (most-recent-first); hides the row when empty. */
	setColors(colors: readonly string[]): void;
	setDisabled(disabled: boolean): void;
	/** Highlight the swatch matching the picker's current value, if any (swatch-picker only). */
	setSelected(hex: string | undefined): void;
}

/** Build a "Recent colours" row. `onSelect` fires the same commit path the picker's own change handler uses. */
export function createRecentColorsRow(
	doc: Document,
	t: Translator,
	onSelect: (hex: string) => void,
): RecentColorsRowHandle {
	const label = t('pptx.colorPicker.recentColors');

	const el = createEl(doc, 'div', 'pptxv-recent-colors');
	el.dataset.testid = 'pptx-color-recent';
	el.setAttribute('aria-label', label);
	el.hidden = true;

	const labelEl = createEl(doc, 'div', 'pptxv-recent-colors-label');
	labelEl.textContent = label;
	el.appendChild(labelEl);

	const grid = createEl(doc, 'div', 'pptxv-swatch-grid pptxv-recent-colors-grid');
	el.appendChild(grid);

	let disabled = false;
	let selected: string | undefined;
	const buttons = new Map<HTMLButtonElement, string>();

	const applySelected = (): void => {
		for (const [btn, hex] of buttons) {
			btn.classList.toggle('is-selected', hex === selected);
		}
	};

	return {
		el,
		setColors(colors) {
			grid.replaceChildren();
			buttons.clear();
			for (const hex of colors ?? []) {
				const btn = createEl(doc, 'button', 'pptxv-swatch');
				btn.type = 'button';
				btn.setAttribute('data-pptx-compact', '');
				btn.style.backgroundColor = hex;
				btn.title = hex;
				btn.setAttribute('aria-label', `Recent ${hex}`);
				btn.disabled = disabled;
				btn.addEventListener('click', () => onSelect(hex));
				grid.appendChild(btn);
				buttons.set(btn, hex);
			}
			el.hidden = colors.length === 0;
			applySelected();
		},
		setDisabled(next) {
			disabled = next;
			for (const btn of buttons.keys()) {
				btn.disabled = next;
			}
		},
		setSelected(hex) {
			selected = hex;
			applySelected();
		},
	};
}
