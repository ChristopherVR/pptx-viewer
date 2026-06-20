import { InjectionToken } from '@angular/core';
import type { Provider } from '@angular/core';

import { themeToCssVars } from '../internal/shared';
import type { ViewerTheme } from '../internal/shared';

/**
 * Theme system for the Angular PowerPoint viewer.
 *
 * Angular counterpart of the React `ViewerThemeProvider` / `useViewerTheme`
 * context and the Vue `provide`/`inject` theme provider. The `ViewerTheme`
 * type, default palette, and `themeToCssVars` helper are framework-agnostic
 * and live in `pptx-viewer-shared`.
 */

/** DI token carrying the active `ViewerTheme` (or `undefined`). */
export const VIEWER_THEME = new InjectionToken<ViewerTheme | undefined>('PPTX_VIEWER_THEME');

/**
 * Provide a `ViewerTheme` to a subtree.
 *
 * Typically you do **not** need this: passing a `theme` input to
 * `<pptx-viewer>` is sufficient. Use this to share a theme across multiple
 * viewers or a wider component subtree.
 *
 * @example
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [provideViewerTheme({ colors: { primary: '#6366f1' } })],
 * });
 * ```
 */
export function provideViewerTheme(theme: ViewerTheme | undefined): Provider {
	return { provide: VIEWER_THEME, useValue: theme };
}

/**
 * Build an `[ngStyle]`-compatible map of CSS custom properties for a theme.
 * Returns an empty object when the theme contributes no variables.
 */
export function themeStyle(theme: ViewerTheme | undefined): Record<string, string> {
	if (!theme) {
		return {};
	}
	return themeToCssVars(theme);
}
