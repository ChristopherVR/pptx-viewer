import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSection, ZoomPptxElement } from '../../core/types';

const INTRO_SECTION = '{11111111-1111-1111-1111-111111111111}';
const DETAILS_SECTION = '{22222222-2222-2222-2222-222222222222}';
const PNG_DATA =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function numericSlideIds(xml: string): string[] {
	return [...xml.matchAll(/<p:sldId id="(?<id>\d+)"/gu)].map((match) => match.groups!.id);
}

function buildSections(ids: string[]): PptxSection[] {
	return [
		{ id: INTRO_SECTION, name: 'Introduction', slideIds: ids.slice(0, 2) },
		{ id: DETAILS_SECTION, name: 'Details', slideIds: ids.slice(2) },
	];
}

async function createThreeSlideDeck(): Promise<{
	handler: PptxHandler;
	slides: Awaited<ReturnType<typeof PresentationBuilder.create>>['data']['slides'];
	sections: PptxSection[];
}> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	data.slides.push(createSlide('Blank').build());
	data.slides.push(createSlide('Blank').build());
	const seed = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(seed);
	const ids = numericSlideIds(await zip.file('ppt/presentation.xml')!.async('string'));
	return { handler, slides: data.slides, sections: buildSections(ids) };
}

function summaryObject(
	sectionId: string,
	relationshipId: string,
	x: number,
	title: string,
): string {
	return `<psuz:summaryZmObj sectionId="${sectionId}" title="${title}" offsetFactorX="0.2">
		<psuz:zmPr id="{33333333-3333-3333-3333-333333333333}" imageType="preview">
			<p166:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></p166:blipFill>
			<p166:spPr><a:xfrm><a:off x="${x}" y="571500"/><a:ext cx="1905000" cy="952500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p166:spPr>
		</psuz:zmPr>
		<psuz:extLst><p:ext uri="urn:summary-zoom:preserve"><p:vendorData val="keep"/></p:ext></psuz:extLst>
	</psuz:summaryZmObj>`;
}

function fallbackPicture(relationshipId: string, x: number, id: number): string {
	return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Summary tile ${id}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
		<p:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
		<p:spPr><a:xfrm><a:off x="${x}" y="571500"/><a:ext cx="1905000" cy="952500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

async function buildSummaryZoomPackage(): Promise<ArrayBuffer> {
	const { handler, slides, sections } = await createThreeSlideDeck();
	const saved = await handler.save(slides, { sections });
	const zip = await JSZip.loadAsync(saved);
	const slidePath = 'ppt/slides/slide1.xml';
	const slideXml = await zip.file(slidePath)!.async('string');
	const zoomXml = `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
		<mc:Choice Requires="psuz" xmlns:psuz="http://schemas.microsoft.com/office/powerpoint/2016/summaryzoom" xmlns:p166="http://schemas.microsoft.com/office/powerpoint/2016/6/main">
			<psuz:summaryZm>
				${summaryObject(INTRO_SECTION, 'rIdSummary1', 952500, 'Introduction')}
				${summaryObject(DETAILS_SECTION, 'rIdSummary2', 3333750, 'Details')}
				<psuz:fixedLayout/>
			</psuz:summaryZm>
		</mc:Choice>
		<mc:Fallback><p:grpSp>
			<p:nvGrpSpPr><p:cNvPr id="2" name="Summary Zoom"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
			<p:grpSpPr><a:xfrm><a:off x="952500" y="571500"/><a:ext cx="4286250" cy="952500"/><a:chOff x="952500" y="571500"/><a:chExt cx="4286250" cy="952500"/></a:xfrm></p:grpSpPr>
			${fallbackPicture('rIdSummary1', 952500, 3)}
			${fallbackPicture('rIdSummary2', 3333750, 4)}
		</p:grpSp></mc:Fallback>
	</mc:AlternateContent>`;
	zip.file(slidePath, slideXml.replace('</p:spTree>', `${zoomXml}</p:spTree>`));
	const relsPath = 'ppt/slides/_rels/slide1.xml.rels';
	const relsXml = await zip.file(relsPath)!.async('string');
	zip.file(
		relsPath,
		relsXml.replace(
			'</Relationships>',
			'<Relationship Id="rIdSummary1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/summary-1.png"/><Relationship Id="rIdSummary2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/summary-2.png"/></Relationships>',
		),
	);
	const bytes = Buffer.from(PNG_DATA.split(',')[1], 'base64');
	zip.file('ppt/media/summary-1.png', bytes);
	zip.file('ppt/media/summary-2.png', bytes);
	const types = await zip.file('[Content_Types].xml')!.async('string');
	if (!/Extension="png"/u.test(types)) {
		zip.file(
			'[Content_Types].xml',
			types.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>'),
		);
	}
	return (await zip.generateAsync({ type: 'uint8array' })).buffer as ArrayBuffer;
}

describe('summary zoom package integration', () => {
	it('loads every section tile and preserves unknown markup on dirty save', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildSummaryZoomPackage(), { eagerDecodeImages: true });
		const zoom = data.slides[0].elements.find(
			(element): element is ZoomPptxElement => element.type === 'zoom',
		);
		expect(zoom).toMatchObject({
			zoomType: 'summary',
			summaryLayout: 'fixed',
			targetSlideIndex: 0,
			x: 100,
			y: 60,
			width: 450,
			height: 100,
		});
		expect(zoom?.summaryTargets).toMatchObject([
			{ sectionId: INTRO_SECTION, targetSlideIndex: 0, title: 'Introduction', x: 100 },
			{ sectionId: DETAILS_SECTION, targetSlideIndex: 2, title: 'Details', x: 350 },
		]);

		zoom!.summaryTargets![1].x = 400;
		zoom!.summaryTargets![1].title = 'Deep details';
		const saved = await handler.save(data.slides, { sections: data.sections });
		const zip = await JSZip.loadAsync(saved);
		const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(xml).toContain('Requires="psuz"');
		expect(xml).toContain('<psuz:fixedLayout');
		expect(xml).toContain('title="Deep details"');
		expect(xml).toContain('x="3810000"');
		expect(xml).toContain('uri="urn:summary-zoom:preserve"');
		expect(xml).toContain('<mc:Fallback><p:grpSp>');
		expect(xml.match(/x="3810000"/gu)).toHaveLength(2);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer, {
			eagerDecodeImages: true,
		});
		const reloadedZoom = reloaded.slides[0].elements.find((element) => element.type === 'zoom');
		expect(reloadedZoom).toMatchObject({ zoomType: 'summary', summaryLayout: 'fixed' });
		expect((reloadedZoom as ZoomPptxElement).summaryTargets?.[1]).toMatchObject({
			title: 'Deep details',
			x: 400,
			targetSlideIndex: 2,
		});
	});

	it('authors a typed Summary Zoom with two preview relationships and grouped fallback', async () => {
		const { handler, slides, sections } = await createThreeSlideDeck();
		slides[0].elements.push({
			id: 'authored-summary-zoom',
			type: 'zoom',
			zoomType: 'summary',
			targetSlideIndex: 0,
			x: 80,
			y: 90,
			width: 440,
			height: 120,
			summaryLayout: 'grid',
			summaryTargets: [
				{
					sectionId: INTRO_SECTION,
					targetSlideIndex: 0,
					x: 80,
					y: 90,
					width: 200,
					height: 120,
					title: 'Intro',
					imageData: PNG_DATA,
				},
				{
					sectionId: DETAILS_SECTION,
					targetSlideIndex: 2,
					x: 320,
					y: 90,
					width: 200,
					height: 120,
					title: 'Details',
					imageData: PNG_DATA,
				},
			],
		} satisfies ZoomPptxElement);

		const saved = await handler.save(slides, { sections });
		const zip = await JSZip.loadAsync(saved);
		const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		expect(xml).toContain(
			'xmlns:psuz="http://schemas.microsoft.com/office/powerpoint/2016/summaryzoom"',
		);
		expect(xml.match(/<psuz:summaryZmObj /gu)).toHaveLength(2);
		expect(xml).toContain('<psuz:gridLayout');
		expect(xml).toContain('<mc:Fallback><p:grpSp>');
		expect(xml.match(/<p:pic>/gu)).toHaveLength(2);
		expect(rels.match(/relationships\/image/gu)).toHaveLength(2);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer, {
			eagerDecodeImages: true,
		});
		const zoom = reloaded.slides[0].elements.find((element) => element.type === 'zoom');
		expect(zoom).toMatchObject({ zoomType: 'summary', summaryLayout: 'grid' });
		expect((zoom as ZoomPptxElement).summaryTargets).toHaveLength(2);
	});
});
