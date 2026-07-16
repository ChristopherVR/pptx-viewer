import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import { projectSmartArtNodeText } from './smartart-node-text-projection';

describe('smartArt node text projection', () => {
	it('projects paragraphs, formatted items, bullets, alignment, tabs, and fields', () => {
		const node: PptxSmartArtNode = {
			id: 'node-1',
			text: 'Bold\t7\nTail\nSecond',
			paragraphs: [
				{
					pPr: {
						'@_algn': 'ctr',
						'@_lvl': '2',
						'a:buChar': { '@_char': '•' },
					},
					items: [
						{ kind: 'run', run: { text: 'Bold', rPr: { '@_b': '1', '@_sz': '1800' } } },
						{ kind: 'tab' },
						{
							kind: 'field',
							id: 'field-1',
							fieldType: 'slidenum',
							text: '7',
							rPr: { '@_i': '1' },
						},
						{ kind: 'break', rPr: { '@_lang': 'fr-FR' } },
						{ kind: 'run', run: { text: 'Tail' } },
					],
					endParaRPr: { '@_lang': 'en-US' },
				},
				{
					pPr: { '@_algn': 'r' },
					items: [{ kind: 'run', run: { text: 'Second', rPr: { '@_u': 'sng' } } }],
				},
			],
		};

		const segments = projectSmartArtNodeText(node, { color: '#FFFFFF' });
		expect(segments.map((segment) => segment.text)).toStrictEqual([
			'Bold',
			'\t',
			'7',
			'\n',
			'Tail',
			'',
			'Second',
		]);
		expect(segments[0]).toMatchObject({
			style: { bold: true, fontSize: 24, align: 'center' },
			bulletInfo: { char: '•' },
			paragraphLevel: 2,
			endParaRunProperties: { '@_lang': 'en-US' },
		});
		expect(segments[2]).toMatchObject({
			fieldType: 'slidenum',
			fieldGuid: 'field-1',
			style: { italic: true },
		});
		expect(segments[3]).toMatchObject({
			isLineBreak: true,
			breakRunProperties: { '@_lang': 'fr-FR' },
		});
		expect(segments[5].isParagraphBreak).toBeTruthy();
		expect(segments[6]).toMatchObject({ style: { underline: true, align: 'right' } });
	});

	it('falls back to legacy flat text when paragraphs are absent', () => {
		expect(projectSmartArtNodeText({ id: 'plain', text: 'Plain' }, { bold: true })).toStrictEqual([
			{ text: 'Plain', style: { bold: true } },
		]);
	});
});
