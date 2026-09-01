import type { PptxElement, PptxSlide, SmartArtLayout, SmartArtPptxElement } from 'pptx-viewer-core';

import { buildSmartArtPresetData } from './smart-art-preset-data';
import { PRESETS } from './smart-art-presets';

/**
 * Composition helper for slide previews and sidebar thumbnails.
 *
 * Every binding paints a preview from the same two sources as a real save:
 * the inherited layout/master (template) elements first, then the slide-owned
 * elements on top. Keeping that merge + cap in one place stops each binding's
 * thumbnail path from drifting away from `buildSaveSlides` ordering.
 */

/**
 * Default cap on the number of elements a preview renders. This guards against
 * pathological decks (thousands of shapes on one slide) blowing up a tiny
 * off-screen thumbnail; ordinary slides sit far below it, so normal content is
 * never dropped.
 */
export const DEFAULT_PREVIEW_ELEMENT_CAP = 500;

export interface BuildPreviewElementsOptions {
	/**
	 * Maximum number of elements to include. Defaults to
	 * {@link DEFAULT_PREVIEW_ELEMENT_CAP}. A value <= 0 disables the cap.
	 */
	cap?: number;
}

/**
 * Ordered, capped element list for a slide preview/thumbnail. Inherited
 * template (layout/master) elements come first so slide-owned elements paint
 * on top, matching {@link import('./template-editing').buildSaveSlides}.
 */
export function buildPreviewElements(
	slide: PptxSlide,
	templateElements: readonly PptxElement[] = [],
	options?: BuildPreviewElementsOptions,
): PptxElement[] {
	const cap = options?.cap ?? DEFAULT_PREVIEW_ELEMENT_CAP;
	const merged = [...templateElements, ...slide.elements];
	if (cap > 0 && merged.length > cap) {
		return merged.slice(0, cap);
	}
	return merged;
}

// ── SmartArt gallery preview element ────────────────────────────────────────
//
// Every binding's SmartArt insert-gallery renders the REAL SmartArtRenderer
// output for the exact element the preset would insert (same layout, default
// items, colour scheme, and style), scaled down to tile size, so the preview
// always matches the diagram that lands on the slide. React, Vue, Angular and
// Vanilla each hand-rolled an identical `buildPreviewElement` closure (same id
// scheme, same box, same `PRESETS.find` + fallback-items lookup); this is the
// one copy.

/** Element size the insert handler creates; previews render the same box. */
export const SMARTART_PREVIEW_ELEMENT_WIDTH = 600;
/** Element size the insert handler creates; previews render the same box. */
export const SMARTART_PREVIEW_ELEMENT_HEIGHT = 340;

/** Fallback node texts used when a layout's preset carries none. */
export const SMARTART_PREVIEW_FALLBACK_ITEMS: readonly string[] = ['1', '2', '3'];

/**
 * Build the full-size (pre-scale) SmartArt element a gallery tile previews:
 * the exact box + preset node data the "Insert" action would create for
 * `layout`. Callers scale the returned element down to gallery-tile size
 * themselves (a `transform: scale(...)` wrapper), matching every binding's
 * existing gallery layout.
 *
 * `defaultItems` lets a caller (Svelte's gallery passes its own preset lookup
 * result as a prop) supply the node texts directly; when omitted, the preset
 * catalogue is consulted the same way React/Vue/Angular/Vanilla already do,
 * falling back to {@link SMARTART_PREVIEW_FALLBACK_ITEMS}.
 */
export function buildSmartArtPreviewElement(
	layout: SmartArtLayout,
	defaultItems?: readonly string[],
): SmartArtPptxElement {
	const preset = PRESETS.find((p) => p.layout === layout);
	const items = [...(defaultItems ?? preset?.defaultItems ?? SMARTART_PREVIEW_FALLBACK_ITEMS)];
	return {
		id: `smartart-preview-${layout}`,
		type: 'smartArt',
		x: 0,
		y: 0,
		width: SMARTART_PREVIEW_ELEMENT_WIDTH,
		height: SMARTART_PREVIEW_ELEMENT_HEIGHT,
		smartArtData: buildSmartArtPresetData(layout, items),
	} as SmartArtPptxElement;
}
