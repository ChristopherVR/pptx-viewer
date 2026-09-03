/**
 * Utilities for reading and restoring text selections within the inline text
 * editor contentEditable, and for applying style updates to a subset of text
 * segments based on the current selection. Framework-agnostic (uses DOM globals
 * only; no framework imports).
 */
import type { TextSegment, TextStyle } from 'pptx-viewer-core';

export { getInlineEditorSelection } from './inline-editor-selection';

/** Describes which segments (and offsets within them) are selected. */
export interface InlineTextSelection {
	startSegIdx: number;
	startOffset: number;
	endSegIdx: number;
	endOffset: number;
}

let pendingRestore: InlineTextSelection | null = null;

export function setPendingSelectionRestore(sel: InlineTextSelection | null): void {
	pendingRestore = sel;
}

/** Read-once: clears the stored value after returning it. */
export function getPendingSelectionRestore(): InlineTextSelection | null {
	const sel = pendingRestore;
	pendingRestore = null;
	return sel;
}

/**
 * Apply `updates` only to the characters within the selection range. Segments
 * at the boundaries are split; segments outside the range are copied unchanged.
 * Paragraph-break segments (`\n`) are always passed through unchanged.
 *
 * Returns the new segments array AND the selection coordinates mapped to the
 * new segment indices (for cursor restoration).
 */
export function applyStyleToSelectedSegments(
	segments: TextSegment[],
	selection: InlineTextSelection,
	updates: Partial<TextStyle>,
): { newSegments: TextSegment[]; newSelection: InlineTextSelection } {
	const { startSegIdx, startOffset, endSegIdx, endOffset } = selection;
	const result: TextSegment[] = [];

	// Track new indices for the start/end of the selected text in the new array.
	let newStartSegIdx = -1;
	let newStartOffset = 0;
	let newEndSegIdx = -1;
	let newEndOffset = 0;

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];

		// Paragraph-break segments always pass through.
		if (seg.isParagraphBreak || seg.text === '\n') {
			result.push({ ...seg, style: { ...seg.style } });
			continue;
		}

		// Before selection range.
		if (i < startSegIdx) {
			result.push({ ...seg, style: { ...seg.style } });
			continue;
		}

		// After selection range.
		if (i > endSegIdx) {
			result.push({ ...seg, style: { ...seg.style } });
			continue;
		}

		// Single-segment selection (start and end in the same segment).
		if (i === startSegIdx && i === endSegIdx) {
			splitSingle(seg, startOffset, endOffset, updates, result);
			// Track the new selection: the selected part is at `result.length - 1`
			// (or `result.length - 2` if there's an after part).
			const partsAdded = (startOffset > 0 ? 1 : 0) + 1 + (endOffset < seg.text.length ? 1 : 0);
			const selectedPartIdx = result.length - partsAdded + (startOffset > 0 ? 1 : 0);
			newStartSegIdx = selectedPartIdx;
			newStartOffset = 0;
			newEndSegIdx = selectedPartIdx;
			newEndOffset = endOffset - startOffset;
			continue;
		}

		// Start segment of multi-segment selection.
		if (i === startSegIdx) {
			if (startOffset === 0) {
				newStartSegIdx = result.length;
				newStartOffset = 0;
				result.push({ ...seg, style: { ...seg.style, ...updates } });
			} else {
				// Before-selection part.
				const beforeSeg: TextSegment = {
					text: seg.text.slice(0, startOffset),
					style: { ...seg.style },
				};
				if (seg.bulletInfo) {
					beforeSeg.bulletInfo = seg.bulletInfo;
				}
				result.push(beforeSeg);

				// Selected part.
				newStartSegIdx = result.length;
				newStartOffset = 0;
				result.push({
					text: seg.text.slice(startOffset),
					style: { ...seg.style, ...updates },
				});
			}
			continue;
		}

		// End segment of multi-segment selection.
		if (i === endSegIdx) {
			if (endOffset >= seg.text.length) {
				result.push({ ...seg, style: { ...seg.style, ...updates } });
				newEndSegIdx = result.length - 1;
				newEndOffset = seg.text.length;
			} else {
				// Selected part.
				result.push({
					text: seg.text.slice(0, endOffset),
					style: { ...seg.style, ...updates },
				});
				newEndSegIdx = result.length - 1;
				newEndOffset = endOffset;

				// After-selection part.
				result.push({
					text: seg.text.slice(endOffset),
					style: { ...seg.style },
				});
			}
			continue;
		}

		// Middle segment: entirely within selection.
		result.push({ ...seg, style: { ...seg.style, ...updates } });
	}

	return {
		newSegments: result,
		newSelection: {
			startSegIdx: newStartSegIdx,
			startOffset: newStartOffset,
			endSegIdx: newEndSegIdx,
			endOffset: newEndOffset,
		},
	};
}

function splitSingle(
	seg: TextSegment,
	startOffset: number,
	endOffset: number,
	updates: Partial<TextStyle>,
	result: TextSegment[],
): void {
	// Entire segment selected.
	if (startOffset === 0 && endOffset >= seg.text.length) {
		result.push({ ...seg, style: { ...seg.style, ...updates } });
		return;
	}

	// Before-selection part.
	if (startOffset > 0) {
		const beforeSeg: TextSegment = {
			text: seg.text.slice(0, startOffset),
			style: { ...seg.style },
		};
		if (seg.bulletInfo) {
			beforeSeg.bulletInfo = seg.bulletInfo;
		}
		result.push(beforeSeg);
	}

	// Selected part.
	result.push({
		text: seg.text.slice(startOffset, endOffset),
		style: { ...seg.style, ...updates },
	});

	// After-selection part.
	if (endOffset < seg.text.length) {
		result.push({
			text: seg.text.slice(endOffset),
			style: { ...seg.style },
		});
	}
}

/**
 * Set the DOM selection inside the inline editor using segment-level
 * coordinates. Finds `[data-seg-idx]` spans and navigates to the correct
 * text-node offsets.
 */
export function restoreSegmentSelection(
	editor: HTMLElement,
	startSegIdx: number,
	startOffset: number,
	endSegIdx: number,
	endOffset: number,
): void {
	const sel = window.getSelection();
	if (!sel) {
		return;
	}

	const startPos = findTextPositionInSegment(editor, startSegIdx, startOffset);
	const endPos = findTextPositionInSegment(editor, endSegIdx, endOffset);
	if (!startPos || !endPos) {
		return;
	}

	const range = document.createRange();
	range.setStart(startPos.node, startPos.offset);
	range.setEnd(endPos.node, endPos.offset);
	sel.removeAllRanges();
	sel.addRange(range);
}

interface DomPosition {
	node: Node;
	offset: number;
}

function findTextPositionInSegment(
	editor: HTMLElement,
	segIdx: number,
	charOffset: number,
): DomPosition | null {
	const segSpan = editor.querySelector(`[data-seg-idx="${segIdx}"]`);
	if (!segSpan) {
		return null;
	}

	const walker = document.createTreeWalker(segSpan, NodeFilter.SHOW_TEXT);
	let charCount = 0;
	let node: Node | null;
	while ((node = walker.nextNode())) {
		const textLen = (node as Text).length;
		if (charCount + textLen >= charOffset) {
			return { node, offset: charOffset - charCount };
		}
		charCount += textLen;
	}

	// If exact position not found, place at end of last text node.
	const lastTextNode = segSpan.querySelector('*') ? null : segSpan.firstChild;
	if (lastTextNode && lastTextNode.nodeType === Node.TEXT_NODE) {
		return { node: lastTextNode, offset: (lastTextNode as Text).length };
	}

	return null;
}
