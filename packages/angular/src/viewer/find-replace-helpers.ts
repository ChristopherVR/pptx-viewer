/**
 * Thin re-export shim -> vendored `pptx-viewer-shared`.
 *
 * The pure find & replace transforms were extracted to `pptx-viewer-shared`
 * (`render/find-replace.ts`) and are consumed by every binding. This shim
 * preserves the historical Angular import surface so the find/replace bar, the
 * viewer barrel, and the colocated tests are unchanged.
 */
export type { FindResult, FindOptions, ReplaceResult } from '../internal/shared';
export {
	findInSlides,
	applyFindReplacements,
	replaceMatch,
	replaceInSlides,
} from '../internal/shared';
