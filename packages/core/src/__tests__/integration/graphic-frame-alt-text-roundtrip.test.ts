import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement, SmartArtPptxElement } from '../../core/types/elements';

/**
 * `p:nvGraphicFramePr/p:cNvPr/@descr` (alt text) and `@title` on a
 * graphic-frame element (table/chart/smartArt/ole/media) were neither
 * parsed nor re-serialised, so accessibility text authored on any of those
 * element types was silently dropped on load (a picture's alt text, from
 * the sibling `p:nvPicPr/p:cNvPr/@descr`, already round-tripped).
 */
describe('graphic-frame altText/title round-trip', () => {
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

	const TABLE_FRAME = `
		<p:graphicFrame>
			<p:nvGraphicFramePr>
				<p:cNvPr id="4" name="Sales Table" descr="Quarterly sales figures" title="Sales"/>
				<p:cNvGraphicFramePr/>
				<p:nvPr/>
			</p:nvGraphicFramePr>
			<p:xfrm><a:off x="914400" y="914400"/><a:ext cx="2743200" cy="914400"/></p:xfrm>
			<a:graphic>
				<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
					<a:tbl>
						<a:tblPr firstRow="1" bandRow="1"/>
						<a:tblGrid><a:gridCol w="2743200"/></a:tblGrid>
						<a:tr h="914400">
							<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>A</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>
							<a:extLst/>
						</a:tr>
					</a:tbl>
				</a:graphicData>
			</a:graphic>
		</p:graphicFrame>`;

	const CHART_FRAME = `
		<p:graphicFrame>
			<p:nvGraphicFramePr>
				<p:cNvPr id="5" name="Revenue Chart" descr="Bar chart of revenue by region"/>
				<p:cNvGraphicFramePr/>
				<p:nvPr/>
			</p:nvGraphicFramePr>
			<p:xfrm><a:off x="4572000" y="914400"/><a:ext cx="2743200" cy="1828800"/></p:xfrm>
			<a:graphic>
				<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
					<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
						xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId9"/>
				</a:graphicData>
			</a:graphic>
		</p:graphicFrame>`;

	function findByType(elements: readonly PptxElement[], type: PptxElement['type']) {
		return elements.find((el) => el.type === type);
	}

	it('parses altText and title from a table graphic frame', async () => {
		const bytes = await deckWithSlideXml(TABLE_FRAME);
		const loaded = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		const table = findByType(loaded.slides[0].elements, 'table');
		expect(table?.type === 'table' && table.altText).toBe('Quarterly sales figures');
		expect(table?.type === 'table' && table.title).toBe('Sales');
	});

	it('parses altText (no title attribute authored) from a chart graphic frame', async () => {
		const bytes = await deckWithSlideXml(CHART_FRAME);
		const loaded = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		const chart = findByType(loaded.slides[0].elements, 'chart');
		expect(chart?.type === 'chart' && chart.altText).toBe('Bar chart of revenue by region');
		expect(chart?.type === 'chart' && chart.title).toBeUndefined();
	});

	it('round-trips an edit to altText/title on a table through save -> reload', async () => {
		const bytes = await deckWithSlideXml(TABLE_FRAME);
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const table = findByType(loaded.slides[0].elements, 'table');
		if (table?.type !== 'table') {
			throw new Error('table not found');
		}
		table.altText = 'Updated description';
		table.title = 'Updated title';

		const saved = await handler.save(loaded.slides);
		const xml = await slideXmlOf(saved);
		expect(xml).toContain('descr="Updated description"');
		expect(xml).toContain('title="Updated title"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedTable = findByType(reloaded.slides[0].elements, 'table');
		expect(reloadedTable?.type === 'table' && reloadedTable.altText).toBe('Updated description');
		expect(reloadedTable?.type === 'table' && reloadedTable.title).toBe('Updated title');
	});

	it('clears altText when set to an empty string', async () => {
		const bytes = await deckWithSlideXml(TABLE_FRAME);
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const table = findByType(loaded.slides[0].elements, 'table');
		if (table?.type !== 'table') {
			throw new Error('table not found');
		}
		table.altText = '';

		const saved = await handler.save(loaded.slides);
		const xml = await slideXmlOf(saved);
		expect(xml).not.toContain('descr=');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedTable = findByType(reloaded.slides[0].elements, 'table');
		expect(reloadedTable?.type === 'table' && reloadedTable.altText).toBeUndefined();
	});

	it('leaves altText/title untouched when the model has no opinion (undefined)', async () => {
		const bytes = await deckWithSlideXml(TABLE_FRAME);
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const table = findByType(loaded.slides[0].elements, 'table');
		if (table?.type !== 'table') {
			throw new Error('table not found');
		}
		// Touch an unrelated field only; altText/title stay whatever the parser
		// populated them with (real values here), never explicitly reassigned.
		table.tableData!.bandedRows = false;

		const saved = await handler.save(loaded.slides);
		const xml = await slideXmlOf(saved);
		expect(xml).toContain('descr="Quarterly sales figures"');
		expect(xml).toContain('title="Sales"');
	});

	it('round-trips altText/title set on a chart element built via the SDK', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create({
			initialSlideCount: 0,
		});
		const slide = createSlide('Blank')
			.addChart(
				'bar',
				{ series: [{ name: 'Revenue', values: [1, 2, 3] }], categories: ['Jan', 'Feb', 'Mar'] },
				{ x: 50, y: 50, width: 400, height: 300 },
			)
			.build();
		data.slides.push(slide);
		const seed = await handler.save(data.slides);

		const loadHandler = new PptxHandler();
		const loaded = await loadHandler.load(seed.buffer as ArrayBuffer);
		const chart = findByType(loaded.slides[0].elements, 'chart');
		if (chart?.type !== 'chart') {
			throw new Error('chart not found');
		}
		chart.altText = 'Bar chart of quarterly revenue';
		chart.title = 'Revenue chart';

		const saved = await loadHandler.save(loaded.slides);
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedChart = findByType(reloaded.slides[0].elements, 'chart');
		expect(reloadedChart?.type === 'chart' && reloadedChart.altText).toBe(
			'Bar chart of quarterly revenue',
		);
		expect(reloadedChart?.type === 'chart' && reloadedChart.title).toBe('Revenue chart');
	});

	it('round-trips altText/title set on a smartArt element', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(createSlide('Blank').build());
		data.slides[0].elements.push({
			id: 'smartart-1',
			type: 'smartArt',
			x: 20,
			y: 30,
			width: 400,
			height: 300,
			smartArtData: {
				layout: 'orgChart',
				nodes: [{ id: 'n1', text: 'Root' }],
			},
		} as SmartArtPptxElement as PptxElement);
		const seed = await handler.save(data.slides);

		const loadHandler = new PptxHandler();
		const loaded = await loadHandler.load(seed.buffer as ArrayBuffer);
		const smartArt = findByType(loaded.slides[0].elements, 'smartArt');
		if (smartArt?.type !== 'smartArt') {
			throw new Error('smartArt not found');
		}
		smartArt.altText = 'Organisation chart';
		smartArt.title = 'Org chart';

		const saved = await loadHandler.save(loaded.slides);
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedSmartArt = findByType(reloaded.slides[0].elements, 'smartArt');
		expect(reloadedSmartArt?.type === 'smartArt' && reloadedSmartArt.altText).toBe(
			'Organisation chart',
		);
		expect(reloadedSmartArt?.type === 'smartArt' && reloadedSmartArt.title).toBe('Org chart');
	});
});
