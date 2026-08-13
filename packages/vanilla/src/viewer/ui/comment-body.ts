import type { PptxComment } from 'pptx-viewer-core';
import {
	COMMENT_MENTION_ATTRIBUTE,
	COMMENT_MENTION_CLASS,
	commentTextSegments,
} from 'pptx-viewer-shared';

/**
 * Fill an element with a comment body, highlighting its `@`-mentions.
 *
 * The split into text/mention runs is the shared decision function
 * `commentTextSegments`, so all five bindings produce identical runs. This
 * helper only maps the resulting descriptor onto DOM nodes.
 *
 * Text runs are written as text nodes (never innerHTML), so a comment body
 * containing markup stays inert.
 */
export function renderCommentBody(
	host: HTMLElement,
	text: string,
	mentions?: PptxComment['mentions'],
): HTMLElement {
	host.textContent = '';
	const doc = host.ownerDocument;
	const segments = commentTextSegments(text, mentions);
	if (segments.length === 0) {
		host.textContent = text;
		return host;
	}
	for (const segment of segments) {
		if (segment.kind !== 'mention') {
			host.appendChild(doc.createTextNode(segment.text));
			continue;
		}
		const span = doc.createElement('span');
		span.className = COMMENT_MENTION_CLASS;
		span.setAttribute(COMMENT_MENTION_ATTRIBUTE, segment.personId || '');
		if (segment.authorName) {
			span.title = segment.authorName;
		}
		span.textContent = segment.text;
		host.appendChild(span);
	}
	return host;
}
