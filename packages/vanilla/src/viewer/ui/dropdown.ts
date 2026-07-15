import { createEl } from '../render';
import type { IconName } from './icons';
import { createIcon } from './icons';

/** One selectable entry in a {@link makeDropdown} menu. */
export interface DropdownItem<T> {
	label: string;
	value: T;
	/** Optional inline style applied to the item's label (e.g. `fontFamily`). */
	style?: Partial<CSSStyleDeclaration>;
}

export interface DropdownOptions<T> {
	/** Accessible label / title for the trigger button. */
	triggerLabel: string;
	/** Visible text on the trigger button (kept in sync via `setTriggerText`). */
	triggerText: string;
	items: ReadonlyArray<DropdownItem<T>>;
	onSelect(value: T): void;
	/** Trailing chevron icon; defaults to `'chevron-down'`. */
	icon?: IconName;
}

export interface DropdownHandle<T> {
	el: HTMLElement;
	setDisabled(disabled: boolean): void;
	setTriggerText(text: string): void;
	/** Highlight the item matching `value` (adds `is-selected`); pass `undefined` to clear. */
	setSelected(value: T | undefined): void;
	close(): void;
}

/**
 * A small popover dropdown: a pill trigger button that opens a scrollable list
 * of items on click, closing on selection or an outside pointerdown. Shared by
 * every ribbon group that needs a labelled choice list (font family/size, line
 * spacing, character spacing, change case, ...).
 */
export function makeDropdown<T>(doc: Document, options: DropdownOptions<T>): DropdownHandle<T> {
	const el = createEl(doc, 'div', 'pptxv-dropdown');

	const trigger = createEl(doc, 'button', 'pptxv-dropdown-trigger');
	trigger.type = 'button';
	trigger.title = options.triggerLabel;
	trigger.setAttribute('aria-label', options.triggerLabel);
	trigger.setAttribute('aria-haspopup', 'listbox');
	trigger.setAttribute('aria-expanded', 'false');
	const textEl = createEl(doc, 'span', 'pptxv-dropdown-text');
	textEl.textContent = options.triggerText;
	trigger.appendChild(textEl);
	trigger.appendChild(createIcon(doc, options.icon ?? 'chevron-down'));
	el.appendChild(trigger);

	const menu = createEl(doc, 'div', 'pptxv-dropdown-menu');
	menu.setAttribute('role', 'listbox');
	menu.setAttribute('aria-label', options.triggerLabel);
	menu.hidden = true;
	el.appendChild(menu);

	let isOpen = false;
	let selected: T | undefined;
	const itemButtons = new Map<HTMLButtonElement, T>();

	const setOpen = (open: boolean): void => {
		isOpen = open;
		menu.hidden = !open;
		trigger.setAttribute('aria-expanded', String(open));
		trigger.classList.toggle('is-active', open);
	};

	const applySelected = (): void => {
		for (const [btn, value] of itemButtons) {
			const isSelected = selected !== undefined && value === selected;
			btn.classList.toggle('is-selected', isSelected);
			btn.setAttribute('aria-selected', String(isSelected));
		}
	};

	for (const item of options.items) {
		const btn = createEl(doc, 'button', 'pptxv-dropdown-item');
		btn.type = 'button';
		btn.setAttribute('role', 'option');
		btn.setAttribute('aria-selected', 'false');
		btn.textContent = item.label;
		if (item.style) {
			Object.assign(btn.style, item.style);
		}
		btn.addEventListener('click', () => {
			setOpen(false);
			options.onSelect(item.value);
		});
		menu.appendChild(btn);
		itemButtons.set(btn, item.value);
	}

	trigger.addEventListener('click', (event) => {
		event.stopPropagation();
		setOpen(!isOpen);
	});
	doc.addEventListener('pointerdown', (event) => {
		if (isOpen && !el.contains(event.target as Node)) {
			setOpen(false);
		}
	});

	return {
		el,
		setDisabled(disabled) {
			trigger.disabled = disabled;
			if (disabled) {
				setOpen(false);
			}
		},
		setTriggerText(text) {
			textEl.textContent = text;
		},
		setSelected(value) {
			selected = value;
			applySelected();
		},
		close: () => setOpen(false),
	};
}
