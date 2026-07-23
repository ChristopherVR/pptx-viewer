import type {
	ParsedTableStyleMap,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
} from 'pptx-viewer-core';
import type { InjectionKey, MaybeRefOrGetter } from 'vue';
import { inject, toValue } from 'vue';

/**
 * PPTX-content theme context made available to table cells for resolving
 * banded-row / header / total emphasis colours against the real presentation
 * colour scheme (and, when available, the parsed `ppt/tableStyles.xml` map).
 *
 * This is provided once at the viewer root via {@link TableThemeKey} and
 * injected by `TableRenderer`, so the hot `SlideStage` → `ElementRenderer`
 * prop chain does not have to thread the theme through every element.
 */
export interface TableThemeContext {
	colorScheme?: PptxThemeColorScheme;
	tableStyleMap?: ParsedTableStyleMap;
	/**
	 * Theme font scheme, so a table style's `a:fontRef@idx` (`minor`/`major`)
	 * can resolve to a concrete font family in banded/header cell text.
	 */
	fontScheme?: PptxThemeFontScheme;
}

/** Typed injection key for the table theme context (reactive getter or ref). */
export const TableThemeKey: InjectionKey<MaybeRefOrGetter<TableThemeContext | undefined>> =
	Symbol('pptx-vue-table-theme');

/**
 * Resolve the injected {@link TableThemeContext}, if any. Must be called from a
 * component `setup`. Returns the raw injected getter/ref so the caller can read
 * it reactively inside a `computed` via {@link resolveTableTheme}.
 */
export function injectTableTheme(): MaybeRefOrGetter<TableThemeContext | undefined> | undefined {
	return inject(TableThemeKey, undefined);
}

/** Unwrap an injected table-theme source to its current value (reactive-safe inside `computed`). */
export function resolveTableTheme(
	source: MaybeRefOrGetter<TableThemeContext | undefined> | undefined,
): TableThemeContext | undefined {
	return source ? toValue(source) : undefined;
}
