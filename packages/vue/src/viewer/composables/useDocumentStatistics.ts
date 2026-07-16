import type { PptxCoreProperties, PptxSlide } from 'pptx-viewer-core';
import { computeDocumentStatistics, countWords } from 'pptx-viewer-shared';
import type { DocumentStatistics } from 'pptx-viewer-shared';
import { computed, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';

export { computeDocumentStatistics, countWords };
export type { DocumentStatistics };

/** Reactive Vue adapter around the shared live document-statistics computation. */
export function useDocumentStatistics(
	slides: MaybeRefOrGetter<PptxSlide[]>,
	coreProperties: MaybeRefOrGetter<PptxCoreProperties | undefined>,
): ComputedRef<DocumentStatistics> {
	return computed(() => computeDocumentStatistics(toValue(slides), toValue(coreProperties)));
}
