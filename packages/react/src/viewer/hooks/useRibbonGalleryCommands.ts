/**
 * useRibbonGalleryCommands: builds the {@link RibbonGalleryCommands} value
 * the viewer provides to every ribbon gallery.
 *
 * All decisions (what a gallery offers, what a pick writes) are shared; this
 * hook only gathers the context from viewer state and maps the three apply
 * result kinds onto the paths the inspector already uses: element patches go
 * through `updateElementById` (which records history via `markDirty`), theme
 * scheme picks through the theme editor's handlers.
 */
import type {
	PptxElement,
	PptxHandler,
	PptxTheme,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
} from 'pptx-viewer-core';
import type { RibbonGalleryApplyResult, RibbonGalleryContext } from 'pptx-viewer-shared';
import { useCallback, useMemo } from 'react';
import type { RefObject } from 'react';

import type { RibbonGalleryCommands } from '../components/ribbon-gallery-context';

export interface UseRibbonGalleryCommandsInput {
	selectedElement: PptxElement | null | undefined;
	theme: PptxTheme | undefined;
	themeColorMap: Readonly<Record<string, string>> | undefined;
	handlerRef: RefObject<PptxHandler | null>;
	editable: boolean;
	updateElementById: (elementId: string, updates: Partial<PptxElement>) => void;
	updateThemeColorScheme: (colorScheme: PptxThemeColorScheme) => Promise<void>;
	updateThemeFontScheme: (fontScheme: PptxThemeFontScheme) => Promise<void>;
}

export function useRibbonGalleryCommands(
	input: UseRibbonGalleryCommandsInput,
): RibbonGalleryCommands {
	const {
		selectedElement,
		theme,
		themeColorMap,
		handlerRef,
		editable,
		updateElementById,
		updateThemeColorScheme,
		updateThemeFontScheme,
	} = input;
	// Read at render time: the handler is created by the load pipeline, which
	// also replaces `theme`, so a new handler always comes with a re-render.
	const handler = handlerRef.current;
	const context = useMemo<RibbonGalleryContext>(
		() => ({
			element: selectedElement ?? null,
			themeColorMap,
			theme,
			resolveStyleMatrix: handler
				? (styleXml) => handler.resolveStyleMatrixReferences(styleXml)
				: undefined,
		}),
		[selectedElement, themeColorMap, theme, handler],
	);
	const dispatch = useCallback(
		(result: RibbonGalleryApplyResult) => {
			if (!editable) {
				return;
			}
			switch (result.kind) {
				case 'element':
					updateElementById(result.elementId, result.patch);
					return;
				case 'themeColorScheme':
					void updateThemeColorScheme(result.colorScheme);
					return;
				case 'themeFontScheme':
					void updateThemeFontScheme(result.fontScheme);
			}
		},
		[editable, updateElementById, updateThemeColorScheme, updateThemeFontScheme],
	);
	return useMemo(() => ({ context, editable, dispatch }), [context, editable, dispatch]);
}
