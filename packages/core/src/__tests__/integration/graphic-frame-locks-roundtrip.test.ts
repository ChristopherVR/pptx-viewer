import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { GroupPptxElement, PptxElement } from '../../core/types/elements';

/**
 * Locks on the families that are NOT `p:sp`-shaped.
 *
 * Two gaps this covers, both of which made a lock the UI honoured vanish from
 * the saved file:
 *
 *  1. `a:graphicFrameLocks` (`CT_GraphicalObjectFrameLocking`) was neither
 *     parsed nor serialized, so every table, chart, SmartArt diagram, OLE
 *     object and graphic-frame media element silently lost its locks. It could
 *     not simply be added to the writer either: serializing from an
 *     always-`undefined` `element.locks` DELETES what the author wrote, so the
 *     parse side has to land first.
 *  2. A group nested inside another group never reached `processSlideElement`
 *     (`buildGroupShapeXml` recurses on its own), so `serializeShapeLocks` was
 *     never called for it and `a:grpSpLocks` was rebuilt from the untouched
 *     original markup - fine until the model was edited, at which point the
 *     edit was silently dropped.
 */
describe('graphic-frame + nested-group lock round-trip', () => {
	/** A one-slide deck carrying `slideXml` verbatim. */
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
				<p:cNvPr id="4" name="Locked Table"/>
				<p:cNvGraphicFramePr>
					<a:graphicFrameLocks noGrp="1" noMove="1" noResize="1" noDrilldown="1"/>
				</p:cNvGraphicFramePr>
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
				<p:cNvPr id="5" name="Locked Chart"/>
				<p:cNvGraphicFramePr>
					<a:graphicFrameLocks noSelect="1" noChangeAspect="1"/>
				</p:cNvGraphicFramePr>
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

	/** `noUngrp` has no model field, so it proves the carry-over path too. */
	const NESTED_GROUP = `
		<p:grpSp>
			<p:nvGrpSpPr>
				<p:cNvPr id="6" name="Outer"/>
				<p:cNvGrpSpPr/>
				<p:nvPr/>
			</p:nvGrpSpPr>
			<p:grpSpPr>
				<a:xfrm>
					<a:off x="0" y="2743200"/><a:ext cx="3657600" cy="1828800"/>
					<a:chOff x="0" y="2743200"/><a:chExt cx="3657600" cy="1828800"/>
				</a:xfrm>
			</p:grpSpPr>
			<p:grpSp>
				<p:nvGrpSpPr>
					<p:cNvPr id="7" name="Inner"/>
					<p:cNvGrpSpPr>
						<a:grpSpLocks noUngrp="1"/>
					</p:cNvGrpSpPr>
					<p:nvPr/>
				</p:nvGrpSpPr>
				<p:grpSpPr>
					<a:xfrm>
						<a:off x="0" y="2743200"/><a:ext cx="1828800" cy="914400"/>
						<a:chOff x="0" y="2743200"/><a:chExt cx="1828800" cy="914400"/>
					</a:xfrm>
				</p:grpSpPr>
				<p:sp>
					<p:nvSpPr>
						<p:cNvPr id="8" name="Inner Shape"/>
						<p:cNvSpPr/>
						<p:nvPr/>
					</p:nvSpPr>
					<p:spPr>
						<a:xfrm><a:off x="0" y="2743200"/><a:ext cx="914400" cy="914400"/></a:xfrm>
						<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
					</p:spPr>
					<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>
				</p:sp>
			</p:grpSp>
		</p:grpSp>`;

	function findByType(elements: readonly PptxElement[], type: PptxElement['type']) {
		return elements.find((el) => el.type === type);
	}

	it('parses a:graphicFrameLocks on a table and preserves it across a save', async () => {
		const bytes = await deckWithSlideXml(TABLE_FRAME);
		const loaded = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		const table = findByType(loaded.slides[0].elements, 'table');
		expect(table?.locks).toMatchObject({
			noGrouping: true,
			noMove: true,
			noResize: true,
			noDrilldown: true,
		});

		const handler = new PptxHandler();
		const reloadedOnce = await handler.load(bytes.buffer as ArrayBuffer);
		const saved = await handler.save(reloadedOnce.slides);
		const xml = await slideXmlOf(saved);
		expect(xml).toContain('<a:graphicFrameLocks');
		expect(xml).toMatch(/<a:graphicFrameLocks[^>]*noMove="1"/u);
		expect(xml).toMatch(/<a:graphicFrameLocks[^>]*noDrilldown="1"/u);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(findByType(reloaded.slides[0].elements, 'table')?.locks).toMatchObject({
			noGrouping: true,
			noMove: true,
			noResize: true,
			noDrilldown: true,
		});
	});

	it('moves, resizes, and renames a graphic frame through the model', async () => {
		// General graphic-frame editing (position/size/name/locks), not just
		// the `graphicFrameLocks` sub-feature: `presentation:element:graphicFrame`
		// was graded edit:"partial" because only the lock facet had a test,
		// even though the generic element writer (`applyTransform`,
		// `applyNameToCnvPr`, `serializeShapeLocks`) already handles every
		// `p:nvGraphicFramePr`-shaped element the same way it handles a
		// `p:sp`. This proves that generic path for a chart's `p:xfrm`,
		// `p:cNvPr/@name`, and `a:graphicFrameLocks` together.
		const bytes = await deckWithSlideXml(CHART_FRAME);
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const chart = findByType(loaded.slides[0].elements, 'chart')!;

		chart.x = 50; // px
		chart.y = 10;
		chart.width = 300;
		chart.height = 200;
		chart.name = 'Renamed Chart';
		chart.locks = { ...chart.locks, noMove: true };

		const saved = await handler.save(loaded.slides);
		const xml = await slideXmlOf(saved);
		expect(xml).toContain('name="Renamed Chart"');
		expect(xml).toMatch(/<a:graphicFrameLocks[^>]*noMove="1"/u);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedChart = findByType(reloaded.slides[0].elements, 'chart')!;
		expect(reloadedChart.name).toBe('Renamed Chart');
		expect(reloadedChart.x).toBeCloseTo(50, 0);
		expect(reloadedChart.y).toBeCloseTo(10, 0);
		expect(reloadedChart.width).toBeCloseTo(300, 0);
		expect(reloadedChart.height).toBeCloseTo(200, 0);
		expect(reloadedChart.locks).toMatchObject({
			noMove: true,
			noSelect: true,
			noChangeAspect: true,
		});
	});

	it('persists a lock added to a chart through the model', async () => {
		const bytes = await deckWithSlideXml(CHART_FRAME);
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const chart = findByType(loaded.slides[0].elements, 'chart');
		expect(chart?.locks).toMatchObject({ noSelect: true, noChangeAspect: true });

		chart!.locks = { ...chart!.locks, noMove: true, noSelect: false };
		const saved = await handler.save(loaded.slides);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(findByType(reloaded.slides[0].elements, 'chart')?.locks).toMatchObject({
			noMove: true,
			noSelect: false,
			noChangeAspect: true,
		});
	});

	it('does NOT write a graphic-frame-only attribute onto a shape lock node', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addElement({
					id: 'drilldown-shape',
					type: 'shape',
					x: 10,
					y: 10,
					width: 100,
					height: 100,
					shapeType: 'rect',
					// `noDrilldown` is declared by CT_GraphicalObjectFrameLocking
					// only; CT_ShapeLocking has no such attribute.
					locks: { noMove: true, noDrilldown: true },
				})
				.build(),
		);
		const xml = await slideXmlOf(await handler.save(data.slides));
		expect(xml).toContain('<a:spLocks');
		expect(xml).not.toContain('noDrilldown');
	});

	it('persists a lock edited on a group nested inside another group', async () => {
		const bytes = await deckWithSlideXml(NESTED_GROUP);
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const outer = findByType(loaded.slides[0].elements, 'group') as GroupPptxElement | undefined;
		expect(outer).toBeDefined();
		const inner = outer!.children.find((c) => c.type === 'group') as GroupPptxElement | undefined;
		expect(inner).toBeDefined();

		inner!.locks = { ...inner!.locks, noMove: true, noSelect: true };
		const saved = await handler.save(loaded.slides);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const outerAgain = findByType(reloaded.slides[0].elements, 'group') as
			| GroupPptxElement
			| undefined;
		const innerAgain = outerAgain?.children.find((c) => c.type === 'group') as
			| GroupPptxElement
			| undefined;
		expect(innerAgain?.locks).toMatchObject({ noMove: true, noSelect: true });

		// `@noUngrp` has no model field, so it must survive as a carried-over
		// attribute on the rewritten node rather than being dropped.
		const xml = await slideXmlOf(saved);
		expect(xml).toMatch(/<a:grpSpLocks[^>]*noUngrp="1"/u);
	});
});
