import type { Translator } from '../i18n';
import { createEl } from '../render';
import { appendInfoDoneButton, openFileInfoDialogShell } from './file-info-dialog-shell';

export function openDigitalSignaturesDialog(
	doc: Document,
	t: Translator,
	hasSignatures: boolean,
	signatureCount: number,
): HTMLElement {
	const shell = openFileInfoDialogShell(doc, t, t('pptx.digitalSignatures.title'));
	const status = createEl(doc, 'div', `pptxv-info-notice${hasSignatures ? ' is-signed' : ''}`);
	const icon = createEl(doc, 'b');
	icon.textContent = hasSignatures ? '✓' : 'i';
	const copy = createEl(doc, 'p');
	copy.textContent = hasSignatures
		? `${t('pptx.digitalSignatures.signed')} ${t('pptx.digitalSignatures.signatureCount', { count: signatureCount })}`
		: t('pptx.digitalSignatures.noSignatures');
	status.append(icon, copy);
	shell.body.appendChild(status);
	if (hasSignatures) {
		const warning = createEl(doc, 'div', 'pptxv-info-notice is-warning');
		const warningIcon = createEl(doc, 'b');
		warningIcon.textContent = 'i';
		const warningCopy = createEl(doc, 'p');
		warningCopy.textContent = t('pptx.digitalSignatures.editWarning');
		warning.append(warningIcon, warningCopy);
		shell.body.appendChild(warning);
	}
	appendInfoDoneButton(doc, t, shell);
	return shell.overlay;
}
