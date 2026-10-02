import type { Translator } from '../i18n';
import { createEl } from '../render';
import { appendDialogFooter } from './dialog-footer';
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
	appendDialogFooter(
		doc,
		shell.footer,
		[
			{ id: 'cancel', label: t('pptx.common.cancel') },
			{ id: 'confirm', label: t('pptx.digitalSignatures.strippedConfirm'), variant: 'warning' },
		],
		shell.close,
	);
	return shell.overlay;
}
