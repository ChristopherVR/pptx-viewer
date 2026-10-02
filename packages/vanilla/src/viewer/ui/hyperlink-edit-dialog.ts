import type { PptxElement } from 'pptx-viewer-core';
import {
	buildClearHyperlinkPatch,
	buildHyperlinkPatch,
	seedHyperlinkDraft,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { appendDialogActions } from './dialog-footer';
import { createParityDialogShell } from './parity-dialog-shell';

export function openHyperlinkEditDialog(
	doc: Document,
	t: Translator,
	element: PptxElement,
	onApply: (patch: Partial<PptxElement>) => void,
): void {
	const shell = createParityDialogShell(doc, t, t('pptx.hyperlink.editTitle'));
	const draft = seedHyperlinkDraft(element);
	const field = (label: string, value: string): HTMLInputElement => {
		const row = createEl(doc, 'label', 'pptxv-parity-select');
		const caption = createEl(doc, 'span');
		caption.textContent = label;
		const input = createEl(doc, 'input');
		input.type = 'text';
		input.value = value;
		row.append(caption, input);
		shell.body.appendChild(row);
		return input;
	};
	const url = field(t('pptx.hyperlink.urlLabel'), draft.url);
	url.placeholder = t('pptx.hyperlink.urlPlaceholder');
	const tooltip = field(t('pptx.hyperlink.tooltipLabel'), draft.tooltip);
	appendDialogActions(doc, shell.footer, [
		{
			id: 'remove',
			label: t('pptx.hyperlinkDialog.removeLink'),
			align: 'start',
			run: () => {
				onApply(buildClearHyperlinkPatch());
				shell.close();
			},
		},
		{ id: 'cancel', label: t('pptx.common.cancel'), run: shell.close },
		{
			id: 'apply',
			label: t('pptx.hyperlinkDialog.apply'),
			variant: 'primary',
			run: () => {
				onApply(buildHyperlinkPatch(element, { url: url.value, tooltip: tooltip.value }));
				shell.close();
			},
		},
	]);
}
