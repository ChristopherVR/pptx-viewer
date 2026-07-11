import type { ChangeCaseMode } from 'pptx-viewer-shared';
import {
	CHANGE_CASE_OPTIONS,
	CHARACTER_SPACING_OPTIONS,
	COMMON_FONT_FAMILIES,
	COMMON_FONT_SIZES,
} from 'pptx-viewer-shared';

import type { TextFormatState } from '../../../editor/editor-format-mutations';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import { makeDropdown } from '../../dropdown';
import { makeSwatchPicker, OFFICE_STANDARD_SWATCHES } from '../../swatch-picker';

export interface FontGroupHandlers {
	toggleBold(): void;
	toggleItalic(): void;
	toggleUnderline(): void;
	toggleStrikethrough(): void;
	toggleTextShadow(): void;
	setFontFamily(family: string): void;
	setFontSize(size: number): void;
	changeFontSize(delta: number): void;
	setTextColor(color: string): void;
	setHighlightColor(color: string): void;
	setCharacterSpacing(value: number): void;
	changeCase(mode: ChangeCaseMode): void;
	clearFormatting(): void;
}

export interface FontGroupState {
	canFormat: boolean;
	editable: boolean;
	text: TextFormatState;
}

export interface FontGroup {
	el: HTMLElement;
	update(state: FontGroupState): void;
}

const FONT_STEP = 2;

/** The ribbon Home tab's Font group: family/size, character toggles, colours, spacing, case. */
export function createFontGroup(
	doc: Document,
	t: Translator,
	handlers: FontGroupHandlers,
): FontGroup {
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	el.appendChild(row);
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.textContent = t('pptx.ribbon.font');
	el.appendChild(label);

	const fontFamily = makeDropdown(doc, {
		triggerLabel: t('pptx.text.fontColor'),
		triggerText: 'Segoe UI',
		items: COMMON_FONT_FAMILIES.map((f) => ({ label: f, value: f, style: { fontFamily: f } })),
		onSelect: handlers.setFontFamily,
	});
	fontFamily.el.classList.add('pptxv-font-family-dd');

	const fontSize = makeDropdown(doc, {
		triggerLabel: t('pptx.textPanel.size'),
		triggerText: '18',
		items: COMMON_FONT_SIZES.map((s) => ({ label: String(s), value: s })),
		onSelect: handlers.setFontSize,
	});
	fontSize.el.classList.add('pptxv-font-size-dd');

	const bold = makeButton(doc, {
		label: t('pptx.textPanel.bold'),
		icon: 'bold',
		onClick: handlers.toggleBold,
	});
	const italic = makeButton(doc, {
		label: t('pptx.textPanel.italic'),
		icon: 'italic',
		onClick: handlers.toggleItalic,
	});
	const underline = makeButton(doc, {
		label: t('pptx.textPanel.underline'),
		icon: 'underline',
		onClick: handlers.toggleUnderline,
	});
	const strike = makeButton(doc, {
		label: t('pptx.textPanel.strikethrough'),
		icon: 'strikethrough',
		onClick: handlers.toggleStrikethrough,
	});
	const shadow = makeButton(doc, {
		label: t('pptx.textEffects.shadow'),
		icon: 'text-shadow',
		onClick: handlers.toggleTextShadow,
	});

	const shrink = makeButton(doc, {
		label: t('pptx.text.decreaseFontSize'),
		icon: 'a-down',
		onClick: () => handlers.changeFontSize(-FONT_STEP),
	});
	const grow = makeButton(doc, {
		label: t('pptx.text.increaseFontSize'),
		icon: 'a-up',
		onClick: () => handlers.changeFontSize(FONT_STEP),
	});
	const clear = makeButton(doc, {
		label: t('pptx.text.clearFormatting'),
		icon: 'clear-format',
		onClick: handlers.clearFormatting,
	});

	const charSpacing = makeDropdown(doc, {
		triggerLabel: t('pptx.text.characterSpacing'),
		triggerText: '',
		icon: 'char-spacing',
		items: CHARACTER_SPACING_OPTIONS.map((o) => ({ label: t(o.i18nKey), value: o.value })),
		onSelect: handlers.setCharacterSpacing,
	});
	charSpacing.el.querySelector('.pptxv-dropdown-text')?.remove();

	const changeCase = makeDropdown(doc, {
		triggerLabel: t('pptx.text.changeCase'),
		triggerText: '',
		icon: 'change-case',
		items: CHANGE_CASE_OPTIONS.map((o) => ({ label: t(o.i18nKey), value: o.value })),
		onSelect: handlers.changeCase,
	});
	changeCase.el.querySelector('.pptxv-dropdown-text')?.remove();

	const fontColor = makeSwatchPicker(doc, t, {
		label: t('pptx.text.fontColor'),
		icon: 'font-color',
		swatches: OFFICE_STANDARD_SWATCHES,
		fallback: '#000000',
		onSelect: handlers.setTextColor,
	});
	const highlight = makeSwatchPicker(doc, t, {
		label: t('pptx.text.highlightColor'),
		icon: 'highlight',
		swatches: OFFICE_STANDARD_SWATCHES,
		fallback: '#ffff00',
		onSelect: handlers.setHighlightColor,
	});

	row.append(
		fontFamily.el,
		fontSize.el,
		shrink.btn,
		grow.btn,
		bold.btn,
		italic.btn,
		underline.btn,
		strike.btn,
		shadow.btn,
		clear.btn,
		charSpacing.el,
		changeCase.el,
		fontColor.el,
		highlight.el,
	);

	const toggles = [bold, italic, underline, strike] as const;
	const gated = [
		fontFamily,
		fontSize,
		shrink,
		grow,
		bold,
		italic,
		underline,
		strike,
		shadow,
		clear,
		charSpacing,
		changeCase,
		fontColor,
		highlight,
	];

	return {
		el,
		update({ canFormat, editable, text }) {
			bold.setActive(text.bold);
			italic.setActive(text.italic);
			underline.setActive(text.underline);
			strike.setActive(text.strikethrough);
			shadow.setActive(text.hasTextShadow);
			fontFamily.setTriggerText(text.fontFamily ?? 'Segoe UI');
			fontFamily.setSelected(text.fontFamily);
			fontSize.setTriggerText(String(text.fontSize));
			fontSize.setSelected(text.fontSize);
			fontColor.setValue(text.color);
			highlight.setValue(text.highlightColor);

			for (const c of gated) {
				c.setDisabled(!editable || !canFormat);
			}
			for (const b of toggles) {
				if (!editable || !canFormat) {
					b.setActive(false);
				}
			}
		},
	};
}
