/**
 * Thin re-export shim -> vendored `pptx-viewer-shared`.
 *
 * The pure comment-array transforms were extracted to `pptx-viewer-shared`
 * (`render/comments-list.ts`) and are consumed by every binding. This shim
 * preserves the historical Angular import surface so the comments service/panel
 * and the colocated tests are unchanged.
 */
export {
	generateCommentId,
	addCommentToList,
	removeCommentFromList,
	toggleCommentResolvedInList,
} from '../internal/shared';
