/**
 * Thin re-export shim -> `pptx-viewer-shared`.
 *
 * The IndexedDB presenter <-> audience deck handoff (plus the audience-tab hash
 * helpers) now live in `pptx-viewer-shared`
 * (`render/audience-content-store`). This shim preserves the historical import
 * surface for Vue's presentation-mode composables.
 */
export {
	AUDIENCE_HASH,
	clearAudienceContent,
	isAudienceTab,
	loadAudienceContent,
	parseAudienceNonce,
	storeAudienceContent,
} from 'pptx-viewer-shared';
