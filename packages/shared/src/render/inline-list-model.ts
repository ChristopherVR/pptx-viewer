import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { inlineListBodyText } from './inline-list-body';
import type { InlineListReadResult, InlineTextEditSnapshot } from './inline-list-types';

export type InlineListModelChange =
	| { kind: 'current' }
	| { kind: 'retire' }
	| { kind: 'format'; snapshot: InlineTextEditSnapshot };

/** Observe existing model transactions; this does not create or manage history. */
export function createInlineListModelObserver(element: PptxElement) {
	const initial = hasTextProperties(element) ? element : undefined;
	let body = initial?.textSegments
		? inlineListBodyText(initial.textSegments)
		: (initial?.text ?? '');
	let segments = JSON.stringify(initial?.textSegments);
	let style = JSON.stringify(initial?.textStyle);
	return {
		/** Call after supported explicit DOM formatting and before its model transaction. */
		expect(snapshot: InlineTextEditSnapshot): void {
			if (snapshot.elementId === element.id && snapshot.textSegments) {
				body = snapshot.text;
				segments = JSON.stringify(snapshot.textSegments);
			}
		},
		/** Call on model updates and before pending save; failed format must retire the session. */
		check(model: PptxElement | undefined, read: InlineListReadResult): InlineListModelChange {
			if (!model || model.id !== element.id || !hasTextProperties(model)) {
				return { kind: 'retire' };
			}
			const nextBody = model.textSegments
				? inlineListBodyText(model.textSegments)
				: (model.text ?? '');
			const nextSegments = JSON.stringify(model.textSegments);
			const nextStyle = JSON.stringify(model.textStyle);
			if (body === nextBody && segments === nextSegments && style === nextStyle) {
				return { kind: 'current' };
			}
			body = nextBody;
			segments = nextSegments;
			style = nextStyle;
			if (read.kind !== 'supported' || read.snapshot.text !== nextBody || !model.textSegments) {
				return { kind: 'retire' };
			}
			return {
				kind: 'format',
				snapshot: { elementId: model.id, text: nextBody, textSegments: model.textSegments },
			};
		},
	};
}
