import { describe, expect, it } from 'vitest';

import type { PptxSmartArtTextParagraph } from '../../types';
import { smartArtParagraphsText } from './smartart-text-paragraphs';
import { reconcileSmartArtTextParagraphs } from './smartart-text-reconciliation';

function richParagraphs(): PptxSmartArtTextParagraph[] {
	return [
		{
			pPr: { '@_lvl': '1' },
			items: [
				{ kind: 'run', run: { text: 'Alpha', rPr: { '@_b': '1' } } },
				{ kind: 'raw', name: 'a:extLst', value: { 'a:ext': { '@_uri': 'keep' } } },
				{ kind: 'run', run: { text: 'Beta', rPr: { '@_i': '1' } } },
			],
			endParaRPr: { '@_sz': '1800' },
		},
		{
			items: [{ kind: 'run', run: { text: 'Gamma', rPr: { '@_u': 'sng' } } }],
		},
	];
}

describe('smartArt legacy text reconciliation', () => {
	it('allocates common prefix and suffix edits without touching unaffected formatting', () => {
		const source = richParagraphs();
		const prefix = reconcileSmartArtTextParagraphs(source, 'Start AlphaBeta\nGamma');
		expect(prefix[0].items[0]).toMatchObject({
			kind: 'run',
			run: { text: 'Start Alpha', rPr: { '@_b': '1' } },
		});
		expect(prefix[0].items[2]).toStrictEqual(source[0].items[2]);

		const suffix = reconcileSmartArtTextParagraphs(source, 'AlphaBeta\nGamma end');
		expect(suffix[1].items[0]).toMatchObject({
			kind: 'run',
			run: { text: 'Gamma end', rPr: { '@_u': 'sng' } },
		});
		expect(suffix[0]).toStrictEqual(source[0]);
	});

	it('distributes a cross-run replacement according to removed run lengths', () => {
		const reconciled = reconcileSmartArtTextParagraphs(richParagraphs(), 'AlpWXYZta\nGamma');
		expect(reconciled[0].items[0]).toMatchObject({
			kind: 'run',
			run: { text: 'AlpWX', rPr: { '@_b': '1' } },
		});
		expect(reconciled[0].items[2]).toMatchObject({
			kind: 'run',
			run: { text: 'YZta', rPr: { '@_i': '1' } },
		});
		expect(reconciled[0].items[1]).toStrictEqual(richParagraphs()[0].items[1]);
	});

	it('merges and splits paragraph boundaries while retaining adjacent run styles', () => {
		const merged = reconcileSmartArtTextParagraphs(richParagraphs(), 'AlphaBeta Gamma');
		expect(merged).toHaveLength(1);
		expect(smartArtParagraphsText(merged)).toBe('AlphaBeta Gamma');
		expect(merged[0].items).toStrictEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: 'run',
					run: expect.objectContaining({ rPr: { '@_u': 'sng' } }),
				}),
			]),
		);

		const splitSource: PptxSmartArtTextParagraph[] = [
			{
				items: [
					{ kind: 'run', run: { text: 'Alpha', rPr: { '@_b': '1' } } },
					{ kind: 'run', run: { text: 'Beta Gamma', rPr: { '@_i': '1' } } },
				],
			},
		];
		const split = reconcileSmartArtTextParagraphs(splitSource, 'AlphaBeta\nGamma');
		expect(split).toHaveLength(2);
		expect(smartArtParagraphsText(split)).toBe('AlphaBeta\nGamma');
		expect(split[0].items[1]).toMatchObject({
			kind: 'run',
			run: { text: 'Beta', rPr: { '@_i': '1' } },
		});
		expect(split[1].items[0]).toMatchObject({
			kind: 'run',
			run: { text: 'Gamma', rPr: { '@_i': '1' } },
		});
	});

	it('handles deletion to empty text without retaining stale content', () => {
		const reconciled = reconcileSmartArtTextParagraphs(richParagraphs(), '');
		expect(smartArtParagraphsText(reconciled)).toBe('');
		expect(reconciled).toHaveLength(1);
		expect(reconciled[0].items.filter((item) => item.kind === 'raw')).toHaveLength(1);
	});
});
