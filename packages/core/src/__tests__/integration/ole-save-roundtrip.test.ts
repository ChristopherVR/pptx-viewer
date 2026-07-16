import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { OlePptxElement } from '../../core/types/elements';

/**
 * Phase 3 Stream A — CH-H1 regression test.
 *
 * Before the fix, `processSlideElement` had no `case 'ole'` branch and any
 * SDK-supplied `OlePptxElement` (or a typed-edited OLE element whose
 * `rawXml` had been cleared) hit the `SAVE_ELEMENT_SKIPPED` warning and
 * was silently dropped from the saved slide.
 */
describe('oLE element save round-trip (CH-H1)', () => {
	it('sDK-created OLE element produces a graphicFrame with p:oleObj on save', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const ole: OlePptxElement = {
			id: 'ole-test-1',
			type: 'ole',
			x: 50,
			y: 60,
			width: 240,
			height: 180,
			oleProgId: 'Excel.Sheet.12',
			oleName: 'Budget',
			oleClsId: '00020830-0000-0000-C000-000000000046',
			oleObjectType: 'excel',
			fileName: 'budget.xlsx',
		};
		data.slides.push(createSlide('Blank').addElement(ole).build());

		const savedBytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(savedBytes);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');

		// The element must no longer be silently skipped — the saved slide
		// XML must carry an OLE graphic frame.
		expect(slideXml).toContain('<p:graphicFrame');
		expect(slideXml).toContain('p:oleObj');
		expect(slideXml).toContain('Excel.Sheet.12');
	});

	it('authors the embedded payload, relationship, and content type', async () => {
		const payload = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x11, 0x22]);
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const ole: OlePptxElement = {
			id: 'ole-authored-payload',
			type: 'ole',
			x: 20,
			y: 30,
			width: 320,
			height: 200,
			oleProgId: 'Excel.Sheet.12',
			oleObjectType: 'excel',
			oleFileExtension: 'xlsx',
			oleEmbeddedFileName: 'budget.xlsx',
			oleEmbeddedMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			oleEmbeddedData: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${Buffer.from(payload).toString('base64')}`,
		};
		data.slides.push(createSlide('Blank').addElement(ole).build());

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const embeddingPath = Object.keys(zip.files).find((path) =>
			/^ppt\/embeddings\/oleObject\d+\.xlsx$/u.test(path),
		);
		expect(embeddingPath).toBeDefined();
		await expect(zip.file(embeddingPath!)!.async('uint8array')).resolves.toStrictEqual(payload);

		const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		expect(rels).toContain('relationships/oleObject');
		expect(rels).toContain(`../embeddings/${embeddingPath!.split('/').pop()}`);
		const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
		expect(contentTypes).toContain(`PartName="/${embeddingPath}"`);
		expect(contentTypes).toContain(ole.oleEmbeddedMimeType!);

		const reloader = new PptxHandler();
		const reloaded = await reloader.load(saved.buffer as ArrayBuffer);
		const reloadedOle = reloaded.slides[0].elements.find(
			(element): element is OlePptxElement => element.type === 'ole',
		);
		expect(reloadedOle?.oleTarget).toContain('.xlsx');
		expect(reloadedOle?.oleEmbeddedByteSize).toBe(payload.length);
		expect(reloadedOle?.oleEmbeddedData).toBe(ole.oleEmbeddedData);
	});

	it('oLE element loaded from rawXml round-trips with progId / name preserved', async () => {
		// 1. Build a minimal package containing a single slide with an OLE
		//    graphic frame and a stub `oleObject1.bin` so the embed rel
		//    resolves.
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
			<p:graphicFrame>
				<p:nvGraphicFramePr>
					<p:cNvPr id="2" name="Embedded Excel"/>
					<p:cNvGraphicFramePr/>
					<p:nvPr/>
				</p:nvGraphicFramePr>
				<p:xfrm>
					<a:off x="914400" y="914400"/>
					<a:ext cx="2286000" cy="1714500"/>
				</p:xfrm>
				<a:graphic>
					<a:graphicData uri="http://schemas.openxmlformats.org/presentationml/2006/ole">
						<p:oleObj progId="Excel.Sheet.12" showAsIcon="0" r:id="rId2" imgW="2286000" imgH="1714500">
							<p:embed/>
							<p:pic>
								<p:nvPicPr>
									<p:cNvPr id="0" name="Picture"/>
									<p:cNvPicPr/>
									<p:nvPr/>
								</p:nvPicPr>
								<p:blipFill>
									<a:blip/>
									<a:stretch><a:fillRect/></a:stretch>
								</p:blipFill>
								<p:spPr>
									<a:xfrm>
										<a:off x="914400" y="914400"/>
										<a:ext cx="2286000" cy="1714500"/>
									</a:xfrm>
									<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
								</p:spPr>
							</p:pic>
						</p:oleObj>
					</a:graphicData>
				</a:graphic>
			</p:graphicFrame>
		</p:spTree>
	</p:cSld>
</p:sld>`;
		const slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
	<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject" Target="../embeddings/oleObject1.bin"/>
</Relationships>`;

		// Construct a minimal PPTX by starting from a freshly-built deck and
		// patching in the slide / rels / binary.
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
		zip.file('ppt/embeddings/oleObject1.bin', new Uint8Array([0x00, 0x01, 0x02, 0x03]));
		// Register the embedding part in [Content_Types].xml so the package
		// remains valid; PowerPoint requires a Default for the .bin extension.
		const ctXml = await zip.file('[Content_Types].xml')!.async('string');
		const patchedCtXml = ctXml.includes('Extension="bin"')
			? ctXml
			: ctXml.replace(
					'<Default Extension="rels"',
					'<Default Extension="bin" ContentType="application/vnd.openxmlformats-officedocument.oleObject"/><Default Extension="rels"',
				);
		zip.file('[Content_Types].xml', patchedCtXml);
		const patchedBytes = await zip.generateAsync({ type: 'uint8array' });

		// 2. Load the patched package — the OLE element must surface with the
		//    progId / name parsed from rawXml.
		const handler = new PptxHandler();
		const reloaded = await handler.load(patchedBytes.buffer as ArrayBuffer);
		expect(reloaded.slides).toHaveLength(1);
		const oleEl = reloaded.slides[0].elements.find((e) => e.type === 'ole') as
			| OlePptxElement
			| undefined;
		expect(oleEl, 'OLE element was not parsed from rawXml').toBeDefined();
		expect(oleEl!.oleProgId).toBe('Excel.Sheet.12');

		// 3. Mark the slide dirty and save — the OLE graphic frame must
		//    survive the round-trip via the new `case 'ole'` branch.
		reloaded.slides[0].isDirty = true;
		const savedBytes = await handler.save(reloaded.slides);
		const savedZip = await JSZip.loadAsync(savedBytes);
		const savedSlideXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');
		expect(savedSlideXml).toContain('<p:graphicFrame');
		expect(savedSlideXml).toContain('p:oleObj');
		expect(savedSlideXml).toContain('Excel.Sheet.12');

		// 4. Reload again and verify typed-field round-trip.
		const reloader = new PptxHandler();
		const reloaded2 = await reloader.load(savedBytes.buffer as ArrayBuffer);
		const oleEl2 = reloaded2.slides[0].elements.find((e) => e.type === 'ole') as
			| OlePptxElement
			| undefined;
		expect(oleEl2).toBeDefined();
		expect(oleEl2!.oleProgId).toBe('Excel.Sheet.12');
	});
});
