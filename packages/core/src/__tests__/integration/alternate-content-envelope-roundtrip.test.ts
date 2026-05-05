import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

/**
 * Cross-cutting CC-4 regression test.
 *
 * Before the fix:
 *   - The slide spTree parser merged the selected `mc:Choice` branch's
 *     children into spTree's flat type-arrays and silently discarded the
 *     `mc:Fallback`.  On dirty save the writer emitted plain
 *     `<p:sp>`/`<p:pic>` etc. with no `mc:AlternateContent` envelope —
 *     legacy renderers (older Office, LibreOffice) lost their fallback
 *     rendering for any feature originally authored under newer
 *     namespaces.
 *
 * After the fix:
 *   - `unwrapAlternateContent` records every consumed AC envelope on a
 *     per-runtime WeakMap keyed by the merged child's XmlObject reference.
 *   - At save time `reapplyAlternateContentEnvelopes` lifts those nodes
 *     back out of the flat collectors, rebuilds the original Choice with
 *     the live (possibly edited) nodes, and preserves the Fallback verbatim.
 */
describe('mc:AlternateContent envelope round-trip (CC-4)', () => {
	it('preserves both mc:Choice and mc:Fallback on dirty save', async () => {
		const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
	xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
	xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
	xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main">
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
			<mc:AlternateContent>
				<mc:Choice xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" Requires="p14">
					<p:sp>
						<p:nvSpPr>
							<p:cNvPr id="2" name="Modern Choice Shape"/>
							<p:cNvSpPr/>
							<p:nvPr/>
						</p:nvSpPr>
						<p:spPr>
							<a:xfrm>
								<a:off x="914400" y="914400"/>
								<a:ext cx="1828800" cy="914400"/>
							</a:xfrm>
							<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
							<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>
						</p:spPr>
						<p:txBody>
							<a:bodyPr/>
							<a:lstStyle/>
							<a:p><a:r><a:rPr lang="en-US"/><a:t>ChoiceText</a:t></a:r></a:p>
						</p:txBody>
					</p:sp>
				</mc:Choice>
				<mc:Fallback>
					<p:sp>
						<p:nvSpPr>
							<p:cNvPr id="3" name="Legacy Fallback Shape"/>
							<p:cNvSpPr/>
							<p:nvPr/>
						</p:nvSpPr>
						<p:spPr>
							<a:xfrm>
								<a:off x="914400" y="914400"/>
								<a:ext cx="1828800" cy="914400"/>
							</a:xfrm>
							<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
							<a:solidFill><a:srgbClr val="00FF00"/></a:solidFill>
						</p:spPr>
						<p:txBody>
							<a:bodyPr/>
							<a:lstStyle/>
							<a:p><a:r><a:rPr lang="en-US"/><a:t>FallbackText</a:t></a:r></a:p>
						</p:txBody>
					</p:sp>
				</mc:Fallback>
			</mc:AlternateContent>
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

		// Load: parser picks the Choice branch (p14 is a supported namespace).
		const handler = new PptxHandler();
		const reloaded = await handler.load(patchedBytes.buffer as ArrayBuffer);
		expect(reloaded.slides).toHaveLength(1);
		const elements = reloaded.slides[0].elements;
		// We expect the Choice's shape to be the merged element.
		const chosen = elements.find((e) => (e.name ?? '').includes('Modern Choice Shape'));
		expect(chosen, 'Choice branch element was not parsed').toBeDefined();

		// Force-dirty save.
		reloaded.slides[0].isDirty = true;
		const savedBytes = await handler.save(reloaded.slides);
		const savedZip = await JSZip.loadAsync(savedBytes);
		const savedSlideXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');

		// The output must keep the AC envelope: both branches present.
		expect(savedSlideXml).toContain('mc:AlternateContent');
		expect(savedSlideXml).toContain('mc:Choice');
		expect(savedSlideXml).toContain('mc:Fallback');
		// Choice still references its required namespace.
		expect(savedSlideXml).toMatch(/<mc:Choice[^>]*Requires=/);
		// Fallback content survives verbatim.
		expect(savedSlideXml).toContain('Legacy Fallback Shape');
		expect(savedSlideXml).toContain('FallbackText');
		// Choice content (the live node) is also still present.
		expect(savedSlideXml).toContain('Modern Choice Shape');

		// The shape must NOT be emitted both inside the AC envelope and
		// alongside it as a flat top-level `<p:sp>`. Count occurrences of
		// the unique cNvPr id; should be exactly 1 (inside Choice).
		const choiceShapeOccurrences = (savedSlideXml.match(/Modern Choice Shape/g) || []).length;
		expect(choiceShapeOccurrences).toBe(1);

		// Re-loading must still find the modern Choice shape.
		const handler2 = new PptxHandler();
		const reloaded2 = await handler2.load(savedBytes.buffer as ArrayBuffer);
		const elements2 = reloaded2.slides[0].elements;
		const chosen2 = elements2.find((e) => (e.name ?? '').includes('Modern Choice Shape'));
		expect(chosen2, 'Choice branch element did not survive a second round-trip').toBeDefined();
	});
});
