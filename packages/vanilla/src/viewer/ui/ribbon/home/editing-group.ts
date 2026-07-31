import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import { makeDropdown } from '../../dropdown';

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
	// React names this control after the pointer tool ("Select") and hangs a
	// single "Select All" entry off it. Keeping both the name and the shape
	// means the menu can grow the same entries in every binding at once.
	const select = makeDropdown<() => void>(doc, {
		triggerLabel: t('pptx.ribbon.tool.select'),
		triggerText: '',
		icon: 'cursor',
		items: [{ label: t('pptx.editing.selectAll'), value: handlers.selectAll }],
		onSelect: (run) => run(),
	});
	select.el.querySelector('.pptxv-dropdown-text')?.remove();
	row.append(find.btn, replace.btn, select.el);

	return {
		el,
		update({ editable }) {
			select.setDisabled(!editable);
		},
	};
}
