import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { smartArtParagraphsText } from '../../core/core/runtime/smartart-text-paragraphs';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement, SmartArtPptxElement } from '../../core/types/elements';

async function presentationWithRichSmartArtText(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	data.slides[0].elements.push({
		id: 'smartart-rich-text',
		type: 'smartArt',
		x: 100,
		y: 80,
		width: 500,
		height: 300,
		smartArtData: {
			layout: 'basicBlockList',
			colorScheme: 'colorful1',
			style: 'flat',
			nodes: [{ id: 'source-node', text: 'Alpha' }],
		},
	} as SmartArtPptxElement as PptxElement);
	const initial = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(initial);
	const dataPath = 'ppt/diagrams/data1.xml';
	const dataXml = await zip.file(dataPath)!.async('string');
	const richParagraphs =
		'<a:p><a:pPr lvl="1"/><a:r><a:rPr b="1"/><a:extLst><a:ext uri="run-keep"/></a:extLst><a:t>Bold</a:t></a:r>' +
		'<a:tab/><a:extLst><a:ext uri="paragraph-keep"/></a:extLst>' +
		'<a:fld id="f1" type="slidenum"><a:rPr i="1"/><a:extLst><a:ext uri="field-keep"/></a:extLst><a:pPr/><a:t>Field</a:t></a:fld>' +
		'<a:br><a:rPr lang="en-US"/></a:br><a:r><a:t>Tail</a:t></a:r>' +
		'<a:endParaRPr sz="1800"/></a:p>' +
		'<a:p><a:pPr algn="ctr"/><a:r><a:rPr u="sng"/><a:t>Second</a:t></a:r></a:p>';
	const alphaParagraph = /<a:p>[^<]*(?:<(?!\/a:p>)[^<]*)*<a:t>Alpha<\/a:t>[\s\S]*?<\/a:p>/u;
	const patched = dataXml.replace(alphaParagraph, richParagraphs);
	expect(patched).not.toBe(dataXml);
	zip.file(dataPath, patched);
	return zip.generateAsync({ type: 'uint8array' });
}

function smartArtElement(slides: { elements: PptxElement[] }[]): SmartArtPptxElement {
	return slides[0].elements.find(
		(element): element is SmartArtPptxElement => element.type === 'smartArt',
	)!;
}

describe('smartArt data-model paragraph round-trip', () => {
	it('loads, edits, saves, and reloads complete typed paragraph content', async () => {
		const input = await presentationWithRichSmartArtText();
		const handler = new PptxHandler();
		const loaded = await handler.load(input.buffer as ArrayBuffer);
		const element = smartArtElement(loaded.slides);
		const node = element.smartArtData!.nodes[0];

		expect(node.text).toBe('Bold\tField\nTail\nSecond');
		expect(node.runs?.map((run) => run.text)).toStrictEqual(['Bold', 'Tail']);
		expect(node.paragraphs).toHaveLength(2);
		expect(node.paragraphs![0].items.map((item) => item.kind)).toStrictEqual([
			'run',
			'tab',
			'raw',
			'field',
			'break',
			'run',
		]);

		const secondRun = node.paragraphs![1].items[0];
		expect(secondRun.kind).toBe('run');
		if (secondRun.kind === 'run') {
			secondRun.run.text = 'Second edited';
		}
		node.text = smartArtParagraphsText(node.paragraphs!);

		const saved = await handler.save(loaded.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const savedData = await savedZip.file('ppt/diagrams/data1.xml')!.async('string');
		const richPoint = /<dgm:pt\b[^>]*>[\s\S]*?<a:t>Bold<\/a:t>[\s\S]*?<\/dgm:pt>/u.exec(
			savedData,
		)?.[0];
		expect(richPoint).toBeDefined();
		expect(richPoint).toContain('<a:t>Second edited</a:t>');
		expect(richPoint).toContain('<a:ext uri="paragraph-keep"');
		expect(richPoint.indexOf('<a:tab')).toBeLessThan(richPoint.indexOf('uri="paragraph-keep"'));
		expect(richPoint.indexOf('uri="paragraph-keep"')).toBeLessThan(richPoint.indexOf('<a:fld'));
		const runXml = /<a:r>.*?<\/a:r>/u.exec(richPoint)?.[0] ?? '';
		expect(runXml.indexOf('<a:rPr')).toBeLessThan(runXml.indexOf('uri="run-keep"'));
		expect(runXml.indexOf('uri="run-keep"')).toBeLessThan(runXml.indexOf('<a:t>Bold'));
		const fieldXml = /<a:fld\b.*?<\/a:fld>/u.exec(richPoint)?.[0] ?? '';
		expect(fieldXml.indexOf('<a:rPr')).toBeLessThan(fieldXml.indexOf('uri="field-keep"'));
		expect(fieldXml.indexOf('uri="field-keep"')).toBeLessThan(fieldXml.indexOf('<a:pPr'));
		expect(
			[...(richPoint ?? '').matchAll(/<a:(r|tab|fld|br)\b/gu)].map((match) => match[1]),
		).toStrictEqual(['r', 'tab', 'fld', 'br', 'r', 'r']);

		const reloader = new PptxHandler();
		const reloaded = await reloader.load(saved.buffer as ArrayBuffer);
		const reloadedNode = smartArtElement(reloaded.slides).smartArtData!.nodes[0];
		expect(reloadedNode.text).toBe('Bold\tField\nTail\nSecond edited');
		expect(reloadedNode.paragraphs?.[0].pPr).toStrictEqual({ '@_lvl': '1' });
		expect(reloadedNode.paragraphs?.[0].endParaRPr).toStrictEqual({ '@_sz': '1800' });
		expect(reloadedNode.paragraphs?.[1].items[0]).toMatchObject({
			kind: 'run',
			run: { text: 'Second edited', rPr: { '@_u': 'sng' } },
		});
		expect(reloadedNode.paragraphs?.[0].items[0]).toMatchObject({
			kind: 'run',
			run: {
				childOrder: ['rPr', 'extLst', 't'],
				rawXml: { 'a:extLst': { 'a:ext': { '@_uri': 'run-keep' } } },
			},
		});
		expect(reloadedNode.paragraphs?.[0].items[3]).toMatchObject({
			kind: 'field',
			childOrder: ['rPr', 'extLst', 'pPr', 't'],
			rawXml: { 'a:extLst': { 'a:ext': { '@_uri': 'field-keep' } } },
		});
	});
});
