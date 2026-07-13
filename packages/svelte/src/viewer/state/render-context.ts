import type { ParsedTableStyleMap, PptxThemeColorScheme } from 'pptx-viewer-core';
import type { TableStyleContext } from 'pptx-viewer-shared';
import { getContext, setContext } from 'svelte';

const RENDER_CONTEXT = Symbol('pptx-svelte-render-context');

export interface RenderContextSource {
	getColorScheme: () => PptxThemeColorScheme | undefined;
	getTableStyleMap: () => ParsedTableStyleMap | undefined;
}

export function provideRenderContext(source: RenderContextSource): void {
	setContext(RENDER_CONTEXT, source);
}

export function useTableStyleContext(): TableStyleContext | undefined {
	const source = getContext<RenderContextSource | undefined>(RENDER_CONTEXT);
	if (!source) {
		return undefined;
	}
	const colorScheme = source.getColorScheme();
	const tableStyleMap = source.getTableStyleMap();
	return colorScheme || tableStyleMap ? { colorScheme, tableStyleMap } : undefined;
}
