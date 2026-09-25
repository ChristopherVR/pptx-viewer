import { armEditorKeyboard } from 'pptx-viewer-shared';

import { createEl } from '../../../render';
import type { AnchoredPopupHandle } from '../../anchored-popup';
import { attachAnchoredPopup } from '../../anchored-popup';
import type { IconName } from '../../icons';
import { createIcon } from '../../icons';

/** One command in a {@link makeActionMenu}. */
export interface ActionMenuItem {
	label: string;
	/** `data-*` attributes stamped on the item (e.g. `{ pptxMergeOp: 'union' }`). */
	dataset?: Record<string, string>;
	/** Non-interactive heading rendered above this item, starting a group. */
	groupLabel?: string;
	run(): void;
}

export interface ActionMenuOptions {
	/** Accessible name + tooltip of the trigger. */
	label: string;
	/** Visible text on the trigger (omitted: icon only). */
	text?: string;
	icon?: IconName;
	/** `data-pptx-ribbon-control` value for the trigger. */
	control: string;
	items: readonly ActionMenuItem[];
}

export interface ActionMenuHandle {
	el: HTMLElement;
	trigger: HTMLButtonElement;
	/** Disable the trigger; `hint` becomes its tooltip while disabled. */
	setDisabled(disabled: boolean, hint?: string): void;
	close(): void;
}

/**
 * A ribbon menu button whose entries are COMMANDS (`role="menu"` /
 * `role="menuitem"`), unlike `makeDropdown`, which is a value picker
 * (`listbox` / `option`). Reuses the dropdown's classes so it looks the same,
 * and the same fixed-position anchoring so the ribbon's scroll row cannot clip
 * it.
 */
export function makeActionMenu(doc: Document, options: ActionMenuOptions): ActionMenuHandle {
	const el = createEl(doc, 'div', 'pptxv-dropdown');
	const trigger = createEl(doc, 'button', 'pptxv-dropdown-trigger');
	trigger.type = 'button';
	trigger.title = options.label;
	trigger.setAttribute('aria-label', options.label);
	trigger.setAttribute('aria-haspopup', 'menu');
	trigger.setAttribute('aria-expanded', 'false');
	trigger.dataset.pptxRibbonControl = options.control;
	if (options.icon) {
		trigger.appendChild(createIcon(doc, options.icon));
	}
	if (options.text) {
		const text = createEl(doc, 'span', 'pptxv-dropdown-text');
		text.textContent = options.text;
		trigger.appendChild(text);
	}
	trigger.appendChild(createIcon(doc, 'chevron-down'));

	const menu = createEl(doc, 'div', 'pptxv-dropdown-menu');
	menu.setAttribute('role', 'menu');
	menu.setAttribute('aria-label', options.label);
	menu.hidden = true;
	el.append(trigger, menu);

	let popup: AnchoredPopupHandle | null = null;
	const setOpen = (open: boolean): void => {
		menu.hidden = !open;
		trigger.setAttribute('aria-expanded', String(open));
		trigger.classList.toggle('is-active', open);
		popup?.destroy();
		popup = open ? attachAnchoredPopup(menu, trigger) : null;
	};

	for (const item of options.items) {
		if (item.groupLabel) {
			const heading = createEl(doc, 'div', 'pptxv-dropdown-group');
			heading.setAttribute('role', 'presentation');
			heading.textContent = item.groupLabel;
			menu.appendChild(heading);
		}
		const btn = createEl(doc, 'button', 'pptxv-dropdown-item');
		btn.type = 'button';
		btn.setAttribute('role', 'menuitem');
		btn.textContent = item.label;
		Object.assign(btn.dataset, item.dataset ?? {});
		btn.addEventListener('click', () => {
			setOpen(false);
			item.run();
			// The clicked item is now hidden, which drops focus to <body>, where
			// the editor keymap never hears Ctrl+Z; hand it back to the viewer.
			btn.blur();
			armEditorKeyboard(el.closest<HTMLElement>('.pptxv'));
		});
		menu.appendChild(btn);
	}

	trigger.addEventListener('click', (event) => {
		event.stopPropagation();
		setOpen(menu.hidden === true);
	});
	doc.addEventListener('pointerdown', (event) => {
		if (!menu.hidden && !el.contains(event.target as Node)) {
			setOpen(false);
		}
	});

	return {
		el,
		trigger,
		setDisabled(disabled, hint) {
			trigger.disabled = disabled;
			trigger.title = disabled && hint ? hint : options.label;
			if (disabled) {
				setOpen(false);
			}
		},
		close: () => setOpen(false),
	};
}
