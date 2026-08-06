import type {
	ParsedTableStyleMap,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
} from 'pptx-viewer-core';
import type { CanvasSize, TableStyleContext } from 'pptx-viewer-shared';
import { getContext, setContext } from 'svelte';

const RENDER_CONTEXT = Symbol('pptx-svelte-render-context');

export interface RenderContextSource {
	getColorScheme: () => PptxThemeColorScheme | undefined;
	getTableStyleMap: () => ParsedTableStyleMap | undefined;
	/** Theme font scheme, so band/header cell text can resolve major/minor fonts. */
	getFontScheme?: () => PptxThemeFontScheme | undefined;
	/** Deck canvas size, so template insertion can target the real slide surface. */
	getCanvasSize?: () => CanvasSize | undefined;
}

export function provideRenderContext(source: RenderContextSource): void {
	setContext(RENDER_CONTEXT, source);
}

/**
 * The raw render-context source, for chrome that needs the deck's colour
 * scheme or canvas size outside a table (e.g. the Slide Templates gallery).
 * Must be called during component init; invoke the getters lazily so reads
 * stay live against the loader's runes state.
 */
export function getRenderContextSource(): RenderContextSource | undefined {
	return getContext<RenderContextSource | undefined>(RENDER_CONTEXT);
}

export function useTableStyleContext(): TableStyleContext | undefined {
	const source = getContext<RenderContextSource | undefined>(RENDER_CONTEXT);
	if (!source) {
		return undefined;
	}
	const colorScheme = source.getColorScheme();
	const tableStyleMap = source.getTableStyleMap();
	const fontScheme = source.getFontScheme?.();
	return colorScheme || tableStyleMap || fontScheme
		? { colorScheme, tableStyleMap, fontScheme }
		: undefined;
}
