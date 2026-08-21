import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PicturePptxElement, PptxSlide } from '../../core/types';

/**
 * `a:custGeom` on a `p:pic` (a custom-cropped/masked picture) only had its
 * `pathData`/`pathWidth`/`pathHeight` extracted on load; shapes with the same
 * markup also got the structured `customGeometryPaths`, adjust handles,
 * connection sites and text rect that the save writer needs to re-emit
 * `a:custGeom` faithfully (`applyGeometryUpdate` in
 * `PptxHandlerRuntimeSaveElementEmbedding.ts` reads those same fields off
 * `PicturePptxElement`). Editing an unrelated property of a custom-shaped
 * picture silently dropped its adjust handles, connection sites, and text
 * rect on save because they were never parsed in the first place.
 */

const TINY_PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function pictureFrom(slide: PptxSlide): PicturePptxElement {
	const picture = slide.elements.find((element) => element.type === 'picture');
	if (!picture || picture.type !== 'picture') {
		throw new Error('Expected a picture element');
	}
	return picture as PicturePptxElement;
}

const CUSTOM_GEOMETRY = [
	'<a:custGeom>',
	'<a:avLst/><a:gdLst/>',
	'<a:ahLst><a:ahXY gdRefX="adj1"><a:pos x="10000" y="20000"/></a:ahXY></a:ahLst>',
	'<a:cxnLst><a:cxn ang="5400000"><a:pos x="50000" y="0"/></a:cxn></a:cxnLst>',
	'<a:rect l="l" t="t" r="r" b="b"/>',
	'<a:pathLst><a:path w="100" h="100">',
	'<a:moveTo><a:pt x="0" y="0"/></a:moveTo>',
	'<a:lnTo><a:pt x="100" y="0"/></a:lnTo>',
	'<a:lnTo><a:pt x="50" y="100"/></a:lnTo>',
	'<a:close/>',
	'</a:path></a:pathLst>',
	'</a:custGeom>',
].join('');

async function buildPictureDeckWithCustomGeometry(): Promise<Uint8Array> {
	const created = await PresentationBuilder.create();
	const slide = created
		.createSlide('Blank')
		.addImage(TINY_PNG, { x: 80, y: 60, width: 240, height: 180 })
		.build();
	const saved = await created.handler.save([slide]);

	const zip = await JSZip.loadAsync(saved);
	const originalXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
	const injectedXml = originalXml.replace(
		/<a:prstGeom\b[^>]*>(?:[\s\S]*?)<\/a:prstGeom>|<a:prstGeom\b[^>]*\/>/u,
		CUSTOM_GEOMETRY,
	);
	expect(injectedXml).not.toBe(originalXml);
	zip.file('ppt/slides/slide1.xml', injectedXml);
	return zip.generateAsync({ type: 'uint8array' });
}

describe('picture custom geometry parity with shapes', () => {
	it('parses adjust handles, connection sites, and text rect off a:custGeom on a p:pic', async () => {
		const source = await buildPictureDeckWithCustomGeometry();
		const handler = new PptxHandler();
		const data = await handler.load(asArrayBuffer(source));
		const picture = pictureFrom(data.slides[0]);

		expect(picture.shapeType).toBe('custom');
		expect(picture.customGeometryPaths?.[0]?.segments).toHaveLength(4);
		expect(picture.customGeometryAdjustHandlesXY).toStrictEqual([
			expect.objectContaining({ gdRefX: 'adj1', posX: '10000', posY: '20000' }),
		]);
		expect(picture.customGeometryConnectionSites).toStrictEqual([
			expect.objectContaining({ ang: '5400000', posX: '50000', posY: '0' }),
		]);
		expect(picture.customGeometryTextRect).toStrictEqual({ l: 'l', t: 't', r: 'r', b: 'b' });
	});

	it('re-emits the custom geometry (handles, connection sites, text rect) on save', async () => {
		const source = await buildPictureDeckWithCustomGeometry();
		const handler = new PptxHandler();
		const data = await handler.load(asArrayBuffer(source));
		// Any unrelated model-level edit forces a rebuild from the parsed
		// fields instead of a raw-XML passthrough.
		data.slides[0].isDirty = true;
		pictureFrom(data.slides[0]).altText = 'edited';

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');

		expect(xml).toContain('<a:custGeom>');
		expect(xml).toContain('a:ahXY');
		expect(xml).toContain('a:cxnLst');
		expect(xml).toMatch(/<a:rect\b[^>]*\bl="l"/u);
	});
});
