import type { PptxElement } from 'pptx-viewer-core';

import { LOCAL_SYNC_ORIGIN } from './collaboration-reconcile';
import type { YDocLike, YjsFactories, YMapLike } from './collaboration-sync';
import { COMPLEX_ELEMENT_FIELDS } from './collaboration-sync';
import { encodeTextBody } from './collaboration-text-codec';
import { isYTextEditable } from './collaboration-text-merge';
import { createInlineListSeed, inlineListSession } from './inline-list-seed';

/** Upgrade only scalar-only legacy text, using the same seed as its native editor. */
export function initializeCollaborationText(
	doc: YDocLike,
	element: YMapLike,
	factories: YjsFactories,
	isCurrent: () => boolean,
): void {
	const needsSeed = (): boolean => {
		const body = element.get('textBody');
		return (
			(body === undefined || (isYTextEditable(body) && body.toDelta().length === 0)) &&
			typeof element.get('text') === 'string'
		);
	};
	if (!isCurrent() || !needsSeed()) {
		return;
	}
	doc.transact(() => {
		// A host may replace the element, seed its text, or revoke writes on transaction start.
		if (!isCurrent() || !needsSeed()) {
			return;
		}
		let textStyle: unknown;
		try {
			const raw = element.get(COMPLEX_ELEMENT_FIELDS.textStyle);
			if (typeof raw === 'string') {
				textStyle = JSON.parse(raw);
			}
		} catch {
			/* The legacy scalar is still editable without malformed style metadata. */
		}
		const seed = createInlineListSeed(
			{
				id: element.get('id'),
				type: element.get('type'),
				text: element.get('text'),
				textStyle,
			} as PptxElement,
			{ includePlain: true },
		);
		const segments = seed && inlineListSession(seed)?.originalSegments;
		if (!segments) {
			return;
		}
		const previous = element.get('textBody');
		const text = isYTextEditable(previous) ? previous : factories.createText();
		encodeTextBody(segments, text);
		if (text !== previous) {
			element.set('textBody', text);
		}
	}, LOCAL_SYNC_ORIGIN);
}
