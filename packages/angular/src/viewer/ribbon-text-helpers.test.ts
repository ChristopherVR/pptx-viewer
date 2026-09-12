import type { PptxElement, PptxSlide, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { remapTextToSegments } from '../internal/shared-src/render/remap-text';
import { EditorStateService } from './editor-state.service';
import { patchTextStyle, transformSelectedTextCase } from './ribbon-text-helpers';

function textElement(): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'hello world',
		textStyle: { fontSize: 18 },
		textSegments: [{ text: 'hello world', style: { fontSize: 18 } }],
	} as PptxElement;
}

function slide(elements: PptxElement[]): PptxSlide {
	return { id: 's1', rId: 's1', slideNumber: 1, elements };
}

function service(el: PptxElement): EditorStateService {
	const svc = new EditorStateService();
	svc.setSlides([slide([el])]);
	return svc;
}

describe('transformSelectedTextCase', () => {
	it('honors explicit formatting before typing into a runless paragraph', () => {
		const initial = {
			...textElement(),
			text: '',
			textSegments: [
				{
					text: '',
					style: {},
					paragraphInsertionStyle: { bold: true, color: '#007000', fontSize: 40 },
				},
			],
		} as PptxElement;
		const svc = service(initial);
		const updates = { bold: false, color: '#000000', fontSize: 24 };
		patchTextStyle(svc, 0, initial, updates);
		const element = svc.slides()[0].elements[0] as PptxElement & { textSegments: TextSegment[] };
		expect(remapTextToSegments('Typed', element.textSegments, {})[0].style).toMatchObject(updates);
	});

	it('rewrites run text per a change-case mode', () => {
		const svc = service(textElement());
		transformSelectedTextCase(svc, 0, svc.slides()[0].elements[0], 'upper');

		const el = svc.slides()[0].elements[0] as PptxElement & {
			text?: string;
			textSegments?: Array<{ text: string }>;
		};
		expect(el.textSegments?.[0].text).toBe('HELLO WORLD');
		expect(el.text).toBe('HELLO WORLD');
	});

	it('reconciles against a live open inline editor before transforming case', () => {
		// The inline-edit `<textarea data-inline-editor>` is uncontrolled: text
		// typed since the edit session began is not yet on the model's
		// `textSegments`/`text`. Regression: previously the case transform ran
		// against that stale snapshot, leaving anything typed since
		// untransformed once the edit session committed.
		const editor = document.createElement('textarea');
		editor.dataset.inlineEditor = '';
		editor.value = 'hello world, typed more';
		document.body.appendChild(editor);
		try {
			const svc = service(textElement()); // model still says "hello world"
			transformSelectedTextCase(svc, 0, svc.slides()[0].elements[0], 'upper');

			const el = svc.slides()[0].elements[0] as PptxElement & {
				text?: string;
				textSegments?: Array<{ text: string }>;
			};
			expect(el.textSegments?.map((s) => s.text).join('')).toBe('HELLO WORLD, TYPED MORE');
			expect(el.text).toBe('HELLO WORLD, TYPED MORE');
		} finally {
			editor.remove();
		}
	});
});
