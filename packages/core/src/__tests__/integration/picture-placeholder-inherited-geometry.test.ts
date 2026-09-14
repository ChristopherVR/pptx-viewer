import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

/**
 * A picture placeholder on a slide often carries only a transform and inherits
 * its clipping mask from the layout placeholder. The loader resolves that mask
 * into the element so the canvas paints it, but the save writer must not bake
 * it into the slide-owned `<p:pic>`: an explicit local `a:custGeom` turns a
 * layout-bound mask into a new freeform that PowerPoint paints on its own
 * terms, visibly distorting the picture.
 */

const SLIDE_PATH = 'ppt/slides/slide1.xml';
const SLIDE_RELS_PATH = 'ppt/slides/_rels/slide1.xml.rels';
const LAYOUT_PATH = 'ppt/slideLayouts/slideLayout7.xml';
const PICTURE_NAME = 'InheritedMaskPicture';

const ONE_PIXEL_PNG = Uint8Array.from(
	Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
		'base64',
	),
);

const HEXAGON_MASK =
	'<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/>' +
	'<a:pathLst><a:path w="100" h="100"><a:moveTo><a:pt x="0" y="25"/></a:moveTo>' +
	'<a:lnTo><a:pt x="50" y="0"/></a:lnTo><a:lnTo><a:pt x="100" y="25"/></a:lnTo>' +
	'<a:lnTo><a:pt x="100" y="75"/></a:lnTo><a:lnTo><a:pt x="50" y="100"/></a:lnTo>' +
	'<a:lnTo><a:pt x="0" y="75"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom>';

function picturePlaceholder(id: number, geometry: string): string {
	const blipFill = geometry
		? '<p:blipFill><a:stretch/></p:blipFill>'
		: '<p:blipFill><a:blip r:embed="rId99"/><a:stretch/></p:blipFill>';
	return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${PICTURE_NAME}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr><p:ph type="pic" idx="47"/></p:nvPr></p:nvPicPr>${blipFill}<p:spPr><a:xfrm><a:off x="6742557" y="821836"/><a:ext cx="4405503" cy="5066346"/></a:xfrm>${geometry}</p:spPr></p:pic>`;
}

async function buildDeck(slideGeometry: string): Promise<ArrayBuffer> {
	const { handler, data } = await PresentationBuilder.create({ initialSlideCount: 1 });
	const seed = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(seed);
	const slideXml = await zip.file(SLIDE_PATH)!.async('string');
	const layoutXml = await zip.file(LAYOUT_PATH)!.async('string');
	const relsXml = await zip.file(SLIDE_RELS_PATH)!.async('string');
	zip.file(
		SLIDE_PATH,
		slideXml.replace('</p:spTree>', `${picturePlaceholder(20, slideGeometry)}</p:spTree>`),
	);
	zip.file(
		LAYOUT_PATH,
		layoutXml.replace('</p:spTree>', `${picturePlaceholder(21, HEXAGON_MASK)}</p:spTree>`),
	);
	zip.file(
		SLIDE_RELS_PATH,
		relsXml.replace(
			'</Relationships>',
			'<Relationship Id="rId99" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image99.png"/></Relationships>',
		),
	);
	zip.file('ppt/media/image99.png', ONE_PIXEL_PNG);
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
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function savedPictureXml(source: ArrayBuffer): Promise<string> {
	const handler = new PptxHandler();
	const data = await handler.load(source);
	const picture = data.slides[0]?.elements.find(
		(element) => element.type === 'picture' && element.name === PICTURE_NAME,
	);
	expect(picture?.shapeType).toBe('custom');
	const saved = await handler.save([{ ...data.slides[0]!, isDirty: true }]);
	const zip = await JSZip.loadAsync(saved);
	const slideXml = await zip.file(SLIDE_PATH)!.async('string');
	const match = slideXml.match(
		/<p:pic\b[\s\S]*?<p:cNvPr[^>]*name="InheritedMaskPicture"[\s\S]*?<\/p:pic>/u,
	)?.[0];
	expect(match).toBeTruthy();
	return match!;
}

describe('picture placeholder inherited geometry', () => {
	it('keeps a layout-inherited mask off the slide-owned picture on save', async () => {
		const picXml = await savedPictureXml(await buildDeck(''));
		expect(picXml).not.toMatch(/<a:(?:custGeom|prstGeom)\b/u);
	});

	it('still writes geometry the picture authored itself', async () => {
		const picXml = await savedPictureXml(await buildDeck(HEXAGON_MASK));
		expect(picXml).toMatch(/<a:custGeom\b/u);
	});
});
