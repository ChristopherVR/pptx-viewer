/**
 * Injection point for {@link UseRecentColorsResult} (`useRecentColors.ts`),
 * provided once at the viewer root so every colour-picking panel deep in the
 * inspector tree (Fill, Stroke, Text, Slide Background, table-cell fill,
 * chart series, ...) can reach the SAME "recent colours" list without prop-
 * threading it down, mirroring the `TableThemeKey` pattern in `table-theme.ts`.
 */
import type { InjectionKey } from 'vue';
import { inject } from 'vue';

import type { UseRecentColorsResult } from './useRecentColors';

export const RecentColorsKey: InjectionKey<UseRecentColorsResult> =
	Symbol('pptx-vue-recent-colors');

/**
 * Resolve the injected recent-colours controller, if any. `undefined` when
 * this component tree was mounted without a `PowerPointViewer` ancestor (an
 * isolated test fixture, a Storybook-style harness): callers treat that as
 * "no recent colours row" rather than throwing.
 */
export function injectRecentColors(): UseRecentColorsResult | undefined {
	return inject(RecentColorsKey, undefined);
}
