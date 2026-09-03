/**
 * text-format-presets.ts: Home-tab text formatting preset catalogues shared
 * by every binding's toolbar.
 *
 * Pure data: the font family and font size dropdown lists, the
 * character-spacing and line-spacing preset lists, and the change-case
 * option list (the actual case-rewrite logic lives in
 * {@link "./text-case-transform"}; this module only supplies the dropdown's
 * i18n-keyed option list). Each binding renders its own dropdowns from these.
 *
 * @module render/text-format-presets
 */
import type { ChangeCaseMode } from './text-case-transform';

/**
 * Regular-text font sizes are stored in slide/CSS pixels in the shared model,
 * while PowerPoint's font controls and the preset list below use points.
 */
export function textFontSizePxToPt(fontSizePx: number): number {
	// DrawingML stores regular text sizes in hundredths of a point. Normalising
	// to that precision removes binary floating-point noise without discarding
	// valid authored values such as 10.5 pt or 48.1 pt.
	return Math.round(fontSizePx * (72 / 96) * 100) / 100;
}

/** Convert a PowerPoint font-control value in points to the model's pixels. */
export function textFontSizePtToPx(fontSizePt: number): number {
	return fontSizePt * (96 / 72);
}

/**
 * Font families offered by the Home-tab font dropdown, alphabetically.
 *
 * Covers the families PowerPoint's own list leads with (the Office UI faces,
 * the Aptos family that replaced Calibri as the default theme font, and the
 * classic Windows/Mac core fonts) plus the handful of web faces decks
 * routinely arrive with. Entries the host cannot resolve simply fall back
 * through the CSS font stack, so listing a family costs nothing but gives the
 * user a name to pick when the deck already references it.
 */
export const COMMON_FONT_FAMILIES: readonly string[] = [
	'Abadi',
	'Aptos',
	'Aptos Display',
	'Arial',
	'Arial Black',
	'Arial Narrow',
	'Bahnschrift',
	'Book Antiqua',
	'Bookman Old Style',
	'Calibri',
	'Calibri Light',
	'Cambria',
	'Candara',
	'Century Gothic',
	'Comic Sans MS',
	'Consolas',
	'Corbel',
	'Courier New',
	'Franklin Gothic Book',
	'Franklin Gothic Medium',
	'Garamond',
	'Georgia',
	'Gill Sans MT',
	'Helvetica',
	'Impact',
	'Inter',
	'Lucida Console',
	'Lucida Sans Unicode',
	'Microsoft Sans Serif',
	'Montserrat',
	'Noto Sans',
	'Open Sans',
	'Palatino Linotype',
	'Poppins',
	'Roboto',
	'Rockwell',
	'Segoe UI',
	'Source Sans Pro',
	'Tahoma',
	'Times New Roman',
	'Trebuchet MS',
	'Tw Cen MT',
	'Verdana',
];

/** Font sizes (pt) offered by the Home-tab size dropdown. */
export const COMMON_FONT_SIZES: readonly number[] = [
	8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72, 96,
];

/** One character-spacing preset (value in 1/100 pt, OOXML `spc` units). */
export interface CharacterSpacingOption {
	/** English fallback label (render sites may prefer `t(i18nKey)`). */
	label: string;
	/** Shared-i18n dictionary key for the label. */
	i18nKey: string;
	/** Spacing value applied to `textStyle.characterSpacing`. */
	value: number;
}

/** Character-spacing presets for the toolbar dropdown. */
export const CHARACTER_SPACING_OPTIONS: readonly CharacterSpacingOption[] = [
	{ label: 'Very Tight', i18nKey: 'pptx.text.characterSpacingVeryTight', value: -150 },
	{ label: 'Tight', i18nKey: 'pptx.text.characterSpacingTight', value: -75 },
	{ label: 'Normal', i18nKey: 'pptx.text.characterSpacingNormal', value: 0 },
	{ label: 'Loose', i18nKey: 'pptx.text.characterSpacingLoose', value: 75 },
	{ label: 'Very Loose', i18nKey: 'pptx.text.characterSpacingVeryLoose', value: 150 },
];

/** One line-spacing preset (multiplier applied to `textStyle.lineSpacing`). */
export interface LineSpacingOption {
	label: string;
	value: number;
}

/** Line-spacing presets for the paragraph dropdown. */
export const LINE_SPACING_OPTIONS: readonly LineSpacingOption[] = [
	{ label: '1.0', value: 1.0 },
	{ label: '1.15', value: 1.15 },
	{ label: '1.5', value: 1.5 },
	{ label: '2.0', value: 2.0 },
	{ label: '2.5', value: 2.5 },
	{ label: '3.0', value: 3.0 },
];

/** One change-case dropdown option. */
export interface ChangeCaseOption {
	value: ChangeCaseMode;
	/** Shared-i18n dictionary key for the label. */
	i18nKey: string;
}

/** Change-case options in menu order (matches PowerPoint's ordering). */
export const CHANGE_CASE_OPTIONS: readonly ChangeCaseOption[] = [
	{ value: 'sentence', i18nKey: 'pptx.text.changeCaseSentence' },
	{ value: 'lower', i18nKey: 'pptx.text.changeCaseLower' },
	{ value: 'upper', i18nKey: 'pptx.text.changeCaseUpper' },
	{ value: 'capitalize', i18nKey: 'pptx.text.changeCaseCapitalize' },
	{ value: 'toggle', i18nKey: 'pptx.text.changeCaseToggle' },
];
