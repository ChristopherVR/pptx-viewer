import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement, SmartArtPptxElement } from '../../core/types/elements';
import { decomposeSmartArt } from '../../core/utils/smartart-decompose';

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
		'<a:p><a:pPr lvl="1"/><a:r><a:rPr b="1" u="dbl" strike="dblStrike" baseline="30000" spc="200" cap="small" lang="fr-FR">' +
		'<a:ln w="19050"><a:solidFill><a:srgbClr val="112233"/></a:solidFill></a:ln>' +
		'<a:solidFill><a:schemeClr val="accent2"><a:tint val="20000"/></a:schemeClr></a:solidFill>' +
		'<a:effectLst><a:glow rad="19050"><a:srgbClr val="00FF00"/></a:glow></a:effectLst>' +
		'<a:highlight><a:srgbClr val="FFFF00"/></a:highlight>' +
		'<a:uFill><a:solidFill><a:srgbClr val="445566"/></a:solidFill></a:uFill>' +
		'<a:latin typeface="+mn-lt"/><a:ea typeface="Yu Gothic"/><a:cs typeface="Arial"/></a:rPr>' +
		'<a:extLst><a:ext uri="run-keep"/></a:extLst><a:t>Bold</a:t></a:r>' +
		'<a:tab/><a:extLst><a:ext uri="paragraph-keep"/></a:extLst>' +
		'<a:fld id="f1" type="slidenum"><a:rPr i="1"/><a:extLst><a:ext uri="field-keep"/></a:extLst><a:pPr/><a:t>Field</a:t></a:fld>' +
		'<a:br><a:rPr lang="en-US"/></a:br><a:r><a:t>Tail</a:t></a:r>' +
		'<a:endParaRPr sz="1800" u="sng" strike="sngStrike" baseline="-25000" spc="100" cap="all" lang="de-DE">' +
		'<a:solidFill><a:schemeClr val="accent3"/></a:solidFill>' +
		'<a:effectLst><a:glow rad="9525"><a:srgbClr val="FF00FF"/></a:glow></a:effectLst>' +
		'<a:highlight><a:srgbClr val="00FFFF"/></a:highlight></a:endParaRPr></a:p>' +
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
		const firstRun = node.paragraphs![0].items[0];
		expect(firstRun).toMatchObject({
			kind: 'run',
			run: {
				style: {
					underline: true,
					underlineStyle: 'dbl',
					underlineColor: '#445566',
					strikethrough: true,
					strikeType: 'dblStrike',
					baseline: 30000,
					characterSpacing: 200,
					textCaps: 'small',
					language: 'fr-FR',
					highlightColor: '#FFFF00',
					eastAsiaFont: 'Yu Gothic',
					complexScriptFont: 'Arial',
					textGlowColor: '#00FF00',
					textGlowRadius: 2,
					textOutlineColor: '#112233',
					textOutlineWidth: 2,
					color: '#F1975A',
					colorXml: { 'a:schemeClr': { '@_val': 'accent2', 'a:tint': { '@_val': '20000' } } },
				},
			},
		});
		expect(node.paragraphs![0].endParaStyle).toMatchObject({
			underline: true,
			strikethrough: true,
			baseline: -25000,
			characterSpacing: 100,
			textCaps: 'all',
			language: 'de-DE',
			highlightColor: '#00FFFF',
			textGlowColor: '#FF00FF',
			colorXml: { 'a:schemeClr': { '@_val': 'accent3' } },
		});
		expect(node.paragraphs![0].items.map((item) => item.kind)).toStrictEqual([
			'run',
			'tab',
			'raw',
			'field',
			'break',
			'run',
		]);

		node.text = 'Bold!\tField\nTail\nSecond edited';
		element.smartArtData!.drawingShapes = undefined;
		element.smartArtData!.drawingDirty = true;
		const renderModel = decomposeSmartArt(element.smartArtData!, {
			x: element.x,
			y: element.y,
			width: element.width,
			height: element.height,
		});
		const renderShape = renderModel?.find((candidate) => candidate.type === 'shape');
		expect(renderShape?.textSegments?.map((segment) => segment.text)).toStrictEqual([
			'Bold!',
			'\t',
			'Field',
			'\n',
			'Tail',
			'',
			'Second edited',
		]);
		expect(renderShape?.textSegments?.[0].style).toMatchObject({
			underlineStyle: 'dbl',
			strikeType: 'dblStrike',
			baseline: 30000,
			characterSpacing: 200,
			underlineColor: '#445566',
			highlightColor: '#FFFF00',
			textGlowColor: '#00FF00',
			textOutlineColor: '#112233',
			color: '#F1975A',
			colorXml: { 'a:schemeClr': { '@_val': 'accent2' } },
		});
		expect(renderShape?.textSegments?.[5].style).toMatchObject({
			strikethrough: true,
			baseline: -25000,
			characterSpacing: 100,
			textCaps: 'all',
			language: 'de-DE',
			highlightColor: '#00FFFF',
			textGlowColor: '#FF00FF',
		});

		const saved = await handler.save(loaded.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const savedData = await savedZip.file('ppt/diagrams/data1.xml')!.async('string');
		const drawingXml = await savedZip.file('ppt/diagrams/drawing1.xml')!.async('string');
		expect(drawingXml.match(/<a:p(?:>|\s)/gu)).toHaveLength(2);
		expect(drawingXml).toContain('<a:tab');
		expect(drawingXml).toContain('<a:fld id="f1" type="slidenum"');
		expect(drawingXml).toContain('<a:br>');
		expect(drawingXml).toContain('b="1"');
		expect(drawingXml).toContain('strike="dblStrike"');
		expect(drawingXml).toContain('baseline="30000"');
		expect(drawingXml).toContain('<a:schemeClr val="accent2"><a:tint val="20000"');
		expect(drawingXml).toContain('<a:effectLst><a:glow rad="19050"');
		expect(drawingXml).toContain('<a:highlight><a:srgbClr val="FFFF00"');
		expect(drawingXml).toContain('<a:uFill><a:solidFill><a:srgbClr val="445566"');
		expect(drawingXml).toContain('<a:ln w="19050"');
		expect(drawingXml).toContain('<a:ea typeface="Yu Gothic"');
		const richPoint = /<dgm:pt\b[^>]*>[\s\S]*?<a:t>Bold!<\/a:t>[\s\S]*?<\/dgm:pt>/u.exec(
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
		expect(reloadedNode.text).toBe('Bold!\tField\nTail\nSecond edited');
		expect(reloadedNode.paragraphs?.[0].pPr).toStrictEqual({ '@_lvl': '1' });
		expect(reloadedNode.paragraphs?.[0].endParaRPr).toMatchObject({
			'@_sz': '1800',
			'@_strike': 'sngStrike',
			'@_baseline': '-25000',
			'@_spc': '100',
			'@_cap': 'all',
			'@_lang': 'de-DE',
			'a:solidFill': { 'a:schemeClr': { '@_val': 'accent3' } },
		});
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
		const cachedShape = smartArtElement(reloaded.slides).smartArtData!.drawingShapes?.find(
			(shape) => shape.text?.includes('Bold!'),
		);
		expect(cachedShape?.textSegments?.map((segment) => segment.text)).toStrictEqual([
			'Bold!',
			'\t',
			'Field',
			'\n',
			'Tail',
			'',
			'Second edited',
		]);
		expect(cachedShape?.textSegments?.[0]).toMatchObject({
			style: {
				bold: true,
				strikeType: 'dblStrike',
				baseline: 30000,
				underlineColor: '#445566',
				highlightColor: '#FFFF00',
				textGlowColor: '#00FF00',
				textOutlineColor: '#112233',
				color: '#F1975A',
				colorXml: { 'a:schemeClr': { '@_val': 'accent2' } },
			},
		});
	});
});
