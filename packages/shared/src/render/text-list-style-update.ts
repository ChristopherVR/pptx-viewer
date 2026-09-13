import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import {
	elementBulletKind,
	isBulletMarkerSegment,
	paragraphBulletKind,
	setElementBullets,
} from './bullet-toggle';
import type { ParagraphBulletKind } from './bullet-toggle';
import { applyStyleToSelectedSegments } from './inline-selection-utils';
import type { InlineTextSelection } from './inline-selection-utils';
import { isParagraphSeparatorSegment as isParagraphBreak } from './text-segment-paragraph-break';

/** Body offsets ignore only the leading display marker of each paragraph. */
function positions(segments: readonly TextSegment[]): Array<{
	start: number;
	end: number;
	paragraph: number;
	editable: boolean;
}> {
	let offset = 0;
	let paragraph = 0;
	let first = true;
	return segments.map((segment) => {
		const marker = first && isBulletMarkerSegment(segment);
		const start = offset;
		if (!marker) {
			offset += segment.text.length;
		}
		const entry = {
			start,
			end: offset,
			paragraph,
			editable: !marker && !isParagraphBreak(segment),
		};
		first = isParagraphBreak(segment);
		if (first) {
			paragraph += 1;
		}
		return entry;
	});
}

function restorePoint(
	segments: readonly TextSegment[],
	offset: number,
	end: boolean,
): { index: number; offset: number } {
	const entries = positions(segments);
	let fallback = { index: 0, offset: 0 };
	for (const [index, entry] of entries.entries()) {
		if (!entry.editable) {
			continue;
		}
		fallback = { index, offset: segments[index].text.length };
		if (end ? offset <= entry.end : offset < entry.end) {
			return { index, offset: Math.max(0, offset - entry.start) };
		}
	}
	return fallback;
}

/** Keep paragraph metadata on the first run when character styling splits it. */
function restoreParagraphMetadata(original: TextSegment[], updated: TextSegment[]): TextSegment[] {
	const firstRuns = original.filter(
		(_, index) => index === 0 || isParagraphBreak(original[index - 1]),
	);
	let paragraph = 0;
	return updated.map((segment, index) => {
		const first = index === 0 || isParagraphBreak(updated[index - 1]);
		if (!first) {
			return segment;
		}
		const source = firstRuns[paragraph++];
		if (!source) {
			return segment;
		}
		return {
			...segment,
			bulletInfo: source.bulletInfo,
			paragraphLevel: source.paragraphLevel,
			paragraphProperties: source.paragraphProperties,
			endParaRunProperties: source.endParaRunProperties,
		};
	});
}

/** Current kind at the first selected paragraph; otherwise the element default. */
export function selectedParagraphBulletKind(
	element: PptxElement,
	selection: InlineTextSelection | null,
): ParagraphBulletKind {
	if (!selection || !hasTextProperties(element) || !element.textSegments) {
		return elementBulletKind(element);
	}
	let first = selection.startSegIdx;
	while (first > 0 && !isParagraphBreak(element.textSegments[first - 1])) {
		first -= 1;
	}
	return paragraphBulletKind(element.textSegments.slice(first));
}

/**
 * Apply a list request to touched paragraphs, while accompanying character
 * styles retain their existing selection scope. A null selection means the
 * whole element, matching the existing editor contract.
 */
export function applyListStyleUpdate(
	element: PptxElement,
	updates: Partial<TextStyle>,
	selection: InlineTextSelection | null,
): { patch: Partial<PptxElement>; selection: InlineTextSelection | null } {
	if (!hasTextProperties(element) || !updates.listType) {
		return { patch: {}, selection };
	}
	const { listType, ...characterStyle } = updates;
	let segments = element.textSegments;
	let workingSelection = selection;
	if (segments && Object.keys(characterStyle).length > 0) {
		if (selection) {
			const styled = applyStyleToSelectedSegments(segments, selection, characterStyle);
			segments = restoreParagraphMetadata(segments, styled.newSegments);
			workingSelection = styled.newSelection;
		} else {
			segments = segments.map((segment) => ({
				...segment,
				style: { ...segment.style, ...characterStyle },
			}));
		}
	}
	const working = {
		...element,
		textSegments: segments,
		textStyle: selection ? element.textStyle : { ...element.textStyle, ...characterStyle },
	};
	if (!workingSelection || !segments) {
		return { patch: setElementBullets(working, listType), selection: null };
	}
	const entries = positions(segments);
	const startEntry = entries[workingSelection.startSegIdx];
	const endEntry = entries[workingSelection.endSegIdx];
	if (!startEntry || !endEntry) {
		return { patch: {}, selection: null };
	}
	const startOffset = startEntry.start + workingSelection.startOffset;
	const endOffset = endEntry.start + workingSelection.endOffset;
	const lastSelected = [...entries].reverse().find((entry) => entry.start < endOffset);
	const patch = setElementBullets(working, listType, {
		startParagraph: startEntry.paragraph,
		endParagraph: lastSelected?.paragraph ?? endEntry.paragraph,
	});
	const next = { ...working, ...patch };
	const nextSegments = hasTextProperties(next) ? next.textSegments : undefined;
	if (!nextSegments) {
		return { patch, selection: null };
	}
	const start = restorePoint(nextSegments, startOffset, false);
	const end = restorePoint(nextSegments, endOffset, true);
	return {
		patch,
		selection: {
			startSegIdx: start.index,
			startOffset: start.offset,
			endSegIdx: end.index,
			endOffset: end.offset,
		},
	};
}
