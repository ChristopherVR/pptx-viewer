import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';

export interface ClipboardGroupHandlers {
	copy(): void;
	cut(): void;
	paste(): void;
	toggleFormatPainter(): void;
}

export interface ClipboardGroupState {
	hasSelection: boolean;
	hasClipboard: boolean;
	editable: boolean;
	formatPainterActive: boolean;
}

export interface ClipboardGroup {
	el: HTMLElement;
	update(state: ClipboardGroupState): void;
}

/** The ribbon Home tab's Clipboard group: paste, cut, copy, format painter (matches React). */
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
	const painter = makeButton(doc, {
		label: t('pptx.arrange.formatPainter'),
		icon: 'copy',
		onClick: handlers.toggleFormatPainter,
	});
	painter.btn.dataset.testid = 'format-painter-toggle';
	row.append(paste.btn, cut.btn, copy.btn, painter.btn);

	return {
		el,
		update({ hasSelection, hasClipboard, editable, formatPainterActive }) {
			// Cut and Copy act on the selection, so with nothing selected they are
			// no-ops. They used to render live because the Arrange group carried a
			// second, selection-aware trio; that duplicate is gone, so the gating
			// has to live here, which is also where PowerPoint puts it.
			paste.setDisabled(!editable || !hasClipboard);
			cut.setDisabled(!editable || !hasSelection);
			copy.setDisabled(!hasSelection);
			painter.setDisabled(!editable || (!hasSelection && !formatPainterActive));
			painter.btn.dataset.active = String(formatPainterActive);
		},
	};
}
