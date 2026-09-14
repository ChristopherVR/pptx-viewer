import type { TextSegment } from 'pptx-viewer-core';
import { isBulletMarkerSegment } from 'pptx-viewer-shared';

/** Existing plain editor seed, separate from the native list-session producer. */
export function seedPlainInlineText(
	surface: HTMLElement,
	segments: TextSegment[] | undefined,
	initialText: string,
): HTMLElement {
	const doc = surface.ownerDocument;
	let textContainer = surface;
	if (segments?.length) {
		// The text-block style makes the surface a flex column so vertical
		// alignment applies to paragraphs. Keep rich-text runs inside one flex
		// item; direct flex children are blockified onto separate rows.
		const textFlow = doc.createElement('div');
		textFlow.dataset.pptxTextFlow = '';
		textContainer = textFlow;
		segments.forEach((segment, index) => {
			const span = doc.createElement('span');
			span.dataset.segIdx = String(index);
			if (isBulletMarkerSegment(segment)) {
				span.dataset.pptxBulletMarker = '';
				span.contentEditable = 'false';
			}
			const precedingMarker = index > 0 && isBulletMarkerSegment(segments[index - 1]);
			const carriesList = segment.bulletInfo && !segment.bulletInfo.none;
			if (
				segment.text.length === 0 &&
				index === segments.length - 1 &&
				(precedingMarker || carriesList)
			) {
				// An empty inline span after a non-editable list marker has no caret
				// position. A display-only BR lets that pending list item receive text.
				span.dataset.pptxEmptyRun = '';
				span.appendChild(doc.createElement('br'));
			} else {
				span.textContent = segment.text;
			}
			textFlow.appendChild(span);
		});
		surface.appendChild(textFlow);
	} else {
		surface.textContent = initialText;
	}
	return textContainer;
}
