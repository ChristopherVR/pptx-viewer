import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';

export interface EditingGroupHandlers {
	toggleFindReplace(): void;
}

export interface EditingGroup {
	el: HTMLElement;
}

/** The ribbon Home tab's Editing group: Find and Replace launchers. */
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
	row.append(find.btn, replace.btn);

	return { el };
}
