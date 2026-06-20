/**
 * Thin re-export shim. The framework-agnostic PPTX document-theme font/colour
 * resolution helpers now live in `pptx-viewer-shared`.
 */
export {
	resolveThemeFont,
	tintColor,
	shadeColor,
	THEME_COLOR_TINT_ROWS,
	THEME_COLOR_LABELS,
	buildThemeColorGrid,
	themeColorSchemeToSwatches,
} from 'pptx-viewer-shared';
export type { ThemeColorTintRow } from 'pptx-viewer-shared';
