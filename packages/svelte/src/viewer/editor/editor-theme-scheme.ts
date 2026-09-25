/**
 * The binding's one presentation-theme scheme edit path, shared by the
 * inspector's theme editor (`ThemeSection.svelte`) and the Design > Variants
 * Colors / Fonts galleries.
 *
 * A colour-scheme edit takes the CHEAP route React settled on: write the
 * scheme into the archive, then re-resolve the live slides' colours in place
 * via core's `reResolveSlideColors` (an undoable `commitSlides`). Only the
 * theme editor's explicit "Apply to Presentation" runs the heavy
 * `switchTheme` round-trip. Design > Browse Themes applies a whole preset
 * (colours, fonts and name) through {@link applyThemePreset}.
 */
import type {
	PptxData,
	PptxHandler,
	PptxTheme,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
	PptxThemePreset,
} from 'pptx-viewer-core';
import {
	applyThemeToData,
	buildThemeColorMap,
	reResolveElementColors,
	reResolveSlideColors,
} from 'pptx-viewer-core';

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
	recolourTemplateLayer(editor, previousMap, colorScheme);
	return { ...current, colorScheme };
}

/** Recolour the master/layout layer (not part of `slide.elements`) against `colorScheme`. */
function recolourTemplateLayer(
	editor: EditorState,
	previousMap: Record<string, string>,
	colorScheme: PptxThemeColorScheme,
): void {
	if (Object.keys(editor.templateElementsBySlideId).length === 0) {
		return;
	}
	const recoloured: typeof editor.templateElementsBySlideId = {};
	for (const [slideId, elements] of Object.entries(editor.templateElementsBySlideId)) {
		recoloured[slideId] = reResolveElementColors(elements, previousMap, colorScheme);
	}
	editor.templateElementsBySlideId = recoloured;
}

/**
 * Design > Browse Themes: re-theme the PRESENTATION with a gallery preset.
 * Writes the preset into the archive (so it saves), re-resolves every live
 * slide's scheme colours in one undoable `commitSlides`, and returns the next
 * theme for the host to publish.
 */
export async function applyThemePreset(
	editor: EditorState,
	handler: PptxHandler,
	current: PptxTheme | undefined,
	preset: PptxThemePreset,
): Promise<PptxTheme> {
	const previousMap = current?.colorScheme ? buildThemeColorMap(current.colorScheme) : {};
	await handler.applyTheme(preset.colorScheme, preset.fontScheme, preset.name);
	const data = { slides: editor.slides, theme: current, themeColorMap: previousMap } as PptxData;
	const result = applyThemeToData(data, preset.colorScheme, preset.fontScheme, preset.name);
	editor.commitSlides(result.slides);
	recolourTemplateLayer(editor, previousMap, preset.colorScheme);
	return (
		result.theme ?? {
			...current,
			name: preset.name,
			colorScheme: preset.colorScheme,
			fontScheme: preset.fontScheme,
		}
	);
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
