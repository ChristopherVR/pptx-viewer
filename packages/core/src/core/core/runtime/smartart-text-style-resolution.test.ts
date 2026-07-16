import { describe, expect, it } from 'vitest';

import type { PptxSmartArtTextParagraph } from '../../types';
import { resolveSmartArtTextStyles } from './smartart-text-style-resolution';

describe('resolveSmartArtTextStyles', () => {
	it('keeps item identity while resolving runs, fields, breaks, and paragraph terminators', () => {
		const paragraphs: PptxSmartArtTextParagraph[] = [
			{
				items: [
					{ kind: 'run', run: { text: 'Run', rPr: { '@_lang': 'fr-FR' } } },
					{ kind: 'field', text: '1', rPr: { '@_lang': 'de-DE' } },
					{ kind: 'break', rPr: { '@_lang': 'ja-JP' } },
					{ kind: 'tab' },
				],
				endParaRPr: { '@_lang': 'es-ES' },
			},
		];

		const resolved = resolveSmartArtTextStyles(paragraphs, (rPr) => ({
			language: String(rPr['@_lang']),
		}));

		expect(resolved?.[0].items.map((item) => item.kind)).toStrictEqual([
			'run',
			'field',
			'break',
			'tab',
		]);
		expect(resolved?.[0]).toMatchObject({
			items: [
				{ run: { style: { language: 'fr-FR' } } },
				{ style: { language: 'de-DE' } },
				{ style: { language: 'ja-JP' } },
				{ kind: 'tab' },
			],
			endParaStyle: { language: 'es-ES' },
		});
	});
});
