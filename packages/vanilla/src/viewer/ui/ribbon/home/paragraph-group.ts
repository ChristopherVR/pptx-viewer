import type { TextStyle } from 'pptx-viewer-core';
import { LINE_SPACING_OPTIONS } from 'pptx-viewer-shared';

import type { TextFormatState } from '../../../editor/editor-format-mutations';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import { makeDropdown } from '../../dropdown';
import type { IconName } from '../../icons';

export interface ParagraphGroupHandlers {
	toggleBulletList(): void;
	toggleNumberedList(): void;
	increaseIndent(): void;
	decreaseIndent(): void;
	setTextAlign(align: TextStyle['align']): void;
	setLineSpacing(value: number): void;
}

export interface ParagraphGroupState {
	canFormat: boolean;
	editable: boolean;
	text: TextFormatState;
}

export interface ParagraphGroup {
	el: HTMLElement;
	update(state: ParagraphGroupState): void;
}

const ALIGN_BUTTONS: ReadonlyArray<{
	align: NonNullable<TextStyle['align']>;
	icon: IconName;
	labelKey: string;
}> = [
	{ align: 'left', icon: 'align-left', labelKey: 'pptx.ribbon.alignLeft' },
	{ align: 'center', icon: 'align-center', labelKey: 'pptx.ribbon.alignCenter' },
	{ align: 'right', icon: 'align-right', labelKey: 'pptx.ribbon.alignRight' },
	{ align: 'justify', icon: 'align-justify', labelKey: 'pptx.ribbon.justify' },
];

/** The ribbon Home tab's Paragraph group: bullets/numbering, indent, align, line spacing. */
export function createParagraphGroup(
	doc: Document,
	t: Translator,
	handlers: ParagraphGroupHandlers,
): ParagraphGroup {
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	el.appendChild(row);
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.textContent = t('pptx.ribbon.paragraph');
	el.appendChild(label);

	const bullets = makeButton(doc, {
		label: t('pptx.text.bulletList'),
		icon: 'bullet-list',
		onClick: handlers.toggleBulletList,
	});
	const numbered = makeButton(doc, {
		label: t('pptx.text.numberedList'),
		icon: 'numbered-list',
		onClick: handlers.toggleNumberedList,
	});
	const indentDec = makeButton(doc, {
		label: t('pptx.text.decreaseIndent'),
		icon: 'indent-decrease',
		onClick: handlers.decreaseIndent,
	});
	const indentInc = makeButton(doc, {
		label: t('pptx.text.increaseIndent'),
		icon: 'indent-increase',
		onClick: handlers.increaseIndent,
	});
	const alignButtons = ALIGN_BUTTONS.map((def) =>
		makeButton(doc, {
			label: t(def.labelKey),
			icon: def.icon,
			onClick: () => handlers.setTextAlign(def.align),
		}),
	);
	const lineSpacing = makeDropdown(doc, {
		triggerLabel: t('pptx.paragraph.lineSpacing'),
		triggerText: '',
		icon: 'line-spacing',
		items: LINE_SPACING_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
		onSelect: handlers.setLineSpacing,
	});
	lineSpacing.el.querySelector('.pptxv-dropdown-text')?.remove();

	row.append(
		bullets.btn,
		numbered.btn,
		indentDec.btn,
		indentInc.btn,
		...alignButtons.map((b) => b.btn),
		lineSpacing.el,
	);

	const gated = [bullets, numbered, indentDec, indentInc, ...alignButtons, lineSpacing];

	return {
		el,
		update({ canFormat, editable, text }) {
			bullets.setActive(text.listType === 'bullet');
			numbered.setActive(text.listType === 'numbered');
			for (const [i, def] of ALIGN_BUTTONS.entries()) {
				alignButtons[i].setActive(text.align === def.align);
			}
			lineSpacing.setSelected(text.lineSpacing);
			for (const c of gated) {
				c.setDisabled(!editable || !canFormat);
			}
		},
	};
}
