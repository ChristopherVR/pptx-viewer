/**
 * Thin re-export shim -> `pptx-viewer-shared`.
 *
 * The Share dialog form helpers (seeding, validity, and CollaborationConfig
 * assembly) now live in `pptx-viewer-shared` (`render/share-form`). This shim
 * preserves the historical import surface for `ShareDialog.svelte`.
 */
export type { JoinSessionFields, ShareDefaults, ShareFormFields } from 'pptx-viewer-shared';
export {
	buildJoinConfig,
	buildShareConfig,
	canJoinShare,
	canStartShare,
	isPeerToPeerShare,
	seedShareFields,
} from 'pptx-viewer-shared';
