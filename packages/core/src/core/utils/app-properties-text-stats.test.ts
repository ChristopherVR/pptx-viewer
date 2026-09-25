import { describe, expect, it } from 'vitest';

import { countPartTextStatistics } from './app-properties-text-stats';

const run = (text: string): string => `<a:r><a:rPr lang="en-US"/><a:t>${text}</a:t></a:r>`;
const para = (...content: string[]): string => `<a:p>${content.join('')}</a:p>`;
const EMPTY_PARA = '<a:p><a:endParaRPr lang="en-US"/></a:p>';
const body = (...paragraphs: string[]): string =>
	`<p:sp><p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs.join('')}</p:txBody></p:sp>`;
const slide = (...shapes: string[]): string =>
	`<p:sld xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree>${shapes.join('')}</p:spTree></p:cSld></p:sld>`;

/**
 * Paragraph expectations are PowerPoint 16.0's own `<Paragraphs>` for the same
 * text authored over COM (see `app-properties-text-stats.ts`).
 */
describe('countPartTextStatistics', () => {
	it('counts a blank line between paragraphs but not trailing blank lines', () => {
		expect(
			countPartTextStatistics(slide(body(para(run('one')), EMPTY_PARA, para(run('two'))))),
		).toStrictEqual({
			words: 2,
			paragraphs: 3,
		});
		expect(
			countPartTextStatistics(slide(body(para(run('one')), EMPTY_PARA, EMPTY_PARA))),
		).toStrictEqual({
			words: 1,
			paragraphs: 1,
		});
		expect(countPartTextStatistics(slide(body(EMPTY_PARA, para(run('one')))))).toStrictEqual({
			words: 1,
			paragraphs: 2,
		});
	});

	it('gives an empty text body and a bare paragraph nothing', () => {
		expect(countPartTextStatistics(slide(body(EMPTY_PARA), body('<a:p/>')))).toStrictEqual({
			words: 0,
			paragraphs: 0,
		});
	});

	it('counts whitespace-only and line-break-only paragraphs as text', () => {
		expect(countPartTextStatistics(slide(body(para(run('one')), para(run('   ')))))).toStrictEqual({
			words: 2,
			paragraphs: 2,
		});
		expect(countPartTextStatistics(slide(body(para(run('one')), para('<a:br/>'))))).toStrictEqual({
			words: 2,
			paragraphs: 2,
		});
	});

	it('reads runs, fields and line breaks in document order', () => {
		const xml = slide(
			body(
				para(
					run('one'),
					'<a:br><a:rPr lang="en-US"/></a:br>',
					'<a:fld type="slidenum"><a:t>2</a:t></a:fld>',
				),
			),
		);
		expect(countPartTextStatistics(xml)).toStrictEqual({ words: 3, paragraphs: 1 });
	});

	it('decodes entities before counting', () => {
		expect(countPartTextStatistics(slide(body(para(run('a &amp; b')))))).toStrictEqual({
			words: 3,
			paragraphs: 1,
		});
	});

	it('counts every table cell as its own text body', () => {
		const cell = (...paragraphs: string[]): string =>
			`<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${paragraphs.join('')}</a:txBody></a:tc>`;
		const table = `<p:graphicFrame><a:graphic><a:graphicData><a:tbl><a:tr>${cell(para(run('a b')))}${cell(EMPTY_PARA)}</a:tr><a:tr>${cell(EMPTY_PARA)}${cell(para(run('c')), para(run('d')))}</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
		expect(countPartTextStatistics(slide(table))).toStrictEqual({ words: 4, paragraphs: 3 });
	});

	it('counts markup-compatibility content once, from the choice', () => {
		const xml = slide(
			`<mc:AlternateContent><mc:Choice Requires="p14">${body(para(run('one two')))}</mc:Choice><mc:Fallback>${body(para(run('one two')))}</mc:Fallback></mc:AlternateContent>`,
		);
		expect(countPartTextStatistics(xml)).toStrictEqual({ words: 2, paragraphs: 1 });
	});

	it('counts SmartArt data-model text bodies', () => {
		const point = (paragraph: string): string =>
			`<dgm:pt><dgm:t><a:bodyPr/><a:lstStyle/>${paragraph}</dgm:t></dgm:pt>`;
		const xml = `<dgm:dataModel><dgm:ptLst>${point(para(run('one two')))}${point(EMPTY_PARA)}</dgm:ptLst></dgm:dataModel>`;
		expect(countPartTextStatistics(xml)).toStrictEqual({ words: 2, paragraphs: 1 });
	});
});
