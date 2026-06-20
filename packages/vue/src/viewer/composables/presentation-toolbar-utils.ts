/**
 * Thin re-export shim → `pptx-viewer-shared` (`render/presentation-toolbar`).
 *
 * The pure presentation-toolbar helpers (trigger-zone math, auto-hide timing,
 * colour swatches, slide-counter formatting) now live in shared, consumed by
 * every binding. This file preserves the historical Vue import surface so
 * `PresentationToolbar.vue` and the colocated tests are unchanged.
 */

export {
	AUTO_HIDE_DELAY_MS,
	BOTTOM_TRIGGER_FRACTION,
	PEN_COLORS,
	HIGHLIGHTER_COLORS,
	isInBottomTriggerZone,
	shouldAutoHide,
	formatSlideCounter,
} from 'pptx-viewer-shared';
