import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';

export interface ClipboardGroupHandlers {
	copy(): void;
	cut(): void;
	paste(): void;
	duplicate(): void;
	delete(): void;
}

export interface ClipboardGroupState {
	hasSelection: boolean;
	hasClipboard: boolean;
	editable: boolean;
}

export interface ClipboardGroup {
	el: HTMLElement;
	update(state: ClipboardGroupState): void;
}

/** The ribbon Home tab's Clipboard group: paste, cut, copy, duplicate, delete. */
export function createClipboardGroup(
	doc: Document,
	t: Translator,
	handlers: ClipboardGroupHandlers,
): ClipboardGroup {
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	el.appendChild(row);
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.textContent = t('pptx.ribbon.clipboard');
	el.appendChild(label);

	const paste = makeButton(doc, {
		label: t('pptx.arrange.paste'),
		icon: 'paste',
		onClick: handlers.paste,
	});
	const cut = makeButton(doc, { label: t('pptx.arrange.cut'), icon: 'cut', onClick: handlers.cut });
	const copy = makeButton(doc, {
		label: t('pptx.arrange.copy'),
		icon: 'copy',
		onClick: handlers.copy,
	});
	const duplicate = makeButton(doc, {
		label: t('pptx.arrange.duplicate'),
		icon: 'duplicate',
		onClick: handlers.duplicate,
	});
	const del = makeButton(doc, {
		label: t('pptx.arrange.delete'),
		icon: 'trash',
		onClick: handlers.delete,
	});
	row.append(paste.btn, cut.btn, copy.btn, duplicate.btn, del.btn);

	return {
		el,
		update({ hasSelection, hasClipboard, editable }) {
			paste.setDisabled(!editable || !hasClipboard);
			cut.setDisabled(!editable || !hasSelection);
			copy.setDisabled(!hasSelection);
			duplicate.setDisabled(!editable || !hasSelection);
			del.setDisabled(!editable || !hasSelection);
		},
	};
}
