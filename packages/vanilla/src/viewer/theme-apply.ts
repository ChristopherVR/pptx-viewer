import type { ViewerTheme } from 'pptx-viewer-shared';
import { themeToCssVars } from 'pptx-viewer-shared';

/**
 * Apply a `ViewerTheme` to the viewer root as inline `--pptx-*` custom
 * properties (over the stylesheet defaults), removing whatever the previous
 * theme set. Returns the list of property names now applied, to be passed
 * back on the next call.
 */
export function applyThemeVars(
	root: HTMLElement,
	theme: ViewerTheme | undefined,
	previouslyApplied: readonly string[],
): string[] {
	for (const key of previouslyApplied) {
		root.style.removeProperty(key);
	}
	const vars = themeToCssVars(theme);
	for (const [key, value] of Object.entries(vars)) {
		root.style.setProperty(key, value);
	}
	return Object.keys(vars);
}
