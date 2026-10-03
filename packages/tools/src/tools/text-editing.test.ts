import type { PptxElementWithText } from 'ooxml-core/pptx';
import { describe, expect, it } from 'vitest';

import { replaceElementText, setElementText } from './text-editing.js';

function element(): PptxElementWithText {
	return {
		id: 'text',
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		text: '✓ First point\n✓ Second point',
		textSegments: [
			{
				text: '✓ ',
				style: {},
				bulletInfo: { char: '✓', ownedByParagraph: true },
				paragraphProperties: { paragraphMarginLeft: 36 },
			},
			{ text: 'First ', style: { bold: true } },
			{ text: 'point', style: {} },
			{ text: '\n', style: {} },
			{ text: '✓ ', style: {}, bulletInfo: { char: '✓', ownedByParagraph: true } },
			{ text: 'Second ', style: { italic: true } },
			{ text: 'point', style: {} },
		],
	};
}

describe('text segment edits', () => {
	it('replaces a match spanning runs while keeping untouched paragraphs and markers', () => {
		const el = element();
		const first = structuredClone(el.textSegments!.slice(0, 5));
		expect(replaceElementText(el, /Second point/g, 'Edited')).toBe(1);
		expect(el.text).toBe('✓ First point\n✓ Edited');
		expect(el.textSegments!.slice(0, 5)).toStrictEqual(first);
		expect(el.textSegments![5]).toStrictEqual({ text: 'Edited', style: { italic: true } });
	});

	it('supports multiple replacements, captures and native replacement tokens', () => {
		const el = element();
		expect(replaceElementText(el, /(point)/g, '$1!$$')).toBe(2);
		expect(el.text).toBe('✓ First point!$\n✓ Second point!$');
	});

	it('supports zero-width matches without discarding segments', () => {
		const el = element();
		replaceElementText(el, /(?=point)/g, 'new ');
		expect(el.text).toBe('✓ First new point\n✓ Second new point');
	});

	it('updates only the edited range when a full text value is supplied', () => {
		const el = element();
		setElementText(el, el.text!.replace('Second point', 'Second point, edited'));
		expect(el.text).toBe('✓ First point\n✓ Second point, edited');
		expect(el.textSegments![0].bulletInfo?.ownedByParagraph).toBeTruthy();
	});

	it('keeps synthetic bullet markers when multiple paragraphs change together', () => {
		const el = element();
		setElementText(el, '✓ New first point\n✓ New second point');
		expect(el.text).toBe('✓ New first point\n✓ New second point');
		expect(
			el
				.textSegments!.filter((segment) => !segment.bulletInfo?.ownedByParagraph)
				.map((segment) => segment.text)
				.join(''),
		).toBe('New first point\nNew second point');
	});
});
