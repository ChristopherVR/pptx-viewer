import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ContentPartPptxElement } from '../../core/types';

async function authorInkContentPart(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	const slide = createSlide('Blank').build();
	slide.elements.push({
		id: 'authored-content-ink',
		type: 'contentPart',
		x: 100,
		y: 80,
		width: 300,
		height: 160,
		inkStrokes: [
			{
				path: 'M 0 0 L 50 25 L 100 60',
				color: '#336699',
				width: 4.5,
				opacity: 0.65,
				pressures: [0.2, 0.7, 1],
			},
			{
				path: 'M 10 70 L 90 10',
				color: '#CC3300',
				width: 2,
				opacity: 1,
				pressures: [0.4, 0.8],
			},
		],
	} satisfies ContentPartPptxElement);
	data.slides.push(slide);
	return handler.save(data.slides);
}

describe('authored contentPart InkML integration', () => {
	it('writes InkML, relationship, content type, direct shape-tree node and fallback', async () => {
		const saved = await authorInkContentPart();
		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		const types = await zip.file('[Content_Types].xml')!.async('string');
		const inkPath = Object.keys(zip.files).find((path) => /^ppt\/ink\/ink\d+\.xml$/u.test(path));
		expect(inkPath).toBeTruthy();
		const inkXml = await zip.file(inkPath!)!.async('string');

		expect(slideXml).toContain('<p:contentPart r:id="');
		expect(slideXml).toContain('<p:nvContentPartPr>');
		expect(slideXml).toContain('<p:xfrm>');
		expect(slideXml).toContain('<mc:Fallback><p:sp>');
		expect(slideXml.replace(/>\s+</gu, '><')).not.toMatch(/<p:sp><p:contentPart/u);
		expect(rels).toContain(
			'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml"',
		);
		expect(rels).toMatch(/Target="\.\.\/ink\/ink\d+\.xml"/u);
		expect(types).toContain(`PartName="/${inkPath}" ContentType="application/inkml+xml"`);
		expect(inkXml).toContain('<ink:traceFormat>');
		expect(inkXml).toContain('name="F"');
		expect(inkXml).toContain('value="#336699"');
		expect(inkXml).toContain('value="4.5"');
		expect(inkXml).toContain('value="0.65"');
		expect(inkXml).toContain('0 0 0.2, 50 25 0.7, 100 60 1');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const content = reloaded.slides[0].elements.find(
			(element): element is ContentPartPptxElement => element.type === 'contentPart',
		);
		expect(content).toMatchObject({ x: 100, y: 80, width: 300, height: 160 });
		expect(content?.inkStrokes).toMatchObject([
			{
				path: 'M 0 0 L 50 25 L 100 60',
				color: '#336699',
				width: 4.5,
				opacity: 0.65,
				pressures: [0.2, 0.7, 1],
			},
			{ path: 'M 10 70 L 90 10', color: '#CC3300', pressures: [0.4, 0.8] },
		]);
	});

	it('preserves unknown InkML and updates styles, pressures and fallback on dirty save', async () => {
		const authored = await authorInkContentPart();
		const authoredZip = await JSZip.loadAsync(authored);
		const inkPath = Object.keys(authoredZip.files).find((path) =>
			/^ppt\/ink\/ink\d+\.xml$/u.test(path),
		)!;
		const inkXml = await authoredZip.file(inkPath)!.async('string');
		authoredZip.file(
			inkPath,
			inkXml.replace(
				'</ink:ink>',
				'<ink:annotation type="urn:vendor">keep-me</ink:annotation></ink:ink>',
			),
		);
		const withUnknown = await authoredZip.generateAsync({ type: 'uint8array' });
		const handler = new PptxHandler();
		const data = await handler.load(withUnknown.buffer as ArrayBuffer);
		const content = data.slides[0].elements.find(
			(element): element is ContentPartPptxElement => element.type === 'contentPart',
		)!;
		content.x = 220;
		content.inkStrokes![0].color = '#00AA44';
		content.inkStrokes![0].width = 7;
		content.inkStrokes![0].pressures = [1, 0.5, 0.1];
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const savedInk = await zip.file(inkPath)!.async('string');
		const savedSlide = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(savedInk).toContain('type="urn:vendor"');
		expect(savedInk).toContain('keep-me');
		expect(savedInk).toContain('value="#00AA44"');
		expect(savedInk).toContain('value="7"');
		expect(savedInk).toContain('0 0 1, 50 25 0.5, 100 60 0.1');
		expect(savedSlide.match(/x="2095500"/gu)).toHaveLength(2);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const roundTripped = reloaded.slides[0].elements.find(
			(element): element is ContentPartPptxElement => element.type === 'contentPart',
		)!;
		expect(roundTripped.x).toBe(220);
		expect(roundTripped.inkStrokes?.[0]).toMatchObject({
			color: '#00AA44',
			width: 7,
			pressures: [1, 0.5, 0.1],
		});
	});
});
