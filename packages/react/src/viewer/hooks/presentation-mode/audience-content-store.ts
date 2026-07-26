/**
 * Thin re-export shim -> `pptx-viewer-shared`.
 *
 * The IndexedDB presenter <-> audience deck handoff now lives in
 * `pptx-viewer-shared` (`render/audience-content-store`), and the audience-tab
 * lock in `render/audience-display`. This shim preserves the historical import
 * surface for React's presentation-mode hooks.
 */
export {
	clearAudienceContent,
	endAudienceDisplay,
	loadAudienceContent,
	mayLeaveSlideShow,
	storeAudienceContent,
} from 'pptx-viewer-shared';
