import type { PptxThemeColorRef } from 'pptx-viewer-core';
import type {
	ChangeCaseMode,
	PptxUiRibbonHomeElement,
	RibbonHomeRequestEvent,
} from 'pptx-viewer-shared';
import {
	CHANGE_CASE_OPTIONS,
	CHARACTER_SPACING_OPTIONS,
	COMMON_FONT_SIZES,
	fontHomeControls,
	registerPptxWebControls,
	resolveDefaultFontFamily,
} from 'pptx-viewer-shared';

import type { TextFormatState } from '../../../editor/editor-format-mutations';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
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
	registerPptxWebControls();
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

	// Character toggles, Text Shadow, size steps and Clear Formatting are the
	// shared strip; its one intent is mapped onto the native handlers here.
	const character = doc.createElement('pptx-ui-ribbon-home-font') as PptxUiRibbonHomeElement;
	let characterState = { enabled: false, text: undefined as TextFormatState | undefined };
	const syncCharacter = () => {
		const text = characterState.text;
		character.state = {
			controls: fontHomeControls({
				enabled: characterState.enabled,
				bold: Boolean(text?.bold),
				italic: Boolean(text?.italic),
				underline: Boolean(text?.underline),
				strikethrough: Boolean(text?.strikethrough),
				shadow: Boolean(text?.hasTextShadow),
			}),
			translate: t,
		};
	};
	const characterActions: Record<string, () => void> = {
		'home.font.bold': handlers.toggleBold,
		'home.font.italic': handlers.toggleItalic,
		'home.font.underline': handlers.toggleUnderline,
		'home.font.strikethrough': handlers.toggleStrikethrough,
		'home.font.shadow': handlers.toggleTextShadow,
		'home.font.increaseFontSize': () => handlers.changeFontSize(FONT_STEP),
		'home.font.decreaseFontSize': () => handlers.changeFontSize(-FONT_STEP),
		'home.font.clearFormatting': handlers.clearFormatting,
	};
	character.addEventListener('home-request', (event) =>
		characterActions[(event as RibbonHomeRequestEvent).detail.id]?.(),
	);
	syncCharacter();

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
	tagRibbonControl(charSpacing.el, 'home.font.characterSpacing');
	tagRibbonControl(changeCase.el, 'home.font.changeCase');
	tagRibbonControl(fontColor.el, 'home.font.fontColor');
	tagRibbonControl(highlight.el, 'home.font.highlightColor');
	pickerRow.append(fontFamily.el, fontSize.el);
	row.append(character, charSpacing.el, changeCase.el, fontColor.el, highlight.el);

	// Formatting controls require an editable text or selected table cell.
	const gated = [charSpacing, changeCase, fontColor, highlight];

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
			characterState = { enabled: editable && canFormat, text };
			syncCharacter();
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
		},
	};
}
