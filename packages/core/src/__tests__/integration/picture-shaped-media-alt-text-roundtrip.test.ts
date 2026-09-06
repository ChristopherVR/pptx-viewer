import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { MediaPptxElement, PptxElement } from '../../core/types/elements';

/**
 * Real PowerPoint authors a video/audio placeholder as an ordinary `p:pic`
 * (`p:nvPicPr/p:cNvPr` with `@descr`/`@title`, and `a:videoFile`/`a:audioFile`
 * under `p:nvPr`), not as the `p:graphicFrame`-shaped media form this SDK
 * writes for a freshly-inserted clip (see
 * `graphic-frame-alt-text-roundtrip.test.ts`). `PptxHandlerRuntimePictureParsing.ts`
 * read the picture's own `p:cNvPr/@descr`/`@title` for the plain-picture
 * branch but never for the media branch, so accessibility text authored on a
 * `p:pic`-shaped video/audio element was silently dropped on load even
 * though the generic save writer (`applyGraphicFrameAltTextToCnvPr`) already
 * re-emits `altText`/`title` for a media element via `p:nvPicPr/p:cNvPr`.
 */
describe('p:pic-shaped media altText/title round-trip', () => {
	async function deckWithSlideXml(slideBody: string): Promise<Uint8Array> {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(createSlide('Blank').build());
		const baseBytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(baseBytes);
		zip.file(
			'ppt/slides/slide1.xml',
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
	xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
	<p:cSld>
		<p:spTree>
			<p:nvGrpSpPr>
				<p:cNvPr id="1" name=""/>
				<p:cNvGrpSpPr/>
				<p:nvPr/>
			</p:nvGrpSpPr>
			<p:grpSpPr>
				<a:xfrm>
					<a:off x="0" y="0"/><a:ext cx="0" cy="0"/>
					<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/>
				</a:xfrm>
			</p:grpSpPr>
			${slideBody}
		</p:spTree>
	</p:cSld>
</p:sld>`,
		);
		zip.file(
			'ppt/slides/_rels/slide1.xml.rels',
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`,
		);
		return zip.generateAsync({ type: 'uint8array' });
	}

	async function slideXmlOf(bytes: Uint8Array): Promise<string> {
		const zip = await JSZip.loadAsync(bytes);
		return zip.file('ppt/slides/slide1.xml')!.async('string');
	}

	// A `p:pic`-shaped video placeholder: `a:videoFile` lives under
	// `p:nvPicPr/p:nvPr`, exactly the shape `p14-media-nvpr-extension.test.ts`
	// documents as real PowerPoint's own authoring form. The `r:link` target
	// need not resolve for altText/title parsing; only `mediaReference` being
	// found (which only requires the `a:videoFile` node) matters here.
	const PIC_VIDEO = `
		<p:pic>
			<p:nvPicPr>
				<p:cNvPr id="6" name="Product Video" descr="A walkthrough of the product" title="Product Walkthrough"/>
				<p:cNvPicPr/>
				<p:nvPr>
					<a:videoFile r:link="rId2"/>
				</p:nvPr>
			</p:nvPicPr>
			<p:blipFill>
				<a:blip r:embed="rId3"/>
				<a:stretch><a:fillRect/></a:stretch>
			</p:blipFill>
			<p:spPr>
				<a:xfrm><a:off x="914400" y="914400"/><a:ext cx="2743200" cy="1828800"/></a:xfrm>
				<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
			</p:spPr>
		</p:pic>`;

	function findMedia(elements: readonly PptxElement[]): MediaPptxElement | undefined {
		return elements.find((el): el is MediaPptxElement => el.type === 'media');
	}

	it('parses altText and title from a p:pic-shaped video element', async () => {
		const bytes = await deckWithSlideXml(PIC_VIDEO);
		const loaded = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		const media = findMedia(loaded.slides[0].elements);
		expect(media).toBeDefined();
		expect(media?.mediaType).toBe('video');
		expect(media?.altText).toBe('A walkthrough of the product');
		expect(media?.title).toBe('Product Walkthrough');
	});

	it('round-trips altText/title on a p:pic-shaped media element through save -> reload', async () => {
		const bytes = await deckWithSlideXml(PIC_VIDEO);
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const media = findMedia(loaded.slides[0].elements);
		if (!media) {
			throw new Error('media not found');
		}
		// Untouched save: the parsed values must still be there afterwards.
		const saved = await handler.save(loaded.slides);
		const xml = await slideXmlOf(saved);
		expect(xml).toContain('descr="A walkthrough of the product"');
		expect(xml).toContain('title="Product Walkthrough"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedMedia = findMedia(reloaded.slides[0].elements);
		expect(reloadedMedia?.altText).toBe('A walkthrough of the product');
		expect(reloadedMedia?.title).toBe('Product Walkthrough');
	});

	it('round-trips an edit to altText/title on a p:pic-shaped media element', async () => {
		const bytes = await deckWithSlideXml(PIC_VIDEO);
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const media = findMedia(loaded.slides[0].elements);
		if (!media) {
			throw new Error('media not found');
		}
		media.altText = 'Updated walkthrough description';
		media.title = 'Updated title';

		const saved = await handler.save(loaded.slides);
		const xml = await slideXmlOf(saved);
		expect(xml).toContain('descr="Updated walkthrough description"');
		expect(xml).toContain('title="Updated title"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedMedia = findMedia(reloaded.slides[0].elements);
		expect(reloadedMedia?.altText).toBe('Updated walkthrough description');
		expect(reloadedMedia?.title).toBe('Updated title');
	});
});
