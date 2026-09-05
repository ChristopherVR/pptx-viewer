import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement } from '../../core/types/elements';

/**
 * `a:tblPr`'s OWN `EG_FillProperties` fill choice / `a:effectLst`
 * (independent of the referenced `a:tblStyleLst` style and of `a:tblBg`)
 * were parsed into `PptxTableData.tableFill` / `.tableEffects` but never
 * re-emitted: any save of a loaded table dropped both, even when nothing
 * about the fill/effects was touched, unless the surrounding `a:tblPr` XML
 * happened to survive because no other field forced a rewrite.
 * `writeTablePropertiesOwnFillAndEffects` (`table-tblpr-save.ts`) closes
 * this; this proves it end to end through `PptxHandler.save` / `.load`.
 */
describe('a:tblPr own fill/effectLst round-trip', () => {
	async function deckWithTable(): Promise<Uint8Array> {
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
			<p:graphicFrame>
				<p:nvGraphicFramePr>
					<p:cNvPr id="4" name="Styled Table"/>
					<p:cNvGraphicFramePr/>
					<p:nvPr/>
				</p:nvGraphicFramePr>
				<p:xfrm><a:off x="914400" y="914400"/><a:ext cx="2743200" cy="914400"/></p:xfrm>
				<a:graphic>
					<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
						<a:tbl>
							<a:tblPr firstRow="1" bandRow="0">
								<a:solidFill><a:srgbClr val="336699"/></a:solidFill>
								<a:effectLst><a:outerShdw blurRad="40000" dist="20000" dir="5400000"><a:srgbClr val="000000"><a:alpha val="40000"/></a:srgbClr></a:outerShdw></a:effectLst>
							</a:tblPr>
							<a:tblGrid><a:gridCol w="2743200"/></a:tblGrid>
							<a:tr h="914400">
								<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>A</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>
								<a:extLst/>
							</a:tr>
						</a:tbl>
					</a:graphicData>
				</a:graphic>
			</p:graphicFrame>
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

	function findTable(elements: readonly PptxElement[]) {
		const el = elements.find((e) => e.type === 'table');
		if (!el || el.type !== 'table') {
			throw new Error('table not found');
		}
		return el;
	}

	it('parses the own solidFill and effectLst off a:tblPr', async () => {
		const bytes = await deckWithTable();
		const loaded = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		const table = findTable(loaded.slides[0].elements);
		expect(table.tableData?.tableFill?.color).toBe('#336699');
		expect(table.tableData?.tableEffects?.length).toBeGreaterThan(0);
	});

	it('re-emits the own fill/effectLst after an unrelated edit (band-row toggle)', async () => {
		const bytes = await deckWithTable();
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const table = findTable(loaded.slides[0].elements);
		// Touch an unrelated flag; tableFill/tableEffects are left as whatever
		// the parser populated them with, never explicitly reassigned.
		table.tableData!.bandedRows = true;

		const saved = await handler.save(loaded.slides);
		const xml = await slideXmlOf(saved);
		expect(xml).toContain('bandRow="1"');
		expect(xml).toContain('<a:srgbClr val="336699">');
		expect(xml).toContain('a:outerShdw');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedTable = findTable(reloaded.slides[0].elements);
		expect(reloadedTable.tableData?.tableFill?.color).toBe('#336699');
		expect(reloadedTable.tableData?.tableEffects?.length).toBeGreaterThan(0);
	});

	it('round-trips an in-memory edit to the own fill colour', async () => {
		const bytes = await deckWithTable();
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const table = findTable(loaded.slides[0].elements);
		table.tableData!.tableFill = { schemeColor: '', color: '#00ff00' };

		const saved = await handler.save(loaded.slides);
		const xml = await slideXmlOf(saved);
		expect(xml.toLowerCase()).toContain('<a:srgbclr val="00ff00">');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedTable = findTable(reloaded.slides[0].elements);
		expect(reloadedTable.tableData?.tableFill?.color?.toLowerCase()).toBe('#00ff00');
	});
});
