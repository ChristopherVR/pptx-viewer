import type { Translator } from '../i18n';
import { createEl } from '../render';
import { openFileInfoDialogShell } from './file-info-dialog-shell';

/** Warn once when editing starts on a digitally signed deck. */
export function openSignatureStrippedDialog(
	doc: Document,
	t: Translator,
	signatureCount: number,
): HTMLElement {
	const shell = openFileInfoDialogShell(doc, t, t('pptx.digitalSignatures.strippedTitle'));
	const warning = createEl(doc, 'div', 'pptxv-info-notice is-warning');
	const icon = createEl(doc, 'b');
	icon.textContent = '!';
	const copy = createEl(doc, 'div');
	const message = createEl(doc, 'p');
	message.textContent = t('pptx.digitalSignatures.strippedMessage', { count: signatureCount });
	const detail = createEl(doc, 'p', 'pptxv-info-description');
	detail.textContent = t('pptx.digitalSignatures.editWarning');
	copy.append(message, detail);
	warning.append(icon, copy);
	shell.body.appendChild(warning);
	const cancel = createEl(doc, 'button');
	cancel.type = 'button';
	cancel.textContent = t('pptx.common.cancel');
	cancel.addEventListener('click', shell.close);
	const confirm = createEl(doc, 'button', 'is-primary');
	confirm.type = 'button';
	confirm.textContent = t('pptx.digitalSignatures.strippedConfirm');
	confirm.addEventListener('click', shell.close);
	shell.footer.append(cancel, confirm);
	return shell.overlay;
}
