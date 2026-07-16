import type { Translator } from '../i18n';
import { createEl } from '../render';

export interface FileInfoDialogShell {
	overlay: HTMLElement;
	body: HTMLElement;
	footer: HTMLElement;
	close(): void;
}

/** Build and mount the common File Info modal frame. */
export function openFileInfoDialogShell(
	doc: Document,
	t: Translator,
	titleText: string,
): FileInfoDialogShell {
	const overlay = createEl(doc, 'div', 'pptxv-info-overlay');
	const scrim = createEl(doc, 'button', 'pptxv-info-scrim');
	const dialog = createEl(doc, 'div', 'pptxv-info-dialog');
	const close = (): void => overlay.remove();
	scrim.type = 'button';
	scrim.setAttribute('aria-label', t('pptx.common.close'));
	scrim.addEventListener('click', close);
	dialog.setAttribute('role', 'dialog');
	dialog.setAttribute('aria-modal', 'true');

	const header = createEl(doc, 'header');
	const title = createEl(doc, 'h2');
	title.textContent = titleText;
	const closeButton = createEl(doc, 'button');
	closeButton.type = 'button';
	closeButton.textContent = '×';
	closeButton.setAttribute('aria-label', t('pptx.common.close'));
	closeButton.addEventListener('click', close);
	header.append(title, closeButton);

	const body = createEl(doc, 'div', 'pptxv-info-body');
	const footer = createEl(doc, 'footer');
	dialog.append(header, body, footer);
	overlay.append(scrim, dialog);
	doc.body.appendChild(overlay);
	return { overlay, body, footer, close };
}

export function appendInfoDoneButton(
	doc: Document,
	t: Translator,
	shell: FileInfoDialogShell,
): void {
	const done = createEl(doc, 'button', 'is-primary');
	done.type = 'button';
	done.textContent = t('pptx.common.done');
	done.addEventListener('click', shell.close);
	shell.footer.appendChild(done);
}
