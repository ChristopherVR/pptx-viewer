/**
 * Thin re-export shim -> `pptx-viewer-shared` (via the vendored copy).
 *
 * The IndexedDB presenter <-> audience deck handoff (plus the audience-tab hash
 * helpers) now live in `pptx-viewer-shared`
 * (`render/audience-content-store`). This shim preserves the historical import
 * surface for Angular's presenter-window service.
 */
export {
	AUDIENCE_HASH,
	clearAudienceContent,
	isAudienceTab,
	loadAudienceContent,
	storeAudienceContent,
} from '../internal/shared';
