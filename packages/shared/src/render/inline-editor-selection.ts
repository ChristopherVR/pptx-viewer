import type { TextSegment } from 'pptx-viewer-core';

import { isBulletMarkerSegment } from './bullet-toggle';
import type { InlineTextSelection } from './inline-selection-utils';

interface SegmentPosition {
	segIdx: number;
	offset: number;
	span: Element;
	textLength: number;
}

/**
 * Read the current browser selection and, if it falls within an
 * `[data-inline-editor]` element, return the segment-level range.
 *
 * Returns `null` when there is no editable text selected, the selection is
 * collapsed (just a cursor), or the selection is outside the inline editor.
 */
export function getInlineEditorSelection(
	segments: TextSegment[] | undefined,
): InlineTextSelection | null {
	if (!segments?.length) {
		return null;
	}
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
		return null;
	}

	// A Range is always in document order, including for a backwards selection.
	const range = selection.getRangeAt(0);
	const editor = findEditorContainer(range.startContainer);
	if (!editor || !editor.contains(range.endContainer) || range.toString().length === 0) {
		return null;
	}
	const start = getSegmentPosition(editor, range.startContainer, range.startOffset, segments);
	const end = getSegmentPosition(editor, range.endContainer, range.endOffset, segments);
	if (!start || !end) {
		return null;
	}

	const renderedSpans = Array.from(editor.querySelectorAll('[data-seg-idx]'));
	const startSpanIndex = renderedSpans.indexOf(start.span);
	const endSpanIndex = renderedSpans.indexOf(end.span);
	if (startSpanIndex < 0 || endSpanIndex < startSpanIndex) {
		return null;
	}
	const selectedSpans = renderedSpans.slice(startSpanIndex, endSpanIndex + 1);
	const first = selectedSpans.find(
		(span) =>
			isEditableSpan(span, segments) && (span !== start.span || start.offset < start.textLength),
	);
	const last = [...selectedSpans]
		.reverse()
		.find((span) => isEditableSpan(span, segments) && (span !== end.span || end.offset > 0));
	if (!first || !last) {
		return null;
	}

	return {
		startSegIdx: getSegmentIndex(first),
		startOffset: first === start.span ? start.offset : 0,
		endSegIdx: getSegmentIndex(last),
		endOffset: last === end.span ? end.offset : (last.textContent?.length ?? 0),
	};
}

function isEditableSpan(span: Element, segments: TextSegment[]): boolean {
	const segment = segments[getSegmentIndex(span)];
	return Boolean(
		segment &&
		!segment.isParagraphBreak &&
		segment.text !== '\n' &&
		!isBulletMarkerSegment(segment) &&
		(span.textContent?.length ?? 0) > 0,
	);
}

function getSegmentIndex(span: Element): number {
	return Number(span.getAttribute('data-seg-idx'));
}

function findEditorContainer(node: Node): Element | null {
	const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
	return element?.closest('[data-inline-editor]') ?? null;
}

function getSegmentPosition(
	editor: Element,
	node: Node,
	offset: number,
	segments: TextSegment[],
): SegmentPosition | null {
	const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
	const span = element?.closest('[data-seg-idx]');
	if (!span || !editor.contains(span)) {
		return null;
	}
	const segIdx = getSegmentIndex(span);
	if (!Number.isInteger(segIdx) || segIdx < 0 || segIdx >= segments.length) {
		return null;
	}
	return {
		segIdx,
		offset: getTextOffsetWithin(span, node, offset),
		span,
		textLength: span.textContent?.length ?? 0,
	};
}

function getTextOffsetWithin(container: Element, targetNode: Node, targetOffset: number): number {
	if (targetNode === container || targetNode.nodeType === Node.ELEMENT_NODE) {
		const parent = targetNode === container ? container : targetNode;
		let count = 0;
		for (let index = 0; index < targetOffset && index < parent.childNodes.length; index++) {
			count += parent.childNodes[index].textContent?.length ?? 0;
		}
		return count;
	}

	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
	let charCount = 0;
	let node: Node | null;
	while ((node = walker.nextNode())) {
		if (node === targetNode) {
			return charCount + targetOffset;
		}
		charCount += (node as Text).length;
	}
	return charCount;
}
