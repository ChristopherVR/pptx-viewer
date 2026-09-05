/**
 * Injection point for the loaded deck's resolved theme colour map
 * (`themeColorMap` from `useLoadContent.ts`, matching `PptxData.themeColorMap`'s
 * shape: `dk1`/`lt1`/`dk2`/`lt2`/`accent1..6`/`hlink`/`folHlink` plus the
 * `bg1`/`tx1`/`bg2`/`tx2` aliases), provided once at the viewer root so every
 * colour-picking panel (Fill, Stroke, ribbon font colour, table-cell fill, ...)
 * can render PowerPoint's real "Theme Colors" grid
 * (`pptx-viewer-shared`'s `buildThemeColorSwatchGrid`) without prop-threading
 * it down, mirroring the `RecentColorsKey` pattern in `recent-colors-context.ts`.
 */
import type { InjectionKey, Ref } from 'vue';
import { inject } from 'vue';

export const ThemeColorMapKey: InjectionKey<Ref<Record<string, string> | undefined>> = Symbol(
	'pptx-vue-theme-color-map',
);

/**
 * Resolve the injected theme colour map, if any. `undefined` when this
 * component tree was mounted without a `PowerPointViewer` ancestor, or when
 * no deck (or no theme) is loaded yet: callers treat that as "no theme
 * swatches to show" rather than throwing.
 */
export function injectThemeColorMap(): Ref<Record<string, string> | undefined> | undefined {
	return inject(ThemeColorMapKey, undefined);
}
