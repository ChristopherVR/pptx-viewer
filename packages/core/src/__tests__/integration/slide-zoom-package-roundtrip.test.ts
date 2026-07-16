import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ZoomPptxElement } from '../../core/types';

const PNG_DATA =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function buildSlideZoomPackage(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	data.slides.push(createSlide('Blank').build());
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');
	const numericIds = [...presentationXml.matchAll(/<p:sldId id="(?<id>\d+)"/gu)].map(
		(match) => match.groups!.id,
	);
	const slidePath = 'ppt/slides/slide1.xml';
	const slideXml = await zip.file(slidePath)!.async('string');
	const zoomXml = `
		<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
			<mc:Choice Requires="pslz" xmlns:pslz="http://schemas.microsoft.com/office/powerpoint/2016/slidezoom" xmlns:p166="http://schemas.microsoft.com/office/powerpoint/2016/6/main">
				<pslz:sldZm>
					<pslz:sldZmObj sldId="${numericIds[2]}" cId="41">
						<pslz:zmPr id="{11111111-2222-3333-4444-555555555555}" imageType="preview" returnToParent="0">
							<p166:blipFill><a:blip r:embed="rIdZoomPreview"/><a:stretch><a:fillRect/></a:stretch></p166:blipFill>
							<p166:spPr><a:xfrm><a:off x="952500" y="476250"/><a:ext cx="1905000" cy="952500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p166:spPr>
						</pslz:zmPr>
						<pslz:extLst><p:ext uri="urn:zoom:preserve"><p:vendorData val="keep"/></p:ext></pslz:extLst>
					</pslz:sldZmObj>
				</pslz:sldZm>
			</mc:Choice>
			<mc:Fallback>
				<p:pic><p:nvPicPr><p:cNvPr id="2" name="Slide Zoom"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rIdZoomPreview"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="952500" y="476250"/><a:ext cx="1905000" cy="952500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>
			</mc:Fallback>
		</mc:AlternateContent>`;
	zip.file(slidePath, slideXml.replace('</p:spTree>', `${zoomXml}</p:spTree>`));

	const relsPath = 'ppt/slides/_rels/slide1.xml.rels';
	const relsXml = await zip.file(relsPath)!.async('string');
	zip.file(
		relsPath,
		relsXml.replace(
			'</Relationships>',
			'<Relationship Id="rIdZoomPreview" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/zoom-preview.png"/></Relationships>',
		),
	);
	zip.file('ppt/media/zoom-preview.png', Buffer.from(PNG_DATA.split(',')[1], 'base64'));
	const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
	if (!/Extension="png"/u.test(contentTypes)) {
		zip.file(
			'[Content_Types].xml',
			contentTypes.replace(
				'</Types>',
				'<Default Extension="png" ContentType="image/png"/></Types>',
			),
		);
	}
	return (await zip.generateAsync({ type: 'uint8array' })).buffer as ArrayBuffer;
}

describe('slide zoom package integration', () => {
	it('loads actual Zoom AlternateContent and preserves unknown XML on dirty save', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildSlideZoomPackage(), { eagerDecodeImages: true });
		const zoom = data.slides[0].elements.find(
			(element): element is ZoomPptxElement => element.type === 'zoom',
		);

		expect(zoom).toMatchObject({
			zoomType: 'slide',
			targetSlideIndex: 2,
			x: 100,
			y: 50,
			width: 200,
			height: 100,
			imagePath: 'ppt/media/zoom-preview.png',
		});
		expect(zoom?.imageData).toMatch(/^(?:data:image\/png;base64,|blob:)/u);

		zoom!.x = 160;
		zoom!.width = 240;
		zoom!.targetSlideIndex = 1;
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');
		const targetId = [...presentationXml.matchAll(/<p:sldId id="(?<id>\d+)"/gu)][1].groups!.id;

		expect(slideXml).toContain('<mc:AlternateContent');
		expect(slideXml).toContain('<pslz:sldZm>');
		expect(slideXml).toContain('<mc:Fallback>');
		expect(slideXml).toContain(`sldId="${targetId}"`);
		expect(slideXml).toContain('x="1524000"');
		expect(slideXml).toContain('cx="2286000"');
		expect(slideXml).toContain('uri="urn:zoom:preserve"');
		expect(slideXml).toContain('val="keep"');
		expect(slideXml).toContain('r:embed="rIdZoomPreview"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer, {
			eagerDecodeImages: true,
		});
		expect(reloaded.slides[0].elements.find((element) => element.type === 'zoom')).toMatchObject({
			type: 'zoom',
			targetSlideIndex: 1,
			x: 160,
			width: 240,
			imagePath: 'ppt/media/zoom-preview.png',
		});
	});

	it('serializes a new typed slide Zoom with preview relationship and content type', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(createSlide('Blank').build());
		data.slides.push(createSlide('Blank').build());
		data.slides[0].elements.push({
			id: 'authored-slide-zoom',
			type: 'zoom',
			zoomType: 'slide',
			targetSlideIndex: 1,
			x: 80,
			y: 90,
			width: 320,
			height: 180,
			imageData: PNG_DATA,
			altText: 'Preview of slide 2',
		} satisfies ZoomPptxElement);

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		const slideRels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		const contentTypes = await zip.file('[Content_Types].xml')!.async('string');

		expect(slideXml).toContain('Requires="pslz"');
		expect(slideXml).toContain('<pslz:sldZm>');
		expect(slideXml).toContain(
			'<p:cNvPr id="2" name="authored-slide-zoom" descr="Preview of slide 2"',
		);
		expect(slideRels).toContain('/relationships/image');
		expect(slideRels).toMatch(/Target="\.\.\/media\/image\d+\.png"/u);
		expect(contentTypes).toContain('Extension="png" ContentType="image/png"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer, {
			eagerDecodeImages: true,
		});
		expect(reloaded.slides[0].elements.find((element) => element.type === 'zoom')).toMatchObject({
			type: 'zoom',
			targetSlideIndex: 1,
			x: 80,
			y: 90,
			width: 320,
			height: 180,
		});
	});
});
