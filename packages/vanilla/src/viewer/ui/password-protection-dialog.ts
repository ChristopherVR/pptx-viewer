import { getPasswordStrength, validatePasswordPair } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { openFileInfoDialogShell } from './file-info-dialog-shell';

export interface PasswordProtectionDialogOptions {
	protected: boolean;
	onSet(password: string): void;
	onRemove(): void;
}

export function openPasswordProtectionDialog(
	doc: Document,
	t: Translator,
	options: PasswordProtectionDialogOptions,
): HTMLElement {
	const shell = openFileInfoDialogShell(doc, t, t('pptx.security.protectPresentation'));
	if (options.protected) {
		const notice = createEl(doc, 'p', 'pptxv-info-protected');
		notice.textContent = `✓ ${t('pptx.security.currentlyProtected')}`;
		shell.body.appendChild(notice);
	}
	const description = createEl(doc, 'p', 'pptxv-info-description');
	description.textContent = t('pptx.security.description');
	const password = createPasswordInput(doc, t('pptx.security.password'));
	const confirmation = createPasswordInput(doc, t('pptx.security.confirmPassword'));
	const meter = createEl(doc, 'div', 'pptxv-info-strength');
	const error = createEl(doc, 'p', 'pptxv-info-error');
	error.setAttribute('role', 'alert');
	password.input.addEventListener('input', () => {
		error.textContent = '';
		const score = getPasswordStrength(password.input.value);
		meter.textContent = password.input.value ? '●'.repeat(score + 1) : '';
	});
	confirmation.input.addEventListener('input', () => (error.textContent = ''));
	shell.body.append(description, password.label, meter, confirmation.label, error);

	if (options.protected) {
		const remove = createEl(doc, 'button', 'is-danger');
		remove.type = 'button';
		remove.textContent = t('pptx.security.removePassword');
		remove.addEventListener('click', () => {
			options.onRemove();
			shell.close();
		});
		shell.footer.appendChild(remove);
	}
	const spacer = createEl(doc, 'span', 'pptxv-info-spacer');
	const cancel = createEl(doc, 'button');
	cancel.type = 'button';
	cancel.textContent = t('pptx.common.cancel');
	cancel.addEventListener('click', shell.close);
	const save = createEl(doc, 'button', 'is-primary');
	save.type = 'button';
	save.textContent = t('pptx.common.save');
	save.addEventListener('click', () => {
		const validation = validatePasswordPair(password.input.value, confirmation.input.value);
		if (validation) {
			error.textContent = t(
				validation === 'required'
					? 'pptx.security.errorPasswordRequired'
					: validation === 'mismatch'
						? 'pptx.security.errorPasswordMismatch'
						: 'pptx.security.errorPasswordTooShort',
			);
			return;
		}
		options.onSet(password.input.value);
		shell.close();
	});
	shell.footer.append(spacer, cancel, save);
	return shell.overlay;
}

function createPasswordInput(
	doc: Document,
	text: string,
): { label: HTMLElement; input: HTMLInputElement } {
	const label = createEl(doc, 'label', 'pptxv-info-field');
	const caption = createEl(doc, 'span');
	caption.textContent = text;
	const input = createEl(doc, 'input');
	input.type = 'password';
	label.append(caption, input);
	return { label, input };
}
