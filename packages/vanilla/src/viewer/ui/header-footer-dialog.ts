import type { PptxHeaderFooter } from 'pptx-viewer-core';
import { cloneHeaderFooterDraft } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { appendCheckRow, appendDialogButton, createParityDialogShell } from './parity-dialog-shell';

export interface HeaderFooterDialogOptions {
	value: PptxHeaderFooter;
	onApply(value: PptxHeaderFooter, target: 'all' | 'current'): void;
}

export function openHeaderFooterDialog(
	doc: Document,
	t: Translator,
	options: HeaderFooterDialogOptions,
): void {
	const shell = createParityDialogShell(doc, t, t('pptx.headerFooter.title'));
	const draft = cloneHeaderFooterDraft(options.value);
	const date = appendCheckRow(
		doc,
		shell.body,
		t('pptx.headerFooter.dateAndTime'),
		Boolean(draft.hasDateTime),
	);
	const slide = appendCheckRow(
		doc,
		shell.body,
		t('pptx.headerFooter.slideNumber'),
		Boolean(draft.hasSlideNumber),
	);
	const footer = appendCheckRow(
		doc,
		shell.body,
		t('pptx.headerFooter.footer'),
		Boolean(draft.hasFooter),
	);
	const input = createEl(doc, 'input');
	input.type = 'text';
	input.value = draft.footerText ?? '';
	input.placeholder = t('pptx.headerFooter.footerPlaceholder');
	input.hidden = !footer.checked;
	shell.body.appendChild(input);
	footer.addEventListener('change', () => {
		input.hidden = !footer.checked;
	});
	const apply = (target: 'all' | 'current'): void => {
		options.onApply(
			{
				...draft,
				hasDateTime: date.checked,
				hasSlideNumber: slide.checked,
				hasFooter: footer.checked,
				footerText: input.value,
			},
			target,
		);
		shell.close();
	};
	appendDialogButton(doc, shell.footer, t('pptx.headerFooter.applyToAll'), () => apply('all'));
	appendDialogButton(
		doc,
		shell.footer,
		t('pptx.headerFooter.applyToCurrent'),
		() => apply('current'),
		true,
	);
}
