/**
 * The binding's one presentation-theme scheme edit path, shared by the
 * inspector's theme editor (`ThemeSection.svelte`) and the Design > Variants
 * Colors / Fonts galleries.
 *
 * A colour-scheme edit takes the CHEAP route React settled on: write the
 * scheme into the archive, then re-resolve the live slides' colours in place
 * via core's `reResolveSlideColors` (an undoable `commitSlides`). Only the
 * theme editor's explicit "Apply to Presentation" runs the heavy
 * `switchTheme` round-trip.
 */
import type {
	PptxHandler,
	PptxTheme,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
} from 'pptx-viewer-core';
import { buildThemeColorMap, reResolveElementColors, reResolveSlideColors } from 'pptx-viewer-core';

import type { EditorState } from './editor-state.svelte';

/** Write `colorScheme` into the deck and recolour every live element; returns the next theme. */
export async function applyThemeColorScheme(
	editor: EditorState,
	handler: PptxHandler,
	current: PptxTheme,
	colorScheme: PptxThemeColorScheme,
): Promise<PptxTheme> {
	const previousMap = current.colorScheme ? buildThemeColorMap(current.colorScheme) : {};
	await handler.updateThemeColorScheme(colorScheme);
	editor.commitSlides(reResolveSlideColors(editor.slides, previousMap, colorScheme));
	// Master/layout elements render as a separate per-slide layer (not part
	// of `slide.elements`), so `commitSlides` above never touches them; left
	// alone they'd keep painting the old scheme's colours until a full reload.
	if (Object.keys(editor.templateElementsBySlideId).length > 0) {
		const recoloured: typeof editor.templateElementsBySlideId = {};
		for (const [slideId, elements] of Object.entries(editor.templateElementsBySlideId)) {
			recoloured[slideId] = reResolveElementColors(elements, previousMap, colorScheme);
		}
		editor.templateElementsBySlideId = recoloured;
	}
	return { ...current, colorScheme };
}

/** Write `fontScheme` into the deck; returns the next theme. */
export async function applyThemeFontScheme(
	handler: PptxHandler,
	current: PptxTheme,
	fontScheme: PptxThemeFontScheme,
): Promise<PptxTheme> {
	await handler.updateThemeFontScheme(fontScheme);
	return { ...current, fontScheme };
}
