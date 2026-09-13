import type { TextSegment } from 'pptx-viewer-core';

import { isBulletMarkerSegment } from './bullet-toggle';
import { readInlineListSnapshot } from './inline-list-snapshot';
import type { InlineListSeed, InlineTextEditSnapshot } from './inline-list-types';
import type { InlineTextSelection } from './inline-selection-utils';
import { readEditableText } from './inline-text-extract';
import { isParagraphSeparatorSegment } from './text-segment-paragraph-break';

export type InlineListSelectionResult =
	| {
			kind: 'supported';
			snapshot: InlineTextEditSnapshot;
			selection: InlineTextSelection | null;
			bodyRange?: { start: number; end: number };
	  }
	| { kind: 'unsupported'; reason: string };

function paragraphBodies(segments: TextSegment[]): string[] {
	const paragraphs = [''];
	let first = true;
	for (const segment of segments) {
		if (isParagraphSeparatorSegment(segment)) {
			paragraphs.push('');
			first = true;
		} else {
			if (!first || !isBulletMarkerSegment(segment)) {
				paragraphs[paragraphs.length - 1] += segment.text;
			}
			first = false;
		}
	}
	return paragraphs;
}

function modelPoint(
	segments: TextSegment[],
	offset: number,
	end: boolean,
): { index: number; offset: number } {
	let position = 0;
	let first = true;
	let last = { index: 0, offset: 0 };
	for (const [index, segment] of segments.entries()) {
		const marker = first && isBulletMarkerSegment(segment);
		first = isParagraphSeparatorSegment(segment);
		if (marker) {
			continue;
		}
		const next = position + segment.text.length;
		if (!first && !segment.isLineBreak) {
			last = { index, offset: segment.text.length };
			if (end ? offset <= next : offset < next || (offset === position && next === position)) {
				return { index, offset: Math.max(0, offset - position) };
			}
		}
		position = next;
	}
	return last;
}

/** Current DOM offsets, not cloned data-seg-idx attributes, identify the selected runs. */
export function readInlineListSelection(
	seed: InlineListSeed,
	root: HTMLElement,
	selection: Selection | null = root.ownerDocument.defaultView?.getSelection() ?? null,
): InlineListSelectionResult {
	const read = readInlineListSnapshot(seed, root);
	if (read.kind !== 'supported') {
		return { kind: 'unsupported', reason: read.reason };
	}
	const { snapshot } = read;
	if (!selection?.rangeCount) {
		return { kind: 'supported', snapshot, selection: null };
	}
	const range = selection.getRangeAt(0);
	if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
		return { kind: 'unsupported', reason: 'selection-outside-session' };
	}
	const blocks = Array.from(root.children);
	const bodies = paragraphBodies(snapshot.textSegments!);
	// Substituted fields/equations may have a different displayed length. Never guess offsets.
	if (
		blocks.some(
			(block, index) =>
				readEditableText(block) !== bodies[index] &&
				!(bodies[index] === '' && readEditableText(block) === '\n'),
		)
	) {
		return { kind: 'unsupported', reason: 'displayed-body-offset-mismatch' };
	}
	const bodyOffset = (node: Node, offset: number): number | undefined => {
		if (node === root) {
			const count = Array.from(root.childNodes)
				.slice(0, offset)
				.filter((child) => child.nodeType === 1).length;
			return Math.min(
				snapshot.text.length,
				bodies.slice(0, count).reduce((total, body) => total + body.length + 1, 0),
			);
		}
		let block: Node | null = node;
		while (block && block.parentNode !== root) {
			block = block.parentNode;
		}
		const index = blocks.indexOf(block as Element);
		if (index < 0) {
			return undefined;
		}
		const prefix = root.ownerDocument.createRange();
		prefix.selectNodeContents(block!);
		prefix.setEnd(node, offset);
		return (
			bodies.slice(0, index).reduce((total, body) => total + body.length + 1, 0) +
			Math.min(bodies[index].length, readEditableText(prefix.cloneContents()).length)
		);
	};
	const start = bodyOffset(range.startContainer, range.startOffset);
	const end = bodyOffset(range.endContainer, range.endOffset);
	if (start === undefined || end === undefined) {
		return { kind: 'unsupported', reason: 'unknown-selection-boundary' };
	}
	const from = modelPoint(snapshot.textSegments!, start, false);
	const to = modelPoint(snapshot.textSegments!, end, true);
	return {
		kind: 'supported',
		snapshot,
		bodyRange: { start, end },
		selection: {
			startSegIdx: from.index,
			startOffset: from.offset,
			endSegIdx: to.index,
			endOffset: to.offset,
		},
	};
}

/** Restore the same authored characters after an explicit run-format split. */
export function restoreInlineListBodySelection(
	seed: InlineListSeed,
	root: HTMLElement,
	bodyRange: { start: number; end: number },
): boolean {
	const read = readInlineListSnapshot(seed, root);
	if (read.kind !== 'supported') {
		return false;
	}
	const bodies = paragraphBodies(read.snapshot.textSegments!);
	const blocks = Array.from(root.children);
	const point = (absolute: number): { node: Node; offset: number } | undefined => {
		let remaining = absolute;
		for (const [index, block] of blocks.entries()) {
			if (remaining > bodies[index].length) {
				remaining -= bodies[index].length + 1;
				continue;
			}
			let found: { node: Node; offset: number } | undefined;
			let blockOffset = remaining;
			const walk = (node: Node): void => {
				if (found) {
					return;
				}
				if (node.nodeType === 3) {
					const length = node.nodeValue?.length ?? 0;
					if (blockOffset <= length) {
						found = { node, offset: blockOffset };
					} else {
						blockOffset -= length;
					}
					return;
				}
				if (
					!(node instanceof HTMLElement) ||
					node.hasAttribute('data-pptx-bullet-marker') ||
					node.tagName === 'RT'
				) {
					return;
				}
				if (node.tagName === 'BR') {
					blockOffset = Math.max(0, blockOffset - 1);
					return;
				}
				for (const child of Array.from(node.childNodes)) {
					walk(child);
				}
			};
			walk(block);
			return found ?? { node: block, offset: block.childNodes.length };
		}
		return undefined;
	};
	const start = point(bodyRange.start);
	const end = point(bodyRange.end);
	const selection = root.ownerDocument.defaultView?.getSelection();
	if (!start || !end || !selection) {
		return false;
	}
	const range = root.ownerDocument.createRange();
	range.setStart(start.node, start.offset);
	range.setEnd(end.node, end.offset);
	selection.removeAllRanges();
	selection.addRange(range);
	return true;
}
