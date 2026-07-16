import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import { PptxRuntimeDependencyFactory } from '../factories/PptxRuntimeDependencyFactory';
import {
	buildSmartArtTextParagraph,
	firstParagraphRuns,
	parseSmartArtTextParagraphs,
	smartArtParagraphsText,
} from './smartart-text-paragraphs';

const XML =
	'<dgm:dataModel xmlns:dgm="urn:dgm" xmlns:a="urn:a"><dgm:ptLst>' +
	'<dgm:pt modelId="1"><dgm:t><a:bodyPr/><a:lstStyle/>' +
	'<a:p><a:pPr lvl="1"/><a:r><a:rPr b="1"/><a:extLst><a:ext uri="run-keep"/></a:extLst><a:t>Bold</a:t></a:r>' +
	'<a:tab/><a:extLst><a:ext uri="paragraph-keep"/></a:extLst>' +
	'<a:fld id="f1" type="slidenum"><a:rPr i="1"/><a:extLst><a:ext uri="field-keep"/></a:extLst><a:pPr/><a:t>Field</a:t></a:fld>' +
	'<a:br><a:rPr lang="en-US"/></a:br><a:r><a:t>Tail</a:t></a:r>' +
	'<a:endParaRPr sz="1800"/></a:p>' +
	'<a:p><a:pPr algn="ctr"/><a:r><a:t>Second</a:t></a:r></a:p>' +
	'</dgm:t></dgm:pt></dgm:ptLst></dgm:dataModel>';

function point(parsed: XmlObject): XmlObject {
	return (((parsed['dgm:dataModel'] as XmlObject)['dgm:ptLst'] as XmlObject)['dgm:pt'] ??
		{}) as XmlObject;
}

describe('smartArt typed text paragraphs', () => {
	it('preserves every paragraph and interleaved text item in source order', () => {
		const factory = new PptxRuntimeDependencyFactory();
		const parsed = factory.createParser().parse(XML) as XmlObject;
		const paragraphs = parseSmartArtTextParagraphs(point(parsed))!;

		expect(paragraphs).toHaveLength(2);
		expect(paragraphs[0].items.map((item) => item.kind)).toStrictEqual([
			'run',
			'tab',
			'raw',
			'field',
			'break',
			'run',
		]);
		expect(paragraphs[0].pPr).toStrictEqual({ '@_lvl': '1' });
		expect(paragraphs[0].endParaRPr).toStrictEqual({ '@_sz': '1800' });
		expect(paragraphs[0].items[3]).toMatchObject({
			kind: 'field',
			id: 'f1',
			fieldType: 'slidenum',
			text: 'Field',
			rPr: { '@_i': '1' },
			pPr: {},
		});
		expect(paragraphs[0].items[0]).toMatchObject({
			kind: 'run',
			run: { childOrder: ['rPr', 'extLst', 't'] },
		});
		expect(paragraphs[0].items[3]).toMatchObject({
			kind: 'field',
			childOrder: ['rPr', 'extLst', 'pPr', 't'],
		});
		expect(smartArtParagraphsText(paragraphs)).toBe('Bold\tField\nTail\nSecond');
		expect(firstParagraphRuns(paragraphs)?.map((run) => run.text)).toStrictEqual(['Bold', 'Tail']);
	});

	it('serializes typed edits and retains unmodelled extension children', () => {
		const factory = new PptxRuntimeDependencyFactory();
		const parsed = factory.createParser().parse(XML) as XmlObject;
		const paragraphs = parseSmartArtTextParagraphs(point(parsed))!;
		const field = paragraphs[0].items[3];
		if (field.kind === 'field') {
			field.text = 'Edited';
		}

		const xml = factory.createBuilder().build({
			'dgm:t': {
				'a:p': paragraphs.map(buildSmartArtTextParagraph),
			},
		});
		const firstParagraph = /<a:p>.*?<\/a:p>/u.exec(xml)?.[0] ?? '';
		expect(firstParagraph.indexOf('<a:tab')).toBeLessThan(
			firstParagraph.indexOf('uri="paragraph-keep"'),
		);
		expect(firstParagraph.indexOf('uri="paragraph-keep"')).toBeLessThan(
			firstParagraph.indexOf('<a:fld'),
		);
		const firstRun = /<a:r>.*?<\/a:r>/u.exec(firstParagraph)?.[0] ?? '';
		expect(firstRun.indexOf('<a:rPr')).toBeLessThan(firstRun.indexOf('uri="run-keep"'));
		expect(firstRun.indexOf('uri="run-keep"')).toBeLessThan(firstRun.indexOf('<a:t>Bold'));
		const fieldXml = /<a:fld\b.*?<\/a:fld>/u.exec(firstParagraph)?.[0] ?? '';
		expect(fieldXml.indexOf('<a:rPr')).toBeLessThan(fieldXml.indexOf('uri="field-keep"'));
		expect(fieldXml.indexOf('uri="field-keep"')).toBeLessThan(fieldXml.indexOf('<a:pPr'));
		expect(xml).toContain('<a:t>Edited</a:t>');
		expect(xml).toContain('<a:ext uri="paragraph-keep"');
		expect(xml).toContain('<a:endParaRPr sz="1800"');
	});
});
