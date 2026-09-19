import type { PptxElement } from 'pptx-viewer-core';

import { encodeSegmentsToDelta } from './collaboration-text-codec';
import { createCollaborationTextProjection } from './collaboration-text-projection';
import type { CollaborationTextTarget } from './collaboration-text-target';
import { initializeInlineListDom } from './inline-list-dom';
import { createInlineListSeed } from './inline-list-seed';
import { readInlineListSelection, restoreInlineListBodySelection } from './inline-list-selection';
import type { InlineListSeed, InlineTextEditSnapshot } from './inline-list-types';

/** Only text model changes revoke a native draft; moving a shape does not. */
export function collaborationInlineModelKey(element: PptxElement | undefined): string {
	return JSON.stringify(
		element && {
			id: element.id,
			type: element.type,
			...('text' in element ? { text: element.text } : {}),
			...('textSegments' in element ? { textSegments: element.textSegments } : {}),
			...('textStyle' in element ? { textStyle: element.textStyle } : {}),
		},
	);
}

/** Prepare offscreen; never bypass the one-time initializer's ownership guard. */
export function prepareCollaborationInlineDom(
	root: HTMLElement,
	element: PptxElement,
	snapshot: InlineTextEditSnapshot,
): { seed: InlineListSeed; children: Node[] } | undefined {
	const seed = createInlineListSeed({ ...element, ...snapshot } as PptxElement, {
		includePlain: true,
	});
	if (!seed) {
		return undefined;
	}
	const detached = root.ownerDocument.createElement('div');
	return initializeInlineListDom(detached, seed)
		? { seed, children: Array.from(detached.childNodes) }
		: undefined;
}

/** Capture the editor's observed identities before a remote repaint. */
export function bookmarkCollaborationInlineSelection(
	root: HTMLElement,
	seed: InlineListSeed,
	snapshot: InlineTextEditSnapshot,
	target: CollaborationTextTarget,
): ((nextSeed: InlineListSeed, next: InlineTextEditSnapshot) => void) | undefined {
	const selected = readInlineListSelection(seed, root);
	const selection = root.ownerDocument.getSelection();
	const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
	const backward = Boolean(
		range &&
		!range.collapsed &&
		selection?.anchorNode === range.endContainer &&
		selection.anchorOffset === range.endOffset,
	);
	const segments = snapshot.textSegments ?? [];
	const projection = createCollaborationTextProjection(
		segments,
		encodeSegmentsToDelta(segments),
		snapshot.text,
	);
	if (selected.kind !== 'supported' || !selected.bodyRange || !projection) {
		return undefined;
	}
	const { start, end } = selected.bodyRange;
	const first = projection.bodyOffsetToEncoded(start);
	const last = projection.bodyOffsetToEncoded(end);
	if (!first || !last) {
		return undefined;
	}
	const from = target.bookmark(first.end, 0);
	const to = start === end ? from : target.bookmark(last.start, -1);
	return (nextSeed, next) => {
		const nextSegments = next.textSegments ?? [];
		const nextProjection = createCollaborationTextProjection(
			nextSegments,
			encodeSegmentsToDelta(nextSegments),
			next.text,
		);
		const encodedStart = from();
		const encodedEnd = to();
		const bodyStart =
			encodedStart === null ? undefined : nextProjection?.encodedOffsetToBody(encodedStart);
		const bodyEnd =
			encodedEnd === null ? undefined : nextProjection?.encodedOffsetToBody(encodedEnd);
		if (bodyStart !== undefined && bodyEnd !== undefined) {
			restoreInlineListBodySelection(nextSeed, root, {
				start: Math.min(bodyStart, bodyEnd),
				end: Math.max(bodyStart, bodyEnd),
			});
			if (backward && selection?.rangeCount) {
				const restored = selection.getRangeAt(0);
				selection.setBaseAndExtent(
					restored.endContainer,
					restored.endOffset,
					restored.startContainer,
					restored.startOffset,
				);
			}
		}
	};
}
