import type { PptxCoreProperties, PptxElement, PptxSlide, TextSegment } from 'pptx-viewer-core';
import { computed, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';

/**
 * Computed, read-only statistics for the Document Properties → Statistics tab.
 *
 * The React Statistics tab renders whatever the parser pulled out of
 * `docProps/app.xml` (`PptxAppProperties`). That part is frequently missing or
 * stale (PowerPoint only refreshes it on save), so the Vue port *computes* the
 * counts directly from the live `PptxSlide[]` model instead, and pairs them
 * with the timestamps/revision carried on `PptxCoreProperties`.
 *
 * @see `DocumentPropertiesStatisticsTab` (React) — the visual reference.
 */
export interface DocumentStatistics {
	/** Total number of slides. */
	slideCount: number;
	/** Number of slides flagged `hidden`. */
	hiddenSlideCount: number;
	/** Number of slides carrying notes text. */
	noteCount: number;
	/** Total element count across all slides (groups counted, plus descendants). */
	elementCount: number;
	/** Total word count across every text-bearing element (incl. tables). */
	wordCount: number;
	/** Total paragraph count across every text-bearing element. */
	paragraphCount: number;
	/** `dcterms:created` (ISO 8601) or `undefined`. */
	created: string | undefined;
	/** `dcterms:modified` (ISO 8601) or `undefined`. */
	modified: string | undefined;
	/** `cp:revision` or `undefined`. */
	revision: string | undefined;
	/** `cp:lastModifiedBy` or `undefined`. */
	lastModifiedBy: string | undefined;
}

/**
 * Count the words in a free-text blob. Words are maximal runs of
 * non-whitespace characters; empty/whitespace-only strings contribute zero.
 */
export function countWords(text: string | undefined): number {
	if (!text) {
		return 0;
	}
	const trimmed = text.trim();
	if (trimmed === '') {
		return 0;
	}
	return trimmed.split(/\s+/u).length;
}

/**
 * Count paragraphs in a free-text blob. A paragraph is a newline-delimited
 * line that contains at least one non-whitespace character.
 */
function countParagraphs(text: string | undefined): number {
	if (!text) {
		return 0;
	}
	const lines = text.split(/\r\n|\r|\n/u).filter((line) => line.trim() !== '');
	return lines.length;
}

/** Concatenate a rich-text segment array into a single plain string. */
function segmentsToText(segments: TextSegment[] | undefined): string {
	if (!segments || segments.length === 0) {
		return '';
	}
	return segments.map((seg) => seg.text ?? '').join('');
}

/**
 * Resolve the plain text carried by a single element. Prefers the structured
 * `textSegments` (richer) and falls back to the flat `text` field. Table cell
 * text is gathered separately in {@link accumulateElement}.
 */
function elementPlainText(element: PptxElement): string {
	const withText = element as PptxElement & {
		text?: string;
		textSegments?: TextSegment[];
	};
	const segmentText = segmentsToText(withText.textSegments);
	if (segmentText !== '') {
		return segmentText;
	}
	return withText.text ?? '';
}

interface Accumulator {
	elementCount: number;
	wordCount: number;
	paragraphCount: number;
}

/**
 * Fold a single element (and any descendants / table cells) into the running
 * totals. Group children and table cells are walked recursively so their text
 * and element counts are included.
 */
function accumulateElement(element: PptxElement, acc: Accumulator): void {
	acc.elementCount += 1;

	const text = elementPlainText(element);
	if (text !== '') {
		acc.wordCount += countWords(text);
		acc.paragraphCount += countParagraphs(text);
	}

	if (element.type === 'table' && element.tableData) {
		for (const row of element.tableData.rows) {
			for (const cell of row.cells) {
				if (cell.text && cell.text.trim() !== '') {
					acc.wordCount += countWords(cell.text);
					acc.paragraphCount += countParagraphs(cell.text);
				}
			}
		}
	}

	if (element.type === 'group' && element.children?.length) {
		for (const child of element.children) {
			accumulateElement(child, acc);
		}
	}
}

/**
 * Pure statistics computation over a slide list + core properties. Exported
 * separately from the composable so it is trivially unit-testable without a
 * Vue reactive context.
 */
export function computeDocumentStatistics(
	slides: PptxSlide[],
	coreProperties: PptxCoreProperties | undefined,
): DocumentStatistics {
	const acc: Accumulator = { elementCount: 0, wordCount: 0, paragraphCount: 0 };
	let hiddenSlideCount = 0;
	let noteCount = 0;

	for (const slide of slides) {
		if (slide.hidden) {
			hiddenSlideCount += 1;
		}
		if (slide.notes && slide.notes.trim() !== '') {
			noteCount += 1;
		}
		for (const element of slide.elements) {
			accumulateElement(element, acc);
		}
	}

	return {
		slideCount: slides.length,
		hiddenSlideCount,
		noteCount,
		elementCount: acc.elementCount,
		wordCount: acc.wordCount,
		paragraphCount: acc.paragraphCount,
		created: coreProperties?.created,
		modified: coreProperties?.modified,
		revision: coreProperties?.revision,
		lastModifiedBy: coreProperties?.lastModifiedBy,
	};
}

/**
 * `useDocumentStatistics` — reactive wrapper around
 * {@link computeDocumentStatistics}. Recomputes whenever the slide list or
 * core properties change.
 *
 * @param slides - reactive `PptxSlide[]` source (ref / getter / plain value).
 * @param coreProperties - reactive `PptxCoreProperties | undefined` source.
 */
export function useDocumentStatistics(
	slides: MaybeRefOrGetter<PptxSlide[]>,
	coreProperties: MaybeRefOrGetter<PptxCoreProperties | undefined>,
): ComputedRef<DocumentStatistics> {
	return computed(() => computeDocumentStatistics(toValue(slides), toValue(coreProperties)));
}
