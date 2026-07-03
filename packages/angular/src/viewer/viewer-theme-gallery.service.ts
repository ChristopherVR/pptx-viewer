/**
 * viewer-theme-gallery.service.ts: Viewer-scoped state + logic for the theme
 * gallery overlay (Design ▸ Browse Themes): its open/closed signal, the loaded
 * deck's active theme name (for the gallery's check-mark), and applying a
 * built-in preset to the whole deck.
 *
 * Extracted from {@link PowerPointViewerComponent}. Unlike most of the other
 * extracted viewer-*.service.ts controllers this one needs no `bind()`: it
 * only depends on other already-provided services (`EditorStateService`,
 * `LoadContentService`), so it injects them directly.
 *
 * Provide it once on the viewer component (`providers: [ViewerThemeGalleryService]`).
 */

import { computed, inject, Injectable, signal } from '@angular/core';
import { applyThemeToData } from 'pptx-viewer-core';
import type { PptxData, PptxThemePreset } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';

@Injectable()
export class ViewerThemeGalleryService {
	private readonly editor = inject(EditorStateService);
	private readonly loader = inject(LoadContentService);

	/** Whether the theme-gallery overlay is visible (Design → Browse Themes). */
	readonly showThemeGallery = signal(false);
	/** The `name` property of the loaded deck's theme (for check-mark in gallery). */
	readonly activeThemeName = computed<string | undefined>(() => this.loader.theme()?.name);

	/**
	 * Apply a built-in theme preset to the whole deck.
	 *
	 * Mirrors Vue's `applyThemePreset()`: re-resolves slide colours via core's
	 * pure `applyThemeToData`, then writes the updated slides + theme metadata
	 * into `EditorStateService` as a single undoable entry. Also refreshes the
	 * `loader.themeColorMap` so subsequent theme switches start from the correct
	 * baseline.
	 */
	applyThemePreset(preset: PptxThemePreset): void {
		const currentSlides = this.editor.slides();
		const result = applyThemeToData(
			{
				slides: [...currentSlides],
				theme: this.loader.theme() ?? {},
				themeColorMap: this.loader.themeColorMap() ?? {},
			} as unknown as PptxData,
			preset.colorScheme,
			preset.fontScheme,
			preset.name,
		);
		// Write slides back through the editor (records undo history).
		this.editor.applyReplacement(result.slides, `Apply theme "${preset.name}"`);
		// Update the loader's theme signals so the check-mark and future switches are correct.
		this.loader.theme.set(result.theme);
		this.loader.themeColorMap.set(result.themeColorMap);
		this.showThemeGallery.set(false);
	}
}
