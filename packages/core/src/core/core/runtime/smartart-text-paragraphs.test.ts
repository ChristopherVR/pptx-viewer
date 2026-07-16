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
	'<a:p><a:pPr lvl="1"/><a:r><a:rPr b="1"/><a:t>Bold</a:t></a:r>' +
	'<a:tab/><a:fld id="f1" type="slidenum"><a:rPr i="1"/><a:pPr/><a:t>Field</a:t></a:fld>' +
	'<a:br><a:rPr lang="en-US"/></a:br><a:r><a:t>Tail</a:t></a:r>' +
	'<a:extLst><a:ext uri="keep"/></a:extLst><a:endParaRPr sz="1800"/></a:p>' +
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
			'field',
			'break',
			'run',
		]);
		expect(paragraphs[0].pPr).toStrictEqual({ '@_lvl': '1' });
		expect(paragraphs[0].endParaRPr).toStrictEqual({ '@_sz': '1800' });
		expect(paragraphs[0].items[2]).toMatchObject({
			kind: 'field',
			id: 'f1',
			fieldType: 'slidenum',
			text: 'Field',
			rPr: { '@_i': '1' },
			pPr: {},
		});
		expect(smartArtParagraphsText(paragraphs)).toBe('Bold\tField\nTail\nSecond');
		expect(firstParagraphRuns(paragraphs)?.map((run) => run.text)).toStrictEqual(['Bold', 'Tail']);
	});

	it('serializes typed edits and retains unmodelled extension children', () => {
		const factory = new PptxRuntimeDependencyFactory();
		const parsed = factory.createParser().parse(XML) as XmlObject;
		const paragraphs = parseSmartArtTextParagraphs(point(parsed))!;
		const field = paragraphs[0].items[2];
		if (field.kind === 'field') {
			field.text = 'Edited';
		}

		const xml = factory.createBuilder().build({
			'dgm:t': {
				'a:p': paragraphs.map(buildSmartArtTextParagraph),
			},
		});
		const firstParagraph = /<a:p>.*?<\/a:p>/u.exec(xml)?.[0] ?? '';
		expect(
			[...firstParagraph.matchAll(/<a:(r|tab|fld|br)\b/gu)].map((match) => match[1]),
		).toStrictEqual(['r', 'tab', 'fld', 'br', 'r']);
		expect(xml).toContain('<a:t>Edited</a:t>');
		expect(xml).toContain('<a:ext uri="keep"');
		expect(xml).toContain('<a:endParaRPr sz="1800"');
	});
});
