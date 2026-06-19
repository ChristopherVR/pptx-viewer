/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * URL safety, slide-jump resolution, and `ppaction://` parsing were
 * consolidated into `pptx-viewer-shared` (`render/hyperlink-security.ts`),
 * shared by every binding. This shim preserves the historical React import
 * surface so consumers and colocated tests keep importing the same names.
 */
export type { ParsedPpaction } from 'pptx-viewer-shared';
export {
	isUrlSafe,
	safeOpenUrl,
	clampSlideIndex,
	resolveSlideJump,
	isPpactionUrl,
	parsePpactionUrl,
} from 'pptx-viewer-shared';
