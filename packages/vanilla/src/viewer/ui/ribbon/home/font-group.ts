import type { PptxThemeColorRef } from 'pptx-viewer-core';
import type { ChangeCaseMode, FontCatalogInput } from 'pptx-viewer-shared';
import {
	buildFontCatalog,
	CHANGE_CASE_OPTIONS,
	CHARACTER_SPACING_OPTIONS,
	COMMON_FONT_SIZES,
	resolveDefaultFontFamily,
} from 'pptx-viewer-shared';

import type { TextFormatState } from '../../../editor/editor-format-mutations';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { DropdownItem } from '../../dropdown';
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

/**
 * Flatten the shared font catalogue into dropdown items, tagging the first
 * entry of each group with its heading.
 *
 * The grouping and de-duplication decisions live in `pptx-viewer-shared` so
 * every binding offers the same list; this only maps them onto the vanilla
 * dropdown's item shape.
 */
function buildFontItems(t: Translator, input: FontCatalogInput): DropdownItem<string>[] {
	return buildFontCatalog(input).flatMap((group) =>
		group.entries.map((entry, index) => ({
			label: entry.family,
			value: entry.family,
			style: { fontFamily: entry.family },
			...(index === 0 ? { groupLabel: t(group.labelKey) } : {}),
			...(entry.themeRole ? { hint: t(`pptx.font.role.${entry.themeRole}`) } : {}),
		})),
	);
}

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
		triggerLabel: t('pptx.ribbon.fontFamily'),
		triggerText: 'Segoe UI',
		items: buildFontItems(t, {}),
		onSelect: handlers.setFontFamily,
	});
	fontFamily.el.classList.add('pptxv-font-family-dd');

	const fontSize = makeDropdown(doc, {
		triggerLabel: t('pptx.ribbon.fontSize'),
		triggerText: '24',
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
		onSelectTheme: (commit) => handlers.setTextColor(commit.hex, commit.ref),
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
	// The family/size pickers stay usable without a selection (they park a value
	// the next edit uses), which is how every other binding gates them; only the
	// mutating controls need something formattable selected.
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
			fontFamily.setItems(
				buildFontItems(t, {
					themeFonts,
					embeddedFonts: embeddedFontFamilies,
					customFonts: customFontFamilies,
				}),
			);
			bold.setActive(text.bold);
			italic.setActive(text.italic);
			underline.setActive(text.underline);
			strike.setActive(text.strikethrough);
			shadow.setActive(text.hasTextShadow);
			fontFamily.setTriggerText(
				text.fontFamily ?? resolveDefaultFontFamily(text.placeholderType, themeFonts),
			);
			fontFamily.setSelected(text.fontFamily);
			fontSize.setTriggerText(String(text.fontSize));
			fontSize.setSelected(text.fontSize);
			fontColor.setValue(text.color);
			highlight.setValue(text.highlightColor);
			fontColor.setRecentColors(recentColors ?? []);
			highlight.setRecentColors(recentColors ?? []);
			fontColor.setThemeColorMap(themeColorMap);
			fontColor.setSelectedRef(text.colorRef);

			fontFamily.setDisabled(!editable);
			fontSize.setDisabled(!editable);
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
