import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { InkPptxElement } from '../../core/types/elements';

/**
 * Phase 3 Stream A — CH-H2 / CH-H3 regression test.
 *
 * Before the fix:
 *   - `parseGraphicFrameType` did not recognise the 2010 ink URI, so an
 *     `<aink:ink>` graphicFrame parsed as `'unknown'` and slipped through
 *     subsequent typed-element pipelines.
 *   - The save layer re-encoded ink elements as `p:sp` + `a:custGeom`
 *     unconditionally — losing pressure data, the original aink namespace,
 *     and the `mc:AlternateContent` envelope.
 *
 * The combined effect was that any real-world ink element survived only by
 * accident; on a dirty save it was rewritten as a plain freeform shape.
 */
describe('ink graphicFrame round-trip (CH-H2 / CH-H3)', () => {
	it('authors editable ink as aink with a fallback and reloads its strokes', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const ink: InkPptxElement = {
			id: 'authored-ink',
			type: 'ink',
			x: 10,
			y: 20,
			width: 200,
			height: 100,
			inkPaths: ['M0,0 L50,25 L100,10', 'M10,90 L80,40'],
			inkColors: ['#112233', '#AABBCC'],
			inkWidths: [2.5, 6],
		};
		data.slides.push(createSlide('Blank').addElement(ink).build());

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toContain('drawing/2010/ink');
		expect(slideXml).toContain(
			'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"',
		);
		expect(slideXml).toContain('<aink:trace');
		expect(slideXml).toContain('<mc:Fallback>');

		const reloader = new PptxHandler();
		const reloaded = await reloader.load(saved.buffer as ArrayBuffer);
		const reloadedInk = reloaded.slides[0].elements.find(
			(element): element is InkPptxElement => element.type === 'ink',
		);
		expect(reloadedInk?.inkPaths).toStrictEqual(['M0,0 L50,25 L100,10', 'M10,90 L80,40']);
		expect(reloadedInk?.inkColors).toStrictEqual(ink.inkColors);
		expect(reloadedInk?.inkWidths).toStrictEqual(ink.inkWidths);
	});

	it('ink element loaded from rawXml survives a dirty round-trip via passthrough', async () => {
		const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
	xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
	xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
	xmlns:aink="http://schemas.microsoft.com/office/drawing/2010/ink">
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
			<p:graphicFrame>
				<p:nvGraphicFramePr>
					<p:cNvPr id="2" name="Ink 1"/>
					<p:cNvGraphicFramePr/>
					<p:nvPr/>
				</p:nvGraphicFramePr>
				<p:xfrm>
					<a:off x="914400" y="914400"/>
					<a:ext cx="1828800" cy="914400"/>
				</p:xfrm>
				<a:graphic>
					<a:graphicData uri="http://schemas.microsoft.com/office/drawing/2010/ink">
						<mc:AlternateContent>
							<mc:Choice xmlns:aink="http://schemas.microsoft.com/office/drawing/2010/ink" Requires="aink">
								<aink:ink>
									<aink:trace>0,0 100,100 200,50</aink:trace>
								</aink:ink>
							</mc:Choice>
							<mc:Fallback>
								<p:sp>
									<p:nvSpPr>
										<p:cNvPr id="3" name="Ink fallback"/>
										<p:cNvSpPr/>
										<p:nvPr/>
									</p:nvSpPr>
									<p:spPr>
										<a:xfrm>
											<a:off x="914400" y="914400"/>
											<a:ext cx="1828800" cy="914400"/>
										</a:xfrm>
										<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
									</p:spPr>
								</p:sp>
							</mc:Fallback>
						</mc:AlternateContent>
					</a:graphicData>
				</a:graphic>
			</p:graphicFrame>
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

		// Load and confirm the ink graphicFrame is recognised as `type: 'ink'`.
		const handler = new PptxHandler();
		const reloaded = await handler.load(patchedBytes.buffer as ArrayBuffer);
		expect(reloaded.slides).toHaveLength(1);
		const inkEl = reloaded.slides[0].elements.find((e) => e.type === 'ink');
		expect(inkEl, 'ink graphicFrame was not detected (CH-H3)').toBeDefined();
		expect(inkEl!.rawXml).toBeDefined();

		// Force-dirty save and reload. The aink:ink payload must survive
		// (CH-H2: no longer re-encoded as custGeom).
		reloaded.slides[0].isDirty = true;
		const savedBytes = await handler.save(reloaded.slides);
		const savedZip = await JSZip.loadAsync(savedBytes);
		const savedSlideXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');

		// Saved slide must keep the ink graphicFrame envelope and the aink:ink payload.
		expect(savedSlideXml).toContain('<p:graphicFrame');
		expect(savedSlideXml).toContain('aink:ink');
		expect(savedSlideXml).toContain('drawing/2010/ink');

		// Saved slide must NOT have downgraded the ink to a plain custGeom shape.
		// (Before the fix this was the regression: dirty save replaced the
		// graphicFrame with a `p:sp/a:custGeom`.)
		const inkAsCustGeom =
			savedSlideXml.includes('a:custGeom') && !savedSlideXml.includes('aink:ink');
		expect(inkAsCustGeom).toBeFalsy();
	});
});
