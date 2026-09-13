import type { TextPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createInlineListModelObserver } from './inline-list-model';
import type { InlineListReadResult, InlineTextEditSnapshot } from './inline-list-types';

const original: TextPptxElement = {
	id: 'list',
	type: 'text',
	x: 0,
	y: 0,
	width: 100,
	height: 100,
	text: 'Original',
	textSegments: [{ text: 'Original', style: {} }],
};
const draft: InlineTextEditSnapshot = {
	elementId: 'list',
	text: 'Current',
	textSegments: [{ text: 'Current', style: { bold: true } }],
};
const read = (snapshot: InlineTextEditSnapshot): InlineListReadResult => ({
	kind: 'supported',
	snapshot,
	paragraphs: [],
});

describe('list model observer', () => {
	it('ignores model geometry while retaining pending typed content', () => {
		const observer = createInlineListModelObserver(original);
		expect(observer.check({ ...original, width: 200 }, read(draft))).toStrictEqual({
			kind: 'current',
		});
	});

	it('keeps a just-painted format transaction current, including changed body text', () => {
		const observer = createInlineListModelObserver(original);
		observer.expect(draft);
		expect(
			observer.check(
				{ ...original, text: draft.text, textSegments: draft.textSegments },
				read(draft),
			),
		).toStrictEqual({ kind: 'current' });
	});

	it('detects immediate Undo to the initial model without an intervening render/read', () => {
		const observer = createInlineListModelObserver(original);
		observer.expect(draft);
		expect(observer.check(original, read(draft))).toStrictEqual({ kind: 'retire' });
	});

	it('reconciles same-body style Undo rather than reviving its old live formatting on save', () => {
		const observer = createInlineListModelObserver(original);
		const formatted = {
			...draft,
			text: 'Original',
			textSegments: [{ text: 'Original', style: { bold: true } }],
		};
		observer.expect(formatted);
		expect(observer.check(original, read(formatted))).toMatchObject({
			kind: 'format',
			snapshot: { text: 'Original', textSegments: original.textSegments },
		});
	});

	it('retires a replaced or deleted element and never guesses range styles onto a different body', () => {
		const observer = createInlineListModelObserver(original);
		expect(
			observer.check(
				{ ...original, textSegments: [{ text: 'Original', style: { italic: true } }] },
				read(draft),
			),
		).toStrictEqual({ kind: 'retire' });
		expect(observer.check(undefined, read(draft))).toStrictEqual({ kind: 'retire' });
	});
});
