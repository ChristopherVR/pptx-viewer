import type { Translator } from '../i18n';
import { createEl } from '../render';

/**
 * The colour popover behind the show toolbar's pen / highlighter carets.
 *
 * Split out of `presentation-toolbar.ts` purely for the file-size budget: the
 * bar builds two of these, and inlining both would have pushed the toolbar past
 * the 300 LOC ceiling. The swatch grid is the one piece of the bar that is
 * genuinely reusable, so it gets its own module rather than a copy per tool.
 */

export interface ColorPaletteOptions {
	/** Swatch colours, in grid order (shared `PEN_COLORS` / `HIGHLIGHTER_COLORS`). */
	colors: readonly string[];
	/**
	 * i18n key for a swatch's accessible name; receives the raw colour as
	 * `{{color}}` (e.g. `pptx.presentationToolbar.penColorValue`).
	 */
	swatchLabelKey: string;
	/** Fired with the picked colour; the caller closes the popover and selects the tool. */
	onPick(color: string): void;
}

export interface ColorPalette {
	/** The popover element; appended by the caller inside a positioned wrapper. */
	el: HTMLElement;
	setOpen(open: boolean): void;
	isOpen(): boolean;
	/** Mark the active swatch so the current colour is visible at a glance. */
	setValue(color: string): void;
}

/**
 * Build a hidden colour-swatch popover.
 *
 * Visibility is driven by the `hidden` attribute rather than a class, so the
 * closed state is honoured even before the viewer stylesheet is injected (the
 * toolbar's own test environment renders without it).
 */
export function createColorPalette(
	doc: Document,
	t: Translator,
	options: ColorPaletteOptions,
): ColorPalette {
	const el = createEl(doc, 'div', 'pptxv-present-palette');
	el.hidden = true;
	const swatches = options.colors.map((color) => {
		const swatch = createEl(doc, 'button', 'pptxv-present-swatch');
		swatch.type = 'button';
		swatch.dataset.pptxPresentSwatch = color;
		swatch.style.backgroundColor = color;
		const label = t(options.swatchLabelKey, { color });
		swatch.title = label;
		swatch.setAttribute('aria-label', label);
		swatch.addEventListener('click', (event) => {
			event.stopPropagation();
			options.onPick(color);
		});
		el.appendChild(swatch);
		return { color, swatch };
	});

	return {
		el,
		setOpen(open) {
			el.hidden = !open;
		},
		isOpen: () => !el.hidden,
		setValue(color) {
			for (const entry of swatches) {
				const selected = entry.color === color;
				entry.swatch.classList.toggle('is-selected', selected);
				entry.swatch.setAttribute('aria-pressed', String(selected));
			}
		},
	};
}
