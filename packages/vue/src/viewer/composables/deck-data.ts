/**
 * readDeckData: reconstruct the presentation-level `PptxData` from the live
 * viewer refs held by `useLoadContent`. Edits mutate the Vue refs (not the
 * handler's parsed model), so consumers that need the CURRENT deck (the
 * Export-as-JSON backstage card, mirroring `useAiBridge`'s deck seam) must
 * reassemble it from those refs rather than ask the handler.
 */
import type { PptxData } from 'pptx-viewer-core';

import type { UseLoadContentResult } from './useLoadContent';

/** The subset of `useLoadContent`'s refs a deck snapshot reads. */
export type DeckDataSource = Pick<
	UseLoadContentResult,
	| 'slides'
	| 'canvasSize'
	| 'theme'
	| 'sections'
	| 'presentationProperties'
	| 'customProperties'
	| 'coreProperties'
	| 'appProperties'
	// Slide Master view CRUD (`master-view-crud`, pptx-viewer-shared) reads
	// `data.slideMasters` to decide which sidebar buttons are enabled (a layout
	// still used by a slide, the last remaining master) and to validate the
	// action against, so a caller building a snapshot for that flow needs it
	// alongside `slides`.
	| 'slideMasters'
>;

/** Snapshot the live deck refs into a `PptxData` for serialization. */
export function readDeckData(deck: DeckDataSource): PptxData {
	return {
		slides: deck.slides.value,
		width: deck.canvasSize.value.width,
		height: deck.canvasSize.value.height,
		theme: deck.theme.value,
		sections: deck.sections.value,
		presentationProperties: deck.presentationProperties.value,
		customProperties: deck.customProperties.value,
		coreProperties: deck.coreProperties.value,
		appProperties: deck.appProperties.value,
		slideMasters: deck.slideMasters.value,
	} satisfies Partial<PptxData> as PptxData;
}
