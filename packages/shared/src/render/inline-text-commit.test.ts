import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildInlineTextCommitPatch } from './inline-text-commit';

function textElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'tx_1',
		type: 'text',
		x: 0,
		y: 0,
		width: 300,
		height: 40,
		text: 'Hello',
		...overrides,
	} as PptxElement;
}

describe('buildInlineTextCommitPatch', () => {
	it('skips an unchanged rich-text commit', () => {
		const element = textElement({
			text: 'Alpha Beta\nBulleted item',
			textSegments: [
				{ text: 'Alpha ', style: { bold: true } },
				{ text: 'Beta', style: { italic: true } },
				{ text: '\n', style: {}, isParagraphBreak: true },
				{ text: 'Bulleted item', style: {}, bulletInfo: { char: '•' } },
			],
		});

		expect(buildInlineTextCommitPatch(element, 'Alpha Beta\nBulleted item')).toBeUndefined();
	});

	it('preserves rich runs and paragraph metadata while changing text', () => {
		const bulletInfo = { char: '•' };
		const paragraphProperties = { paragraphSpacingBefore: 8 };
		const element = textElement({
			text: 'Alpha Beta\nBulleted item',
			textSegments: [
				{ text: 'Alpha ', style: { bold: true } },
				{ text: 'Beta', style: { italic: true } },
				{ text: '\n', style: {}, isParagraphBreak: true },
				{
					text: 'Bulleted item',
					style: { underline: true },
					bulletInfo,
					paragraphLevel: 1,
					paragraphProperties,
				},
			],
		});

		const patch = buildInlineTextCommitPatch(element, 'Alpha expanded Beta\nBulleted item edited');
		const segments = (patch as typeof element).textSegments!;

		expect(segments.map((segment) => segment.text)).toStrictEqual([
			'Alpha ',
			'expanded Beta',
			'\n',
			'Bulleted item edited',
		]);
		expect(segments[0].style.bold).toBeTruthy();
		expect(segments[1].style.italic).toBeTruthy();
		expect(segments[3].style.underline).toBeTruthy();
		expect(segments[3].bulletInfo).toBe(bulletInfo);
		expect(segments[3].paragraphLevel).toBe(1);
		expect(segments[3].paragraphProperties).toBe(paragraphProperties);
	});
});
