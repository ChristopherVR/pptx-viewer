import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSection, ZoomPptxElement } from '../../core/types';

const INTRO_SECTION = '{11111111-1111-1111-1111-111111111111}';
const DETAILS_SECTION = '{22222222-2222-2222-2222-222222222222}';
const PNG_DATA =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function numericSlideIds(presentationXml: string): string[] {
	return [...presentationXml.matchAll(/<p:sldId id="(?<id>\d+)"/gu)].map(
		(match) => match.groups!.id,
	);
}

function buildSections(ids: string[]): PptxSection[] {
	return [
		{ id: INTRO_SECTION, name: 'Introduction', slideIds: ids.slice(0, 2) },
		{ id: DETAILS_SECTION, name: 'Details', slideIds: ids.slice(2) },
	];
}

async function buildSectionZoomPackage(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	data.slides.push(createSlide('Blank').build());
	data.slides.push(createSlide('Blank').build());
	const firstSave = await handler.save(data.slides);
	const firstZip = await JSZip.loadAsync(firstSave);
	const ids = numericSlideIds(await firstZip.file('ppt/presentation.xml')!.async('string'));
	const withSections = await handler.save(data.slides, { sections: buildSections(ids) });
	const zip = await JSZip.loadAsync(withSections);
	const slidePath = 'ppt/slides/slide1.xml';
	const slideXml = await zip.file(slidePath)!.async('string');
	const zoomXml = `
		<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
			<mc:Choice Requires="psezm" xmlns:psezm="http://schemas.microsoft.com/office/powerpoint/2016/sectionzoom" xmlns:p166="http://schemas.microsoft.com/office/powerpoint/2016/6/main">
				<psezm:sectionZm>
					<psezm:sectionZmObj sectionId="${DETAILS_SECTION}">
						<psezm:zmPr id="{33333333-3333-3333-3333-333333333333}" imageType="preview" showBg="0">
							<p166:blipFill><a:blip r:embed="rIdSectionPreview"/><a:stretch><a:fillRect/></a:stretch></p166:blipFill>
							<p166:spPr><a:xfrm><a:off x="1143000" y="571500"/><a:ext cx="2095500" cy="1143000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p166:spPr>
						</psezm:zmPr>
						<psezm:extLst><p:ext uri="urn:section-zoom:preserve"><p:vendorData val="keep"/></p:ext></psezm:extLst>
					</psezm:sectionZmObj>
				</psezm:sectionZm>
			</mc:Choice>
			<mc:Fallback>
				<p:pic><p:nvPicPr><p:cNvPr id="2" name="Section Zoom"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rIdSectionPreview"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="1143000" y="571500"/><a:ext cx="2095500" cy="1143000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>
			</mc:Fallback>
		</mc:AlternateContent>`;
	zip.file(slidePath, slideXml.replace('</p:spTree>', `${zoomXml}</p:spTree>`));
	const relsPath = 'ppt/slides/_rels/slide1.xml.rels';
	const relsXml = await zip.file(relsPath)!.async('string');
	zip.file(
		relsPath,
		relsXml.replace(
			'</Relationships>',
			'<Relationship Id="rIdSectionPreview" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/section-preview.png"/></Relationships>',
		),
	);
	zip.file('ppt/media/section-preview.png', Buffer.from(PNG_DATA.split(',')[1], 'base64'));
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

describe('section zoom package integration', () => {
	it('loads section identity and preserves the envelope on dirty save', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildSectionZoomPackage(), { eagerDecodeImages: true });
		const zoom = data.slides[0].elements.find(
			(element): element is ZoomPptxElement => element.type === 'zoom',
		);

		expect(zoom).toMatchObject({
			zoomType: 'section',
			targetSectionId: DETAILS_SECTION,
			targetSlideIndex: 2,
			x: 120,
			y: 60,
			width: 220,
			height: 120,
			imagePath: 'ppt/media/section-preview.png',
		});

		zoom!.targetSectionId = INTRO_SECTION;
		zoom!.targetSlideIndex = 0;
		zoom!.x = 180;
		const saved = await handler.save(data.slides, { sections: data.sections });
		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toContain('<psezm:sectionZm>');
		expect(slideXml).toContain('<mc:Fallback>');
		expect(slideXml).toContain(`sectionId="${INTRO_SECTION}"`);
		expect(slideXml).toContain('x="1714500"');
		expect(slideXml).toContain('uri="urn:section-zoom:preserve"');
		expect(slideXml).toContain('val="keep"');
		expect(slideXml).toContain('r:embed="rIdSectionPreview"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer, {
			eagerDecodeImages: true,
		});
		expect(reloaded.slides[0].elements.find((element) => element.type === 'zoom')).toMatchObject({
			type: 'zoom',
			zoomType: 'section',
			targetSectionId: INTRO_SECTION,
			targetSlideIndex: 0,
			x: 180,
			imagePath: 'ppt/media/section-preview.png',
		});
	});

	it('authors a typed section Zoom with preview relationship and reload semantics', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(createSlide('Blank').build());
		data.slides.push(createSlide('Blank').build());
		data.slides.push(createSlide('Blank').build());
		const firstSave = await handler.save(data.slides);
		const firstZip = await JSZip.loadAsync(firstSave);
		const ids = numericSlideIds(await firstZip.file('ppt/presentation.xml')!.async('string'));
		const sections = buildSections(ids);
		data.slides[0].elements.push({
			id: 'authored-section-zoom',
			type: 'zoom',
			zoomType: 'section',
			targetSectionId: DETAILS_SECTION,
			targetSlideIndex: 2,
			x: 90,
			y: 100,
			width: 300,
			height: 170,
			imageData: PNG_DATA,
			altText: 'Details section preview',
		} satisfies ZoomPptxElement);

		const saved = await handler.save(data.slides, { sections });
		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		const slideRels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
		expect(slideXml).toContain('Requires="psezm"');
		expect(slideXml).toContain('<psezm:sectionZm>');
		expect(slideXml).toContain(`sectionId="${DETAILS_SECTION}"`);
		expect(slideXml).toContain('descr="Details section preview"');
		expect(slideRels).toContain('/relationships/image');
		expect(slideRels).toMatch(/Target="\.\.\/media\/image\d+\.png"/u);
		expect(contentTypes).toContain('Extension="png" ContentType="image/png"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer, {
			eagerDecodeImages: true,
		});
		expect(reloaded.slides[0].elements.find((element) => element.type === 'zoom')).toMatchObject({
			type: 'zoom',
			zoomType: 'section',
			targetSectionId: DETAILS_SECTION,
			targetSlideIndex: 2,
			x: 90,
			y: 100,
			width: 300,
			height: 170,
		});
	});
});
