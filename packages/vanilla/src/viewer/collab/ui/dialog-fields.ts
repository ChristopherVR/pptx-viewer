import type { Translator } from '../../i18n';
import { createEl } from '../../render';

/**
 * dialog-fields.ts: small labeled form-row builders shared by
 * `share-dialog.ts` and `broadcast-dialog.ts`, so the two dialogs do not each
 * reimplement the same label + input markup.
 */

export interface FieldControl {
	el: HTMLElement;
	input: HTMLInputElement;
}

/** A labeled text input row (room id / display name / server url fields). */
export function createTextField(
	doc: Document,
	label: string,
	placeholder: string,
	onInput: (value: string) => void,
): FieldControl {
	const el = createEl(doc, 'div', 'pptxv-modal-field');
	const labelEl = createEl(doc, 'label', 'pptxv-modal-label');
	labelEl.textContent = label;
	el.appendChild(labelEl);
	const input = doc.createElement('input');
	input.type = 'text';
	input.className = 'pptxv-modal-input';
	input.placeholder = placeholder;
	input.addEventListener('input', () => onInput(input.value));
	el.appendChild(input);
	return { el, input };
}

export interface CopyFieldControl {
	el: HTMLElement;
	input: HTMLInputElement;
	setValue(value: string): void;
	setCopied(copied: boolean): void;
}

/** A readonly value row with a copy-to-clipboard button (the share/viewer link). */
export function createCopyField(
	doc: Document,
	t: Translator,
	label: string,
	onCopy: () => void,
): CopyFieldControl {
	const el = createEl(doc, 'div', 'pptxv-modal-field');
	const labelEl = createEl(doc, 'label', 'pptxv-modal-label');
	labelEl.textContent = label;
	el.appendChild(labelEl);
	const row = createEl(doc, 'div', 'pptxv-modal-link-row');
	el.appendChild(row);
	const input = doc.createElement('input');
	input.type = 'text';
	input.className = 'pptxv-modal-input';
	input.readOnly = true;
	input.addEventListener('focus', () => input.select());
	row.appendChild(input);
	const copyBtn = createEl(doc, 'button', 'pptxv-modal-btn');
	copyBtn.type = 'button';
	copyBtn.textContent = t('pptx.broadcast.copyLinkBtn');
	copyBtn.addEventListener('click', onCopy);
	row.appendChild(copyBtn);
	return {
		el,
		input,
		setValue(value) {
			input.value = value;
		},
		setCopied(copied) {
			copyBtn.textContent = copied ? t('pptx.share.copied') : t('pptx.broadcast.copyLinkBtn');
		},
	};
}
