import { computed, inject, provide, toValue } from 'vue';
import type { ComputedRef, CSSProperties, InjectionKey, MaybeRefOrGetter } from 'vue';

import { themeToCssVars } from './css-vars';
import type { ViewerTheme } from './types';

/**
 * Vue equivalent of the React `ViewerThemeContext`.
 *
 * The React package used `createContext`/`useContext`; in Vue we use the
 * `provide`/`inject` API with a typed injection key.
 */
const ViewerThemeKey: InjectionKey<MaybeRefOrGetter<ViewerTheme | undefined>> =
	Symbol('pptx-viewer-theme');

/**
 * Provide a `ViewerTheme` to all descendant viewer components.
 *
 * Typically you do **not** need to call this directly; passing a `theme`
 * prop to `<PowerPointViewer>` is sufficient. This is exposed for advanced
 * use-cases where you want to share a theme across a wider subtree.
 *
 * Mirrors `<ViewerThemeProvider>` from the React package.
 */
export function provideViewerTheme(theme: MaybeRefOrGetter<ViewerTheme | undefined>): void {
	provide(ViewerThemeKey, theme);
}

/**
 * Returns the active `ViewerTheme` (if any) from the nearest
 * `provideViewerTheme` ancestor.
 *
 * Mirrors `useViewerTheme()` from the React package.
 */
export function useViewerTheme(): ComputedRef<ViewerTheme | undefined> {
	const injected = inject(ViewerThemeKey, undefined);
	return computed(() => (injected ? toValue(injected) : undefined));
}

/**
 * Returns a computed `style` object of CSS custom properties derived from
 * the given theme. Bind this onto the viewer root element's `:style`.
 *
 * Mirrors `useThemeStyle()` from the React package (memoised via `computed`).
 */
export function useThemeStyle(
	theme: MaybeRefOrGetter<ViewerTheme | undefined>,
): ComputedRef<CSSProperties | undefined> {
	return computed(() => {
		const resolved = toValue(theme);
		if (!resolved) {
			return undefined;
		}
		const vars = themeToCssVars(resolved);
		if (Object.keys(vars).length === 0) {
			return undefined;
		}
		return vars as CSSProperties;
	});
}
