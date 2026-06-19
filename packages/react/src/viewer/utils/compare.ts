/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * The slide-diff engine was consolidated into `pptx-viewer-shared`
 * (`render/slide-compare.ts`), shared by every binding. This shim preserves the
 * historical React import surface (`comparePresentation` + the diff types) so
 * `ComparePanel.tsx`, `SlideDiffRow.tsx`, the property handlers, and colocated
 * tests keep importing the same names unchanged.
 */
export type {
	SlideDiffStatus,
	ElementChange,
	ElementChangeKind,
	SlideDiff,
	CompareResult,
} from 'pptx-viewer-shared';
export { comparePresentation } from 'pptx-viewer-shared';
