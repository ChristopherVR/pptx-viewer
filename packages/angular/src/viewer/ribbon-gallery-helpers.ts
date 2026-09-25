/**
 * ribbon-gallery-helpers.ts: the Angular glue between `pptx-viewer-shared`'s
 * ribbon galleries and this binding's state services.
 *
 * Shared decides what a gallery offers and what a pick writes
 * (`buildRibbonGallery` / `applyRibbonGalleryItem`); these functions only
 * (1) assemble the {@link RibbonGalleryContext} from the loaded deck and
 * (2) route an apply result onto the binding's existing update paths: the
 * editor's undoable `updateElement` for element patches, and the theme
 * gallery service (the Design > Themes path) for colour / font schemes.
 * Kept free of `@Component` so they are testable without TestBed.
 */
import type { PptxElement, PptxHandler, PptxTheme } from 'pptx-viewer-core';

import type { RibbonGalleryApplyResult, RibbonGalleryContext } from '../internal/shared';
import type { EditorStateService } from './editor-state.service';
import type { ViewerThemeGalleryService } from './viewer-theme-gallery.service';

/** The slice of `LoadContentService` a gallery context reads. */
export interface GalleryDeckSource {
	theme: () => PptxTheme | undefined;
	themeColorMap: () => Record<string, string> | undefined;
	getHandler: () => PptxHandler | undefined;
}

/** The context every gallery descriptor is built from. */
export function galleryContextFor(
	element: PptxElement | null,
	deck: GalleryDeckSource | null,
): RibbonGalleryContext {
	const handler = deck?.getHandler();
	return {
		element,
		themeColorMap: deck?.themeColorMap(),
		theme: deck?.theme(),
		resolveStyleMatrix: handler ? (xml) => handler.resolveStyleMatrixReferences(xml) : undefined,
	};
}

/** What {@link dispatchGalleryResult} writes through. */
export interface GalleryDispatchTargets {
	editor: Pick<EditorStateService, 'updateElement'>;
	slideIndex: number;
	themes: Pick<ViewerThemeGalleryService, 'applyThemeVariant'> | null;
}

/**
 * Apply a gallery pick. Returns false when nothing could take it (a `null`
 * result, or a theme pick outside a viewer that owns a theme path).
 */
export function dispatchGalleryResult(
	result: RibbonGalleryApplyResult | null,
	targets: GalleryDispatchTargets,
): boolean {
	if (!result) {
		return false;
	}
	if (result.kind === 'element') {
		targets.editor.updateElement(targets.slideIndex, result.elementId, result.patch);
		return true;
	}
	if (!targets.themes) {
		return false;
	}
	if (result.kind === 'themeColorScheme') {
		targets.themes.applyThemeVariant({ colorScheme: result.colorScheme }, result.name);
	} else {
		targets.themes.applyThemeVariant({ fontScheme: result.fontScheme }, result.name);
	}
	return true;
}
