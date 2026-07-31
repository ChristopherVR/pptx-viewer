import { createEl } from '../render';
import type { IconName } from './icons';
import { createIcon } from './icons';

/** One choice offered by a {@link makeSelectButton} picker. */
export interface SelectButtonItem<T> {
	label: string;
	value: T;
}

export interface SelectButtonOptions<T> {
	/** Accessible name of the `<select>` (e.g. "Shape type"). */
	selectLabel: string;
	/** Accessible name and visible text of the commit button (e.g. "Shape"). */
	buttonLabel: string;
	/** Optional longer hover text for the commit button (e.g. "Add shape"). */
	buttonTitle?: string;
	icon?: IconName;
	items: ReadonlyArray<SelectButtonItem<T>>;
	onCommit(value: T): void;
}

export interface SelectButtonHandle<T> {
	el: HTMLElement;
	/** Disables the commit button only; the choice list stays browsable. */
	setDisabled(disabled: boolean): void;
	value(): T | undefined;
}

/**
 * A native `<select>` paired with a commit button, the shape PowerPoint (and
 * React's Insert tab) uses for "pick a kind, then insert one".
 *
 * A `<select>` rather than this binding's own popover dropdown on purpose: the
 * choice is a value the user leaves parked between insertions, not a one-shot
 * command, and a native select is the control every binding renders for it, so
 * the ribbons stay comparable control for control.
 */
export function makeSelectButton<T>(
	doc: Document,
	options: SelectButtonOptions<T>,
): SelectButtonHandle<T> {
	const el = createEl(doc, 'div', 'pptxv-select-button');

	const select = doc.createElement('select');
	select.className = 'pptxv-select-button-select';
	select.title = options.selectLabel;
	select.setAttribute('aria-label', options.selectLabel);
	// Options are addressed by index so any value type (not just strings) works.
	for (const [index, item] of options.items.entries()) {
		const option = doc.createElement('option');
		option.value = String(index);
		option.textContent = item.label;
		select.appendChild(option);
	}
	el.appendChild(select);

	const button = createEl(doc, 'button', 'pptxv-btn pptxv-btn-pill pptxv-select-button-commit');
	button.type = 'button';
	button.title = options.buttonTitle ?? options.buttonLabel;
	button.setAttribute('aria-label', options.buttonLabel);
	if (options.icon) {
		button.appendChild(createIcon(doc, options.icon));
	}
	const text = createEl(doc, 'span', 'pptxv-btn-label');
	text.textContent = options.buttonLabel;
	button.appendChild(text);
	el.appendChild(button);

	const value = (): T | undefined => options.items[Number(select.value)]?.value;
	button.addEventListener('click', () => {
		const picked = value();
		if (picked !== undefined) {
			options.onCommit(picked);
		}
	});

	return {
		el,
		setDisabled(disabled) {
			button.disabled = disabled;
		},
		value,
	};
}
