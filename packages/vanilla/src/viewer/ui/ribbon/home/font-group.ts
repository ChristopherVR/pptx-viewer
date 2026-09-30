import type { PptxThemeColorRef } from 'pptx-viewer-core';
import type { ChangeCaseMode } from 'pptx-viewer-shared';
import {
	CHANGE_CASE_OPTIONS,
	CHARACTER_SPACING_OPTIONS,
	COMMON_FONT_SIZES,
	resolveDefaultFontFamily,
} from 'pptx-viewer-shared';

import type { TextFormatState } from '../../../editor/editor-format-mutations';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import { makeDropdown } from '../../dropdown';
import { makeSwatchPicker, OFFICE_STANDARD_SWATCHES } from '../../swatch-picker';
import { tagRibbonControl, tagRibbonGroup } from '../ribbon-tagging';
import { createFontSelect, setFontSelectCatalog } from './font-select';

export interface FontGroupHandlers {
	toggleBold(): void;
	toggleItalic(): void;
	toggleUnderline(): void;
	toggleStrikethrough(): void;
	toggleTextShadow(): void;
	setFontFamily(family: string): void;
	setFontSize(size: number): void;
	changeFontSize(delta: number): void;
	/** Same `ref` contract as `SwatchPickerOptions.onSelectTheme`: omit for a plain/custom/recent pick. */
	setTextColor(color: string, ref?: PptxThemeColorRef): void;
	setHighlightColor(color: string): void;
	setCharacterSpacing(value: number): void;
	changeCase(mode: ChangeCaseMode): void;
	clearFormatting(): void;
}

export interface FontGroupState {
	canFormat: boolean;
	editable: boolean;
	text: TextFormatState;
	/** Theme major/minor latin faces, leading the font dropdown. */
	themeFonts?: { heading?: string; body?: string };
	/** Families the deck embeds, offered as their own dropdown group. */
	embeddedFontFamilies?: readonly string[];
	/** Families registered this session via File > Options > Fonts. */
	customFontFamilies?: readonly string[];
	/** B6: the deck's `p:clrMru`, most-recent-first; seeds/refreshes both pickers' rows. */
	recentColors?: readonly string[];
	/** The deck's resolved theme colour map, feeding the font-colour "Theme Colors" grid. */
	themeColorMap?: Record<string, string>;
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
	const el = createEl(doc, 'div');
	el.dataset.pptxChrome = 'font-groups';
	const pickers = createEl(doc, 'div', 'pptxv-rgroup');
	const formatting = createEl(doc, 'div', 'pptxv-rgroup');
	for (const group of [pickers, formatting]) {
		group.dataset.pptxChrome = 'home-group';
		tagRibbonGroup(group, 'home.font');
	}
	el.append(pickers, formatting);
	const pickerRow = createEl(doc, 'div');
	pickerRow.dataset.pptxChrome = 'font-picker-controls';
	pickers.append(pickerRow);
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	row.dataset.pptxChrome = 'font-controls';
	formatting.appendChild(row);
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.dataset.pptxChrome = 'ribbon-group-label';
	label.textContent = t('pptx.ribbon.font');
	formatting.appendChild(label);
	pickers.appendChild(label.cloneNode(true));

	const fontFamily = createFontSelect(doc, t, 'family', handlers.setFontFamily);
	const fontSize = createFontSelect(doc, t, 'size', (value) => handlers.setFontSize(Number(value)));
	fontSize.el.replaceChildren(
		...COMMON_FONT_SIZES.map((size) => {
			const option = doc.createElement('option');
			option.value = option.textContent = String(size);
			return option;
		}),
	);

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
		onSelectTheme: (commit) => handlers.setTextColor(commit.hex, commit.ref),
	});
	const highlight = makeSwatchPicker(doc, t, {
		label: t('pptx.text.highlightColor'),
		icon: 'highlight',
		swatches: OFFICE_STANDARD_SWATCHES,
		fallback: '#ffff00',
		onSelect: handlers.setHighlightColor,
	});

	tagRibbonControl(fontFamily.el, 'home.font.fontFamily');
	tagRibbonControl(fontSize.el, 'home.font.fontSize');
	tagRibbonControl(shrink.btn, 'home.font.decreaseFontSize');
	tagRibbonControl(grow.btn, 'home.font.increaseFontSize');
	tagRibbonControl(bold.btn, 'home.font.bold');
	tagRibbonControl(italic.btn, 'home.font.italic');
	tagRibbonControl(underline.btn, 'home.font.underline');
	tagRibbonControl(strike.btn, 'home.font.strikethrough');
	tagRibbonControl(shadow.btn, 'home.font.shadow');
	tagRibbonControl(clear.btn, 'home.font.clearFormatting');
	tagRibbonControl(charSpacing.el, 'home.font.characterSpacing');
	tagRibbonControl(changeCase.el, 'home.font.changeCase');
	tagRibbonControl(fontColor.el, 'home.font.fontColor');
	tagRibbonControl(highlight.el, 'home.font.highlightColor');
	pickerRow.append(fontFamily.el, fontSize.el);
	const decoration = createEl(doc, 'div');
	const growth = createEl(doc, 'div');
	decoration.dataset.pptxChrome = growth.dataset.pptxChrome = 'control-cluster';
	decoration.append(bold.btn, italic.btn, underline.btn, strike.btn);
	growth.append(grow.btn, shrink.btn, clear.btn);
	row.append(
		decoration,
		shadow.btn,
		growth,
		charSpacing.el,
		changeCase.el,
		fontColor.el,
		highlight.el,
	);

	const toggles = [bold, italic, underline, strike] as const;
	// Formatting controls require an editable text or selected table cell.
	const gated = [
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
		update({
			canFormat,
			editable,
			text,
			themeFonts,
			embeddedFontFamilies,
			customFontFamilies,
			recentColors,
			themeColorMap,
		}) {
			// Regroup per deck: the theme fonts and the embedded set are not
			// known until a presentation has loaded.
			setFontSelectCatalog(fontFamily.el, t, {
				themeFonts,
				embeddedFonts: embeddedFontFamilies,
				customFonts: customFontFamilies,
			});
			bold.setActive(text.bold);
			italic.setActive(text.italic);
			underline.setActive(text.underline);
			strike.setActive(text.strikethrough);
			shadow.setActive(text.hasTextShadow);
			fontFamily.setTriggerText(
				text.fontFamily ?? resolveDefaultFontFamily(text.placeholderType, themeFonts),
			);
			fontSize.setTriggerText(String(text.fontSize));
			fontColor.setValue(text.color);
			highlight.setValue(text.highlightColor);
			fontColor.setRecentColors(recentColors ?? []);
			highlight.setRecentColors(recentColors ?? []);
			fontColor.setThemeColorMap(themeColorMap);
			fontColor.setSelectedRef(text.colorRef);

			fontFamily.setDisabled(!editable || !canFormat);
			fontSize.setDisabled(!editable || !canFormat);
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
