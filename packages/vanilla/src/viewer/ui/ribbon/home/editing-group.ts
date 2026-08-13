import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';

export interface EditingGroupHandlers {
	toggleFindReplace(): void;
	selectAll(): void;
}

export interface EditingGroup {
	el: HTMLElement;
	update(state: { editable: boolean }): void;
}

/** The ribbon Home tab's Editing group: Find, Replace and the Select menu. */
export function createEditingGroup(
	doc: Document,
	t: Translator,
	handlers: EditingGroupHandlers,
): EditingGroup {
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	el.appendChild(row);
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.textContent = t('pptx.shortcuts.group.editing');
	el.appendChild(label);

	const find = makeButton(doc, {
		label: t('pptx.editing.find'),
		icon: 'search',
		onClick: handlers.toggleFindReplace,
	});
	const replace = makeButton(doc, {
		label: t('pptx.ribbon.replace'),
		icon: 'replace',
		onClick: handlers.toggleFindReplace,
	});
	// "Select" is a MENU, not a button that selects: React, Vue and Angular all
	// render a trigger named after the pointer tool with a "Select All" entry
	// hanging off it, and every framework-neutral spec addresses ribbon commands
	// by accessible name. This used to be a `makeDropdown`, whose entries carry
	// `role="option"` - a listbox option is not the command a user (or a spec)
	// looks for by the name "Select All", which is why the e2e effects spec had
	// to skip this binding entirely. Plain buttons in a plain popover, exactly
	// the other three bindings' shape.
	const select = createSelectMenu(doc, t, handlers);
	row.append(find.btn, replace.btn, select.el);

	return {
		el,
		update({ editable }) {
			select.setDisabled(!editable);
		},
	};
}

interface SelectMenu {
	el: HTMLElement;
	setDisabled(disabled: boolean): void;
}

/** The Select split control: a trigger plus the commands it opens. */
function createSelectMenu(
	doc: Document,
	t: Translator,
	handlers: EditingGroupHandlers,
): SelectMenu {
	const host = createEl(doc, 'div', 'pptxv-primary-menu-host');

	const trigger = makeButton(doc, {
		label: t('pptx.ribbon.tool.select'),
		icon: 'cursor',
		onClick: () => setOpen(!open),
	});
	trigger.btn.setAttribute('aria-haspopup', 'menu');
	trigger.btn.setAttribute('aria-expanded', 'false');

	const menu = createEl(doc, 'div', 'pptxv-primary-menu');
	// The shared popover rule right-aligns (it was written for the primary row's
	// trailing menus); this one hangs off a mid-ribbon trigger.
	menu.style.left = '0';
	menu.style.right = 'auto';
	menu.style.minWidth = '150px';
	menu.hidden = true;

	let open = false;
	const setOpen = (next: boolean): void => {
		open = next;
		menu.hidden = !next;
		trigger.btn.setAttribute('aria-expanded', String(next));
		trigger.btn.classList.toggle('is-active', next);
	};

	const selectAll = createEl(doc, 'button', 'pptxv-primary-menu-item');
	selectAll.type = 'button';
	selectAll.textContent = t('pptx.editing.selectAll');
	// Without this the click blurs the canvas first and the deselect-on-outside
	// -click handler wipes the selection the command has just made (the same
	// trap Vue's port fell into).
	selectAll.addEventListener('mousedown', (event) => event.preventDefault());
	selectAll.addEventListener('click', () => {
		setOpen(false);
		handlers.selectAll();
	});
	menu.appendChild(selectAll);

	doc.addEventListener('pointerdown', (event) => {
		if (open && !host.contains(event.target as Node)) {
			setOpen(false);
		}
	});

	host.append(trigger.btn, menu);
	return {
		el: host,
		setDisabled(disabled) {
			trigger.btn.disabled = disabled;
			selectAll.disabled = disabled;
			if (disabled) {
				setOpen(false);
			}
		},
	};
}
