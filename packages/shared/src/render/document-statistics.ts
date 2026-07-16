import type { PptxCoreProperties, PptxElement, PptxSlide, TextSegment } from 'pptx-viewer-core';

/** Live document statistics derived from the editable slide model. */
export interface DocumentStatistics {
	slideCount: number;
	hiddenSlideCount: number;
	noteCount: number;
	elementCount: number;
	wordCount: number;
	paragraphCount: number;
	created: string | undefined;
	modified: string | undefined;
	revision: string | undefined;
	lastModifiedBy: string | undefined;
}

export function countWords(text: string | undefined): number {
	const trimmed = text?.trim() ?? '';
	return trimmed ? trimmed.split(/\s+/u).length : 0;
}

function countParagraphs(text: string | undefined): number {
	return text?.split(/\r\n|\r|\n/u).filter((line) => line.trim()).length ?? 0;
}

function segmentsToText(segments: TextSegment[] | undefined): string {
	return segments?.map((segment) => segment.text ?? '').join('') ?? '';
}

function elementPlainText(element: PptxElement): string {
	const textElement = element as PptxElement & { text?: string; textSegments?: TextSegment[] };
	return segmentsToText(textElement.textSegments) || textElement.text || '';
}

interface Accumulator {
	elementCount: number;
	wordCount: number;
	paragraphCount: number;
}

function accumulateElement(element: PptxElement, acc: Accumulator): void {
	acc.elementCount += 1;
	const text = elementPlainText(element);
	acc.wordCount += countWords(text);
	acc.paragraphCount += countParagraphs(text);
	if (element.type === 'table' && element.tableData) {
		for (const row of element.tableData.rows) {
			for (const cell of row.cells) {
				acc.wordCount += countWords(cell.text);
				acc.paragraphCount += countParagraphs(cell.text);
			}
		}
	}
	if (element.type === 'group') {
		for (const child of element.children ?? []) {
			accumulateElement(child, acc);
		}
	}
}

/** Compute current counts rather than trusting potentially stale app.xml totals. */
export function computeDocumentStatistics(
	slides: readonly PptxSlide[],
	coreProperties: PptxCoreProperties | undefined,
): DocumentStatistics {
	const acc: Accumulator = { elementCount: 0, wordCount: 0, paragraphCount: 0 };
	let hiddenSlideCount = 0;
	let noteCount = 0;
	for (const slide of slides) {
		if (slide.hidden) {
			hiddenSlideCount += 1;
		}
		if (slide.notes?.trim()) {
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
		...acc,
		created: coreProperties?.created,
		modified: coreProperties?.modified,
		revision: coreProperties?.revision,
		lastModifiedBy: coreProperties?.lastModifiedBy,
	};
}
