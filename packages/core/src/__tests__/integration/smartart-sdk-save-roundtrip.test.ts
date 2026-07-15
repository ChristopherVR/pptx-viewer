import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement, SmartArtPptxElement } from '../../core/types/elements';
import type { SmartArtLayout } from '../../core/types/smart-art';

/**
 * Regression tests for SDK-created SmartArt being silently dropped on save.
 *
 * Before the fix, inserting SmartArt via the viewer produced a
 * `SmartArtPptxElement` with only in-memory `smartArtData` (no `rawXml`, no
 * diagram parts). `processSlideElement` had fabrication branches for
 * text/shape/connector/ink/table/chart/ole but none for `smartArt`, so the
 * element hit `SAVE_ELEMENT_SKIPPED` and vanished from the saved file: the
 * exact "SmartArt doesn't render at all in PowerPoint" symptom.
 */

const GUID_RE = /\{[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}\}/u;

function makeInsertedSmartArt(layout: SmartArtLayout, parented: boolean): SmartArtPptxElement {
	const ids = ['a', 'b', 'c'].map((s, i) => `node-1751600000000-${i}-${s}bc123`);
	return {
		id: 'element-inserted-smartart',
		type: 'smartArt',
		x: 100,
		y: 80,
		width: 620,
		height: 380,
		smartArtData: {
			layout,
			colorScheme: 'colorful1',
			style: 'flat',
			nodes: [
				{ id: ids[0], text: 'Alpha' },
				{ id: ids[1], text: 'Beta', ...(parented ? { parentId: ids[0] } : {}) },
				{ id: ids[2], text: 'Gamma & <Delta>', ...(parented ? { parentId: ids[0] } : {}) },
			],
		},
	} as SmartArtPptxElement;
}

async function saveWithInsertedSmartArt(layout: SmartArtLayout, parented = false) {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	data.slides[0].elements.push(makeInsertedSmartArt(layout, parented) as PptxElement);
	const savedBytes = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(savedBytes);
	return { savedBytes, zip };
}

describe('sDK-created SmartArt survives save round-trip', () => {
	it('writes the graphic frame, all four diagram parts, rels, and content types', async () => {
		const { zip } = await saveWithInsertedSmartArt('basicBlockList');

		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toContain('<p:graphicFrame');
		expect(slideXml).toContain('http://schemas.openxmlformats.org/drawingml/2006/diagram');
		expect(slideXml).toMatch(/<dgm:relIds[^>]*r:dm="rId\d+"/u);
		expect(slideXml).toMatch(/<dgm:relIds[^>]*r:cs="rId\d+"/u);

		for (const part of ['data1', 'layout1', 'quickStyle1', 'colors1']) {
			expect(zip.file(`ppt/diagrams/${part}.xml`), `missing ppt/diagrams/${part}.xml`).toBeTruthy();
		}

		const relsXml = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		expect(relsXml).toContain('relationships/diagramData');
		expect(relsXml).toContain('relationships/diagramLayout');
		expect(relsXml).toContain('relationships/diagramQuickStyle');
		expect(relsXml).toContain('relationships/diagramColors');

		const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
		expect(contentTypes).toContain('drawingml.diagramData+xml');
		expect(contentTypes).toContain('drawingml.diagramLayout+xml');
		expect(contentTypes).toContain('drawingml.diagramStyle+xml');
		expect(contentTypes).toContain('drawingml.diagramColors+xml');
	});

	it('fabricates a schema-safe data model: GUID model ids, parOf wiring, escaped text', async () => {
		const { zip } = await saveWithInsertedSmartArt('basicBlockList');
		const dataXml = await zip.file('ppt/diagrams/data1.xml')!.async('string');

		// Informal editor node ids (node-<timestamp>-…) must be remapped:
		// PowerPoint rejects non-{GUID} model ids as a corrupt file.
		expect(dataXml).not.toContain('node-1751600000000');
		expect(dataXml).toMatch(GUID_RE);

		expect(dataXml).toContain('type="doc"');
		expect(dataXml).toContain('type="parTrans"');
		expect(dataXml).toContain('type="sibTrans"');
		expect(dataXml).toContain('<a:t>Alpha</a:t>');
		expect(dataXml).toContain('<a:t>Gamma &amp; &lt;Delta&gt;</a:t>');
		expect(dataXml.match(/<dgm:cxn /gu) ?? []).toHaveLength(6);
		expect(dataXml.match(/type="pres"/gu) ?? []).toHaveLength(3);
		expect(dataXml).toMatch(/parTransId="\{/u);
		expect(dataXml).toMatch(/sibTransId="\{/u);
	});

	it('maps layout presets to the fabricated layout families', async () => {
		const hierarchy = await saveWithInsertedSmartArt('hierarchy', true);
		const hierarchyLayout = await hierarchy.zip.file('ppt/diagrams/layout1.xml')!.async('string');
		expect(hierarchyLayout).toContain('urn:pptx-viewer/layout/hierarchy');
		expect(hierarchyLayout).toContain('<dgm:alg type="hierChild">');
		expect(hierarchyLayout).toContain('<dgm:alg type="hierRoot"/>');

		const cycle = await saveWithInsertedSmartArt('basicCycle');
		const cycleLayout = await cycle.zip.file('ppt/diagrams/layout1.xml')!.async('string');
		expect(cycleLayout).toContain('urn:pptx-viewer/layout/basicCycle');
		expect(cycleLayout).toContain('<dgm:title val="Basic Cycle"/>');
		expect(cycleLayout).toContain('<dgm:alg type="cycle">');

		const process = await saveWithInsertedSmartArt('continuousBlockProcess');
		const processLayout = await process.zip.file('ppt/diagrams/layout1.xml')!.async('string');
		expect(processLayout).toContain('urn:pptx-viewer/layout/continuousBlockProcess');
		expect(processLayout).toContain('val="fromL"');
	});

	it('reload preserves node text and hierarchy parent wiring', async () => {
		const { savedBytes } = await saveWithInsertedSmartArt('hierarchy', true);
		const reloader = new PptxHandler();
		const reloaded = await reloader.load(savedBytes.buffer as ArrayBuffer);

		const el = reloaded.slides[0].elements.find((e) => e.type === 'smartArt') as
			| SmartArtPptxElement
			| undefined;
		expect(el, 'reloaded slide is missing the SmartArt element').toBeDefined();
		expect(el!.smartArtData?.dataRelId).toBeTruthy();
		// The layout family must survive the round-trip via the layout part's
		// catLst/uniqueId (the part filename alone carries no signal).
		expect(el!.smartArtData?.resolvedLayoutType).toBe('hierarchy');

		const nodes = el!.smartArtData!.nodes;
		expect(nodes.map((n) => n.text)).toStrictEqual(['Alpha', 'Beta', 'Gamma & <Delta>']);
		const alpha = nodes.find((n) => n.text === 'Alpha')!;
		const beta = nodes.find((n) => n.text === 'Beta')!;
		expect(beta.parentId).toBe(alpha.id);
		expect(alpha.id).toMatch(GUID_RE);
	});

	it('picks the next free diagram part index when parts already exist', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(createSlide('Blank').build());
		data.slides[0].elements.push(makeInsertedSmartArt('basicBlockList', false) as PptxElement);
		const second = makeInsertedSmartArt('basicCycle', false);
		second.id = 'element-inserted-smartart-2';
		second.x = 300;
		data.slides[0].elements.push(second as PptxElement);

		const savedBytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(savedBytes);
		for (const part of ['data1', 'data2', 'layout1', 'layout2', 'colors1', 'colors2']) {
			expect(zip.file(`ppt/diagrams/${part}.xml`), `missing ppt/diagrams/${part}.xml`).toBeTruthy();
		}
	});
});
