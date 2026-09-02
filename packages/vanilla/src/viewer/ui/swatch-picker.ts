import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { AnchoredPopupHandle } from './anchored-popup';
import { attachAnchoredPopup } from './anchored-popup';
import type { IconName } from './icons';
import { createIcon } from './icons';

/**
 * Office theme-colour swatch set: no shared catalogue exists for this yet
 * (see CLAUDE.md context), so this is a reasonable standard 10-colour set
 * mirroring the "Standard Colors" row PowerPoint itself ships. Shared by both
 * the font-colour and highlight-colour pickers.
 */
export const OFFICE_STANDARD_SWATCHES: readonly string[] = [
	'#000000',
	'#ffffff',
	'#ff0000',
	'#00aa00',
	'#0000ff',
	'#ff8800',
	'#8800cc',
	'#00cccc',
	'#ff69b4',
	'#808080',
];

export interface SwatchPickerOptions {
	/** Accessible label / title for the trigger button. */
	label: string;
	/** Icon shown in the trigger (a small colour bar under it reflects the value). */
	icon: IconName;
	swatches: readonly string[];
	/** Fallback colour when no value is set yet. */
	fallback: string;
	onSelect(hex: string): void;
}

export interface SwatchPickerHandle {
	el: HTMLElement;
	setValue(hex: string | undefined): void;
	setDisabled(disabled: boolean): void;
	/** B6: refresh the "Recent colours" row (most-recent-first); hidden when empty. */
	setRecentColors(colors: readonly string[]): void;
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

	// B6: "Recent colours" - MRU picks, seeded from the deck's `p:clrMru` and
	// folded forward by every commit (`editor-recent-colors.ts`). Built above
	// the preset grid, PowerPoint's own ordering, and hidden while empty.
	const recentLabel = createEl(doc, 'div', 'pptxv-swatch-recent-label');
	recentLabel.textContent = t('pptx.colorPicker.recentColors');
	recentLabel.hidden = true;
	const recentGrid = createEl(doc, 'div', 'pptxv-swatch-grid pptxv-swatch-recent-grid');
	recentGrid.dataset.testid = 'pptx-color-recent';
	recentGrid.hidden = true;
	menu.append(recentLabel, recentGrid);

	const grid = createEl(doc, 'div', 'pptxv-swatch-grid');
	menu.appendChild(grid);

	let value = options.fallback;
	const swatchButtons = new Map<HTMLButtonElement, string>();
	const recentButtons = new Map<HTMLButtonElement, string>();

	const applySelected = (): void => {
		for (const [btn, hex] of swatchButtons) {
			btn.classList.toggle('is-selected', hex === value);
		}
		for (const [btn, hex] of recentButtons) {
			btn.classList.toggle('is-selected', hex === value);
		}
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
			if (disabled) {
				setOpen(false);
			}
		},
		setRecentColors(colors) {
			recentButtons.clear();
			recentGrid.replaceChildren();
			for (const hex of colors) {
				const btn = createEl(doc, 'button', 'pptxv-swatch');
				btn.type = 'button';
				btn.setAttribute('data-pptx-compact', '');
				btn.style.backgroundColor = hex;
				btn.setAttribute('aria-label', hex);
				btn.addEventListener('click', () => {
					setOpen(false);
					options.onSelect(hex);
				});
				recentGrid.appendChild(btn);
				recentButtons.set(btn, hex);
			}
			recentLabel.hidden = colors.length === 0;
			recentGrid.hidden = colors.length === 0;
			applySelected();
		},
	};
}
