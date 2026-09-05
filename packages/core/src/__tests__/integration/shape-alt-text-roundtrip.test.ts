import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement } from '../../core/types/elements';

/**
 * `p:cNvPr/@descr` (alt text) and `@title` on a plain shape / text box
 * (`p:sp`, via `p:nvSpPr/p:cNvPr`) and a connector (`p:cxnSp`, via
 * `p:nvCxnSpPr/p:cNvPr`) were neither parsed nor re-serialised, so
 * accessibility text PowerPoint's Accessibility pane writes for one of
 * these was silently dropped on load. A graphic frame (table/chart/
 * smartArt/ole/media) and a picture's `descr` already round-tripped; see
 * `graphic-frame-alt-text-roundtrip.test.ts`.
 */
describe('shape/connector altText/title round-trip', () => {
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

	const SHAPE = `
		<p:sp>
			<p:nvSpPr>
				<p:cNvPr id="4" name="Rounded Rectangle" descr="A rounded rectangle callout" title="Callout"/>
				<p:cNvSpPr/>
				<p:nvPr/>
			</p:nvSpPr>
			<p:spPr>
				<a:xfrm><a:off x="914400" y="914400"/><a:ext cx="1828800" cy="914400"/></a:xfrm>
				<a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
				<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>
			</p:spPr>
			<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
		</p:sp>`;

	const TEXTBOX = `
		<p:sp>
			<p:nvSpPr>
				<p:cNvPr id="5" name="TextBox 1" descr="A caption for the diagram"/>
				<p:cNvSpPr txBox="1"/>
				<p:nvPr/>
			</p:nvSpPr>
			<p:spPr>
				<a:xfrm><a:off x="3657600" y="914400"/><a:ext cx="1828800" cy="457200"/></a:xfrm>
				<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
			</p:spPr>
			<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Hello</a:t></a:r></a:p></p:txBody>
		</p:sp>`;

	const CONNECTOR = `
		<p:cxnSp>
			<p:nvCxnSpPr>
				<p:cNvPr id="6" name="Straight Connector 1" descr="An arrow from A to B" title="Flow arrow"/>
				<p:cNvCxnSpPr/>
				<p:nvPr/>
			</p:nvCxnSpPr>
			<p:spPr>
				<a:xfrm><a:off x="914400" y="2743200"/><a:ext cx="1828800" cy="0"/></a:xfrm>
				<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom>
				<a:ln><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln>
			</p:spPr>
		</p:cxnSp>`;

	function findByType(elements: readonly PptxElement[], type: PptxElement['type']) {
		return elements.find((el) => el.type === type);
	}

	it('parses altText and title from a shape', async () => {
		const bytes = await deckWithSlideXml(SHAPE);
		const loaded = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		const shape = findByType(loaded.slides[0].elements, 'shape');
		expect(shape?.type === 'shape' && shape.altText).toBe('A rounded rectangle callout');
		expect(shape?.type === 'shape' && shape.title).toBe('Callout');
	});

	it('parses altText (no title authored) from a text box', async () => {
		const bytes = await deckWithSlideXml(TEXTBOX);
		const loaded = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		const text = findByType(loaded.slides[0].elements, 'text');
		expect(text?.type === 'text' && text.altText).toBe('A caption for the diagram');
		expect(text?.type === 'text' && text.title).toBeUndefined();
	});

	it('parses altText and title from a connector', async () => {
		const bytes = await deckWithSlideXml(CONNECTOR);
		const loaded = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		const connector = findByType(loaded.slides[0].elements, 'connector');
		expect(connector?.type === 'connector' && connector.altText).toBe('An arrow from A to B');
		expect(connector?.type === 'connector' && connector.title).toBe('Flow arrow');
	});

	it('round-trips an edit to altText/title on a shape through save -> reload', async () => {
		const bytes = await deckWithSlideXml(SHAPE);
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const shape = findByType(loaded.slides[0].elements, 'shape');
		if (shape?.type !== 'shape') {
			throw new Error('shape not found');
		}
		shape.altText = 'Updated description';
		shape.title = 'Updated title';

		const saved = await handler.save(loaded.slides);
		const xml = await slideXmlOf(saved);
		expect(xml).toContain('descr="Updated description"');
		expect(xml).toContain('title="Updated title"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedShape = findByType(reloaded.slides[0].elements, 'shape');
		expect(reloadedShape?.type === 'shape' && reloadedShape.altText).toBe('Updated description');
		expect(reloadedShape?.type === 'shape' && reloadedShape.title).toBe('Updated title');
	});

	it('round-trips an edit to altText on a connector through save -> reload', async () => {
		const bytes = await deckWithSlideXml(CONNECTOR);
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const connector = findByType(loaded.slides[0].elements, 'connector');
		if (connector?.type !== 'connector') {
			throw new Error('connector not found');
		}
		connector.altText = 'Updated arrow description';

		const saved = await handler.save(loaded.slides);
		const xml = await slideXmlOf(saved);
		expect(xml).toContain('descr="Updated arrow description"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedConnector = findByType(reloaded.slides[0].elements, 'connector');
		expect(reloadedConnector?.type === 'connector' && reloadedConnector.altText).toBe(
			'Updated arrow description',
		);
	});

	it('clears altText when set to an empty string', async () => {
		const bytes = await deckWithSlideXml(SHAPE);
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const shape = findByType(loaded.slides[0].elements, 'shape');
		if (shape?.type !== 'shape') {
			throw new Error('shape not found');
		}
		shape.altText = '';

		const saved = await handler.save(loaded.slides);
		const xml = await slideXmlOf(saved);
		expect(xml).not.toContain('descr=');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedShape = findByType(reloaded.slides[0].elements, 'shape');
		expect(reloadedShape?.type === 'shape' && reloadedShape.altText).toBeUndefined();
	});

	it('leaves altText/title untouched when the model has no opinion (undefined)', async () => {
		const bytes = await deckWithSlideXml(SHAPE);
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const shape = findByType(loaded.slides[0].elements, 'shape');
		if (shape?.type !== 'shape') {
			throw new Error('shape not found');
		}
		// Touch an unrelated field only; altText/title stay whatever the parser
		// populated them with (real values here), never explicitly reassigned.
		shape.hidden = false;

		const saved = await handler.save(loaded.slides);
		const xml = await slideXmlOf(saved);
		expect(xml).toContain('descr="A rounded rectangle callout"');
		expect(xml).toContain('title="Callout"');
	});
});
