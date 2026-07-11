/**
 * text-format-presets.ts: Home-tab text formatting preset catalogues + the
 * change-case transform, shared by every binding's toolbar.
 *
 * Pure data/logic: the font family and font size dropdown lists, the
 * character-spacing and line-spacing preset lists, the change-case option
 * list, and two change-case helpers ({@link changeCaseStyleUpdate} for the
 * `textCaps` style patch, {@link transformTextCase} for transforming run text
 * directly). Each binding renders its own dropdowns from these.
 *
 * @module render/text-format-presets
 */
import type { TextStyle } from 'pptx-viewer-core';

/** Font families offered by the Home-tab font dropdown. */
export const COMMON_FONT_FAMILIES: readonly string[] = [
	'Arial',
	'Calibri',
	'Cambria',
	'Comic Sans MS',
	'Courier New',
	'Georgia',
	'Helvetica',
	'Impact',
	'Segoe UI',
	'Tahoma',
	'Times New Roman',
	'Trebuchet MS',
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

/** The five change-case transforms offered by the "Aa" toolbar dropdown. */
export type ChangeCaseMode = 'sentence' | 'lower' | 'upper' | 'capitalize' | 'toggle';

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

/**
 * The `TextStyle` patch a change-case pick applies: `upper` maps to OOXML
 * all-caps rendering (`textCaps: 'all'`), every other mode clears the caps
 * override. Bindings that additionally rewrite run text pair this with
 * {@link transformTextCase}.
 */
export function changeCaseStyleUpdate(mode: ChangeCaseMode): Partial<TextStyle> {
	if (mode === 'upper') {
		return { textCaps: 'all' };
	}
	return { textCaps: 'none' };
}

/** Toggle the case of a single character (non-letters pass through). */
function toggleChar(char: string): string {
	const upper = char.toUpperCase();
	return char === upper ? char.toLowerCase() : upper;
}

/**
 * Apply a change-case transform to a plain text string (for bindings that
 * rewrite run text directly rather than only toggling `textCaps`):
 *
 * - `upper` / `lower`: whole-string case change.
 * - `capitalize`: first letter of each word uppercased, rest lowercased.
 * - `sentence`: first letter of each sentence uppercased, rest lowercased.
 * - `toggle`: per-character case swap.
 */
export function transformTextCase(text: string, mode: ChangeCaseMode): string {
	switch (mode) {
		case 'upper':
			return text.toUpperCase();
		case 'lower':
			return text.toLowerCase();
		case 'capitalize':
			return text
				.toLowerCase()
				.replace(/\p{L}+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1));
		case 'sentence': {
			let capitalizeNext = true;
			let result = '';
			for (const char of text.toLowerCase()) {
				if (capitalizeNext && /\p{L}/u.test(char)) {
					result += char.toUpperCase();
					capitalizeNext = false;
				} else {
					result += char;
					if (char === '.' || char === '!' || char === '?') {
						capitalizeNext = true;
					}
				}
			}
			return result;
		}
		case 'toggle':
			return Array.from(text, toggleChar).join('');
		default: {
			const _exhaustive: never = mode;
			return _exhaustive;
		}
	}
}
