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

	// G3: `dgm:presLayoutVars/dgm:bulletEnabled` (e.g. "Vertical Bullet List")
	// auto-bullets a node's subordinate outline levels even though the
	// layoutDef's item template writes no `a:buChar` of its own.
	describe('bulletEnabled (dgm:presLayoutVars)', () => {
		function twoLevelNode(pPrLvl1: Record<string, unknown> = {}): PptxSmartArtNode {
			return {
				id: 'n',
				text: 'Title\nSub point',
				paragraphs: [
					{ pPr: {}, items: [{ kind: 'run', run: { text: 'Title' } }] },
					{
						pPr: { '@_lvl': '1', ...pPrLvl1 },
						items: [{ kind: 'run', run: { text: 'Sub point' } }],
					},
				],
			};
		}

		it('synthesizes a bullet on a level>=1 paragraph with no explicit bullet markup', () => {
			const segments = projectSmartArtNodeText(twoLevelNode(), {}, { bulletEnabled: true });
			// segment index 2 is the first segment of the second paragraph
			// (index 0 = title run, index 1 = paragraph-break marker).
			const subTitleSegment = segments.find((s) => s.text === 'Sub point');
			expect(subTitleSegment).toMatchObject({ bulletInfo: { char: '•' }, paragraphLevel: 1 });
		});

		it('never bullets the level-0 paragraph even when bulletEnabled is true', () => {
			const segments = projectSmartArtNodeText(twoLevelNode(), {}, { bulletEnabled: true });
			const titleSegment = segments.find((s) => s.text === 'Title');
			expect(titleSegment?.bulletInfo).toBeUndefined();
		});

		it('does not synthesize a bullet when bulletEnabled is false/omitted', () => {
			const segments = projectSmartArtNodeText(twoLevelNode());
			const subTitleSegment = segments.find((s) => s.text === 'Sub point');
			expect(subTitleSegment?.bulletInfo).toBeUndefined();
		});

		it('an explicit a:buNone still wins over the synthesized bullet', () => {
			const node = twoLevelNode({ 'a:buNone': '' });
			const segments = projectSmartArtNodeText(node, {}, { bulletEnabled: true });
			const subTitleSegment = segments.find((s) => s.text === 'Sub point');
			expect(subTitleSegment?.bulletInfo).toStrictEqual({ none: true });
		});
	});
});
