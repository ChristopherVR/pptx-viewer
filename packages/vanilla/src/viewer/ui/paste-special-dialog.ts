/**
 * Paste Special (Ctrl/Cmd+Alt+V): offers the four Paste Special formats
 * PowerPoint's own dialog offers (Keep Source Formatting, Use Destination
 * Theme, Picture, Keep Text Only), sourced from `pptx-viewer-shared` so the
 * option set and its labels cannot drift from the post-paste "Paste Options"
 * toolbar or the other four bindings.
 */
import type { PasteSpecialFormat } from 'pptx-viewer-shared';
import { PASTE_SPECIAL_OPTIONS } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { appendDialogButton, appendRadioRow, createParityDialogShell } from './parity-dialog-shell';

export interface PasteSpecialDialogOptions {
	onConfirm(format: PasteSpecialFormat): void;
}

export function openPasteSpecialDialog(
	doc: Document,
	t: Translator,
	options: PasteSpecialDialogOptions,
): void {
	const shell = createParityDialogShell(doc, t, t('pptx.pasteSpecial.dialogTitle'));
	let selected: PasteSpecialFormat = 'keep-source-formatting';
	appendRadioRow(
		doc,
		shell.body,
		'paste-special-format',
		PASTE_SPECIAL_OPTIONS.map((option) => ({ value: option.id, label: t(option.labelKey) })),
		selected,
		(value) => {
			selected = value as PasteSpecialFormat;
		},
	);
	appendDialogButton(doc, shell.footer, t('pptx.common.cancel'), () => shell.close());
	appendDialogButton(
		doc,
		shell.footer,
		t('pptx.common.ok'),
		() => {
			shell.close();
			options.onConfirm(selected);
		},
		true,
	);
}
