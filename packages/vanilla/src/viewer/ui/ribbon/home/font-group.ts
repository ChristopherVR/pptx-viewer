import type { PptxThemeColorRef } from 'pptx-viewer-core';
import type { ChangeCaseMode } from 'pptx-viewer-shared';
import {
	fontHomeControls,
	fontPickerHomeControls,
	registerPptxWebControls,
	resolveDefaultFontFamily,
} from 'pptx-viewer-shared';

import type { TextFormatState } from '../../../editor/editor-format-mutations';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { tagRibbonGroup } from '../ribbon-tagging';
import { createSharedHomeStrip } from './shared-strip';

export interface FontGroupHandlers {
	toggleBold(): void;
	toggleItalic(): void;
	toggleUnderline(): void;
	toggleStrikethrough(): void;
	toggleTextShadow(): void;
	setFontFamily(family: string): void;
	setFontSize(size: number): void;
	changeFontSize(delta: number): void;
	/** Same `ref` contract as the swatch commit: omit for a plain/custom/recent pick. */
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
	/** The deck's `p:clrMru`, most-recent-first. */
	recentColors?: readonly string[];
	/** The deck's resolved theme colour map, feeding the font-colour "Theme Colors" grid. */
	themeColorMap?: Record<string, string>;
}

export interface FontGroup {
	el: HTMLElement;
	update(state: FontGroupState): void;
}

const FONT_STEP = 2;

type FontAction = (value: string | number | undefined, ref?: PptxThemeColorRef) => void;

const EMPTY_TEXT: TextFormatState = {
	bold: false,
	italic: false,
	underline: false,
	strikethrough: false,
	hasTextShadow: false,
	fontSize: 18,
	fontFamily: undefined,
	placeholderType: undefined,
	color: undefined,
	colorRef: undefined,
	highlightColor: undefined,
	characterSpacing: 0,
	listType: 'none',
	align: undefined,
	paragraphMarginLeft: 0,
	lineSpacing: undefined,
};

/**
 * The Home tab's Font group: the shared family/size picker and the shared Font
 * strip (character toggles, spacing, case and the two colour popovers). Every
 * document edit stays with the native handlers.
 */
export function createFontGroup(
	doc: Document,
	t: Translator,
	handlers: FontGroupHandlers,
): FontGroup {
	registerPptxWebControls();
	const el = createEl(doc, 'div');
	el.dataset.pptxChrome = 'font-groups';
	const formatting = createEl(doc, 'div', 'pptxv-rgroup');
	formatting.dataset.pptxChrome = 'home-group';
	tagRibbonGroup(formatting, 'home.font');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	row.dataset.pptxChrome = 'font-controls';
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.dataset.pptxChrome = 'ribbon-group-label';
	label.textContent = t('pptx.ribbon.font');
	formatting.append(row, label);

	const picker = createSharedHomeStrip(doc, t, 'font-picker', ({ id, value }) =>
		id === 'home.font.fontFamily'
			? handlers.setFontFamily(String(value))
			: handlers.setFontSize(Number(value)),
	);
	const actions: Record<string, FontAction> = {
		'home.font.bold': () => handlers.toggleBold(),
		'home.font.italic': () => handlers.toggleItalic(),
		'home.font.underline': () => handlers.toggleUnderline(),
		'home.font.strikethrough': () => handlers.toggleStrikethrough(),
		'home.font.shadow': () => handlers.toggleTextShadow(),
		'home.font.increaseFontSize': () => handlers.changeFontSize(FONT_STEP),
		'home.font.decreaseFontSize': () => handlers.changeFontSize(-FONT_STEP),
		'home.font.clearFormatting': () => handlers.clearFormatting(),
		'home.font.characterSpacing': (value) => handlers.setCharacterSpacing(Number(value)),
		'home.font.changeCase': (value) => handlers.changeCase(value as ChangeCaseMode),
		'home.font.fontColor': (value, ref) => handlers.setTextColor(String(value), ref),
		'home.font.highlightColor': (value) => handlers.setHighlightColor(String(value)),
	};
	const strip = createSharedHomeStrip(doc, t, 'font', ({ id, value, ref }) =>
		actions[id]?.(value, ref),
	);
	// One group, two rows: family, size and the size steps above the character formatting.
	row.append(picker.el, strip.el);
	el.append(formatting);

	const update = ({
		canFormat,
		editable,
		text,
		themeFonts,
		embeddedFontFamilies,
		customFontFamilies,
		recentColors,
		themeColorMap,
	}: FontGroupState) => {
		const enabled = editable && canFormat;
		picker.set(
			fontPickerHomeControls(
				{
					enabled,
					fontFamily: text.fontFamily ?? resolveDefaultFontFamily(text.placeholderType, themeFonts),
					fontSize: text.fontSize,
					themeFonts,
					embeddedFonts: embeddedFontFamilies,
					customFonts: customFontFamilies,
				},
				t,
			),
		);
		strip.set(
			fontHomeControls({
				enabled,
				bold: Boolean(text.bold),
				italic: Boolean(text.italic),
				underline: Boolean(text.underline),
				strikethrough: Boolean(text.strikethrough),
				shadow: Boolean(text.hasTextShadow),
				characterSpacing: text.characterSpacing,
				fontColor: {
					value: text.color ?? '#000000',
					ref: text.colorRef,
					themeColors: themeColorMap,
					recent: recentColors,
				},
				highlight: { value: text.highlightColor ?? '#ffff00', recent: recentColors },
			}),
		);
	};
	update({ canFormat: false, editable: false, text: EMPTY_TEXT });
	return { el, update };
}
