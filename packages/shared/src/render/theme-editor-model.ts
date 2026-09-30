import type {
	PptxTheme,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
	PptxThemeFontGroup,
} from 'pptx-viewer-core';
import { THEME_COLOR_SCHEME_KEYS } from 'pptx-viewer-core';

import { THEME_COLOR_SLOT_LABEL_KEYS } from './schema-label-keys';
import { THEME_COLOR_TINT_ROWS } from './text-theme';
import { DEFAULT_THEME_COLOR_SCHEME } from './theme-editor-presets';

export interface ThemeEditorEdit {
	name: string;
	colorScheme: PptxThemeColorScheme;
	fontScheme: PptxThemeFontScheme;
}
/** Compatibility constructor; draft creation and view state remain in shared. */
export function createCustomThemeEdit(
	colorScheme: PptxThemeColorScheme,
	major: string,
	minor: string,
	name: string,
): ThemeEditorEdit {
	return {
		colorScheme,
		name,
		fontScheme: { majorFont: { latin: major }, minorFont: { latin: minor } },
	};
}

export type ThemeEditorLabels = Record<string, string>;
export const THEME_EDITOR_LABEL_KEYS = [
	'title',
	'close',
	'themeName',
	'themeNamePlaceholder',
	'presetThemes',
	'colorScheme',
	'preview',
	'headingFont',
	'bodyFont',
	'headingSample',
	'bodySample',
	'applyToPresentation',
	'reset',
	'colorDark1',
	'colorLight1',
	'colorDark2',
	'colorLight2',
	'colorAccent1',
	'colorAccent2',
	'colorAccent3',
	'colorAccent4',
	'colorAccent5',
	'colorAccent6',
	'colorHyperlink',
	'colorFollowedLink',
] as const;

export const THEME_EDITOR_COLOR_LABELS = Object.fromEntries(
	THEME_COLOR_SCHEME_KEYS.map((slot, i) => [slot, THEME_EDITOR_LABEL_KEYS[13 + i]]),
) as Record<keyof PptxThemeColorScheme, string>;

export function themeEditorLabels(t: (key: string) => string): ThemeEditorLabels {
	return Object.fromEntries([
		...THEME_EDITOR_LABEL_KEYS.map((key) => [key, t(`pptx.themeEditor.${key}`)]),
		...Object.values(THEME_COLOR_SLOT_LABEL_KEYS).map((key) => [key, t(key)]),
		...THEME_COLOR_TINT_ROWS.map(({ labelKey }) => [labelKey, t(labelKey)]),
	]);
}

/** A detached draft preserves all non-Latin font metadata until the host commits. */
export function createThemeEditorEdit(theme?: PptxTheme): ThemeEditorEdit {
	const copyFont = (
		font: PptxThemeFontGroup | undefined,
		fallback: string,
	): PptxThemeFontGroup => ({
		...font,
		latin: font?.latin ?? fallback,
		...(font?.byScript ? { byScript: { ...font.byScript } } : {}),
	});
	return {
		name: theme?.name ?? 'Custom Theme',
		colorScheme: { ...DEFAULT_THEME_COLOR_SCHEME, ...theme?.colorScheme },
		fontScheme: {
			majorFont: copyFont(theme?.fontScheme?.majorFont, 'Calibri Light'),
			minorFont: copyFont(theme?.fontScheme?.minorFont, 'Calibri'),
		},
	};
}

export function themeEditorHex(value: string | undefined): string {
	const hex = value?.startsWith('#') ? value : `#${value ?? ''}`;
	return /^#[\da-f]{6}$/iu.test(hex) ? hex : '#000000';
}
