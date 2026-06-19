/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * The slide-diff engine was consolidated into `pptx-viewer-shared`
 * (`render/slide-compare.ts`), shared by every binding. This shim preserves the
 * historical Vue import surface (`compareSlides` / `compareSlide` /
 * `diffSlideElements` + the diff types) so `ComparePanel.vue`,
 * `SlideDiffRow.vue`, `PowerPointViewer.vue`, and colocated tests keep importing
 * the same names unchanged.
 */
export type {
	SlideDiffStatus,
	ElementChangeKind,
	ElementChange,
	SlideDiff,
	CompareResult,
} from 'pptx-viewer-shared';
export { diffSlideElements, compareSlide, compareSlides } from 'pptx-viewer-shared';
