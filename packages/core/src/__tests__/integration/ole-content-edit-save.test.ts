import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { OlePptxElement } from '../../core/types/elements';
import { applyOleSheetCellEdit, setOleObjectName } from '../../core/utils/ole-edit-api';
import { readOleSheetGrid } from '../../core/utils/ole-sheet-xlsx-editor';
import { decodePngDimensions } from '../../core/utils/png-encoder';

const WORKBOOK_XML = `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets></workbook>`;
const SHEET1_XML = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>10</v></c></row></sheetData></worksheet>`;

async function buildEmbeddedXlsx(): Promise<Uint8Array> {
	const zip = new JSZip();
	zip.file('xl/workbook.xml', WORKBOOK_XML);
	zip.file('xl/worksheets/sheet1.xml', SHEET1_XML);
	return zip.generateAsync({ type: 'uint8array' });
}

/** A tiny valid 1x1 PNG, standing in for PowerPoint's authored preview picture. */
const STUB_PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('oLE content edit save round-trip', () => {
	it('rewrites the embedded xlsx payload and preview image on save, readable again after reload', async () => {
		const xlsxBytes = await buildEmbeddedXlsx();
		const previewPngBytes = Uint8Array.from(Buffer.from(STUB_PNG_BASE64, 'base64'));

		const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
	xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
	<p:cSld>
		<p:spTree>
			<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
			<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
			<p:graphicFrame>
				<p:nvGraphicFramePr><p:cNvPr id="2" name="Embedded Excel"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
				<p:xfrm><a:off x="914400" y="914400"/><a:ext cx="2286000" cy="1714500"/></p:xfrm>
				<a:graphic>
					<a:graphicData uri="http://schemas.openxmlformats.org/presentationml/2006/ole">
						<p:oleObj progId="Excel.Sheet.12" showAsIcon="0" r:id="rId2" imgW="2286000" imgH="1714500">
							<p:embed/>
							<p:pic>
								<p:nvPicPr><p:cNvPr id="0" name="Picture"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
								<p:blipFill><a:blip r:embed="rId3"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
								<p:spPr>
									<a:xfrm><a:off x="914400" y="914400"/><a:ext cx="2286000" cy="1714500"/></a:xfrm>
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
	<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject" Target="../embeddings/oleObject1.xlsx"/>
	<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`;

		const { handler: srcHandler, data: srcData, createSlide } = await PresentationBuilder.create();
		srcData.slides.push(createSlide('Blank').build());
		const baseBytes = await srcHandler.save(srcData.slides);
		const zip = await JSZip.loadAsync(baseBytes);
		zip.file('ppt/slides/slide1.xml', slideXml);
		zip.file('ppt/slides/_rels/slide1.xml.rels', slideRelsXml);
		zip.file('ppt/embeddings/oleObject1.xlsx', xlsxBytes);
		zip.file('ppt/media/image1.png', previewPngBytes);
		const patchedBytes = await zip.generateAsync({ type: 'uint8array' });

		// 1. Load: the OLE element's embedded xlsx payload should be recovered.
		const handler = new PptxHandler();
		const loaded = await handler.load(patchedBytes.buffer as ArrayBuffer);
		const oleEl = loaded.slides[0].elements.find((el): el is OlePptxElement => el.type === 'ole')!;
		expect(oleEl.oleEmbeddedData).toBeDefined();
		const originalGrid = await readOleSheetGrid(
			Uint8Array.from(Buffer.from(oleEl.oleEmbeddedData!.split(',')[1]!, 'base64')),
		);
		expect(originalGrid!.rows[0]!.cells[0]!.value).toBe('10');

		// 2. Apply the content edit via the pure edit API (mirrors what a
		//    binding's OLE editor dialog would call), replacing the element.
		const editedEl = await applyOleSheetCellEdit(oleEl, { row: 0, col: 0, value: '250' });
		expect(editedEl.oleContentDirty).toBeTruthy();
		loaded.slides[0].elements = loaded.slides[0].elements.map((el) =>
			el === oleEl ? editedEl : el,
		);
		loaded.slides[0].isDirty = true;

		// 3. Save: the embedding part AND preview image part must be rewritten.
		const savedBytes = await handler.save(loaded.slides);
		const savedZip = await JSZip.loadAsync(savedBytes);
		const savedXlsxBytes = await savedZip
			.file('ppt/embeddings/oleObject1.xlsx')!
			.async('uint8array');
		const savedGrid = await readOleSheetGrid(savedXlsxBytes);
		expect(savedGrid!.rows[0]!.cells[0]!.value).toBe('250');

		const savedPreviewBytes = await savedZip.file('ppt/media/image1.png')!.async('uint8array');
		expect(savedPreviewBytes).not.toStrictEqual(previewPngBytes);
		expect(decodePngDimensions(savedPreviewBytes)).toBeDefined();

		// 4. Reload: the edited value round-trips through a fresh load.
		const reloader = new PptxHandler();
		const reloaded = await reloader.load(savedBytes.buffer as ArrayBuffer);
		const reloadedOle = reloaded.slides[0].elements.find(
			(el): el is OlePptxElement => el.type === 'ole',
		)!;
		const reloadedGrid = await readOleSheetGrid(
			Uint8Array.from(Buffer.from(reloadedOle.oleEmbeddedData!.split(',')[1]!, 'base64')),
		);
		expect(reloadedGrid!.rows[0]!.cells[0]!.value).toBe('250');
	});

	it('applies a content edit AND a rename when the p:oleObj is wrapped in mc:AlternateContent (real PowerPoint markup)', async () => {
		// COM-verified: every OLE object `Shapes.AddOLEObject` produces in real
		// PowerPoint wraps `p:oleObj` this way (an `mc:Choice Requires="v"` VML
		// branch plus the real payload in `mc:Fallback`), not "bare" under
		// `a:graphicData` the way `ole-save-roundtrip.test.ts`'s hand-authored
		// fixtures do. A save-time lookup that only checked the bare position
		// silently no-op'd both the rename and the content edit against any
		// real, COM/PowerPoint-authored deck (found via `pptx-com-open.ps1` +
		// an Excel COM readback while building `e2e/fixtures/ole-editable.pptx`).
		const xlsxBytes = await buildEmbeddedXlsx();
		const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
	xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
	xmlns:v="urn:schemas-microsoft-com:vml"
	xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
	<p:cSld>
		<p:spTree>
			<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
			<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
			<p:graphicFrame>
				<p:nvGraphicFramePr><p:cNvPr id="2" name="Worksheet"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
				<p:xfrm><a:off x="914400" y="914400"/><a:ext cx="2286000" cy="1714500"/></p:xfrm>
				<a:graphic>
					<a:graphicData uri="http://schemas.openxmlformats.org/presentationml/2006/ole">
						<mc:AlternateContent>
							<mc:Choice xmlns:v="urn:schemas-microsoft-com:vml" Requires="v">
								<p:oleObj name="Worksheet" progId="Excel.Sheet.12" showAsIcon="0" r:id="rId2" imgW="2286000" imgH="1714500">
									<p:embed/>
								</p:oleObj>
							</mc:Choice>
							<mc:Fallback>
								<p:oleObj name="Worksheet" progId="Excel.Sheet.12" showAsIcon="0" r:id="rId2" imgW="2286000" imgH="1714500">
									<p:embed/>
									<p:pic>
										<p:nvPicPr><p:cNvPr id="0" name="Picture"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
										<p:blipFill><a:blip r:embed="rId3"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
										<p:spPr>
											<a:xfrm><a:off x="914400" y="914400"/><a:ext cx="2286000" cy="1714500"/></a:xfrm>
											<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
										</p:spPr>
									</p:pic>
								</p:oleObj>
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
	<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject" Target="../embeddings/oleObject1.xlsx"/>
	<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`;
		const previewPngBytes = Uint8Array.from(
			Buffer.from(
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
				'base64',
			),
		);

		const { handler: srcHandler, data: srcData, createSlide } = await PresentationBuilder.create();
		srcData.slides.push(createSlide('Blank').build());
		const baseBytes = await srcHandler.save(srcData.slides);
		const zip = await JSZip.loadAsync(baseBytes);
		zip.file('ppt/slides/slide1.xml', slideXml);
		zip.file('ppt/slides/_rels/slide1.xml.rels', slideRelsXml);
		zip.file('ppt/embeddings/oleObject1.xlsx', xlsxBytes);
		zip.file('ppt/media/image1.png', previewPngBytes);
		const patchedBytes = await zip.generateAsync({ type: 'uint8array' });

		const handler = new PptxHandler();
		const loaded = await handler.load(patchedBytes.buffer as ArrayBuffer);
		const oleEl = loaded.slides[0].elements.find((el): el is OlePptxElement => el.type === 'ole')!;
		expect(oleEl.oleProgId).toBe('Excel.Sheet.12');

		let updated = await applyOleSheetCellEdit(oleEl, { row: 0, col: 0, value: '777' });
		updated = await setOleObjectName(updated, 'Renamed Via AlternateContent');
		loaded.slides[0].elements = loaded.slides[0].elements.map((el) =>
			el === oleEl ? updated : el,
		);
		loaded.slides[0].isDirty = true;

		const savedBytes = await handler.save(loaded.slides);
		const savedZip = await JSZip.loadAsync(savedBytes);
		const savedSlideXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');
		const renameOccurrences = savedSlideXml.split('name="Renamed Via AlternateContent"').length - 1;
		expect(
			renameOccurrences,
			'the rename reached BOTH the mc:Choice and mc:Fallback branches',
		).toBe(2);

		const savedXlsxBytes = await savedZip
			.file('ppt/embeddings/oleObject1.xlsx')!
			.async('uint8array');
		const savedGrid = await readOleSheetGrid(savedXlsxBytes);
		expect(savedGrid!.rows[0]!.cells[0]!.value).toBe('777');

		const reloaded = await new PptxHandler().load(savedBytes.buffer as ArrayBuffer);
		const reloadedOle = reloaded.slides[0].elements.find(
			(el): el is OlePptxElement => el.type === 'ole',
		)!;
		expect(reloadedOle.oleName).toBe('Renamed Via AlternateContent');
	});
});
