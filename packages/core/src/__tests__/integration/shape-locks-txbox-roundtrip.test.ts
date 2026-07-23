import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ShapePptxElement, TextPptxElement } from '../../core/types/elements';

/**
 * Issue #92 regression coverage.
 *
 * Before the fix:
 *   - `a:spLocks` were parsed into `element.locks` on load but a model-built /
 *     restructured shape (no `rawXml`) dropped them on save.
 *   - `@txBox` on `p:cNvSpPr` was only written for freshly-authored shapes and
 *     was never parsed back into the model, so a rebuilt shape lost its
 *     text-box classification.
 *
 * These tests exercise the real save + load pipeline (not extracted helpers)
 * for both directions.
 */
describe('shape locks + txBox round-trip (issue #92)', () => {
	async function loadSlideXml(bytes: Uint8Array): Promise<string> {
		const zip = await JSZip.loadAsync(bytes);
		return zip.file('ppt/slides/slide1.xml')!.async('string');
	}

	it('serializes a:spLocks from element.locks on a model-built shape', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const textEl: TextPptxElement = {
			id: 'locked-text',
			type: 'text',
			x: 10,
			y: 20,
			width: 300,
			height: 80,
			text: 'Locked box',
			locks: { noMove: true, noResize: true },
		};
		data.slides.push(createSlide('Blank').addElement(textEl).build());

		const saved = await handler.save(data.slides);
		const slideXml = await loadSlideXml(saved);

		// The lock node must be emitted with exactly the two set attributes.
		expect(slideXml).toContain('<a:spLocks');
		expect(slideXml).toContain('noMove="1"');
		expect(slideXml).toContain('noResize="1"');

		// And it must round-trip back into the model on reload.
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const el = reloaded.slides[0].elements.find((e) => e.id.includes('shape') || e.type === 'text');
		expect(el?.locks?.noMove).toBeTruthy();
		expect(el?.locks?.noResize).toBeTruthy();
	});

	it('parses @txBox="1" back into the model and re-emits it on a rebuild', async () => {
		// A shape (non-text) that carries a txBox flag must keep it after a
		// dirty save routed through the shape XML factory.
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const shapeEl: ShapePptxElement = {
			id: 'txbox-shape',
			type: 'shape',
			x: 40,
			y: 50,
			width: 200,
			height: 120,
			shapeType: 'rect',
			locks: { txBox: true },
		};
		data.slides.push(createSlide('Blank').addElement(shapeEl).build());

		const saved = await handler.save(data.slides);
		const slideXml = await loadSlideXml(saved);
		expect(slideXml).toContain('txBox="1"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const el = reloaded.slides[0].elements[0];
		expect(el?.locks?.txBox).toBeTruthy();
	});

	it('parses @txBox and a:spLocks together from an existing shape', async () => {
		const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
					<a:off x="0" y="0"/>
					<a:ext cx="0" cy="0"/>
					<a:chOff x="0" y="0"/>
					<a:chExt cx="0" cy="0"/>
				</a:xfrm>
			</p:grpSpPr>
			<p:sp>
				<p:nvSpPr>
					<p:cNvPr id="2" name="TextBox 1"/>
					<p:cNvSpPr txBox="1">
						<a:spLocks noMove="1" noResize="1"/>
					</p:cNvSpPr>
					<p:nvPr/>
				</p:nvSpPr>
				<p:spPr>
					<a:xfrm>
						<a:off x="914400" y="914400"/>
						<a:ext cx="1828800" cy="914400"/>
					</a:xfrm>
					<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
				</p:spPr>
				<p:txBody>
					<a:bodyPr/>
					<a:lstStyle/>
					<a:p><a:r><a:rPr lang="en-US"/><a:t>Hello</a:t></a:r></a:p>
				</p:txBody>
			</p:sp>
		</p:spTree>
	</p:cSld>
</p:sld>`;
		const slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

		const {
			handler: srcHandler,
			data: srcData,
			createSlide: srcCreateSlide,
		} = await PresentationBuilder.create();
		srcData.slides.push(srcCreateSlide('Blank').build());
		const baseBytes = await srcHandler.save(srcData.slides);
		const zip = await JSZip.loadAsync(baseBytes);
		zip.file('ppt/slides/slide1.xml', slideXml);
		zip.file('ppt/slides/_rels/slide1.xml.rels', slideRelsXml);
		const patchedBytes = await zip.generateAsync({ type: 'uint8array' });

		const handler = new PptxHandler();
		const reloaded = await handler.load(patchedBytes.buffer as ArrayBuffer);
		const el = reloaded.slides[0].elements.find((e) => e.type === 'text' || e.type === 'shape');
		expect(el?.locks?.noMove).toBeTruthy();
		expect(el?.locks?.noResize).toBeTruthy();
		expect(el?.locks?.txBox).toBeTruthy();
	});
});
