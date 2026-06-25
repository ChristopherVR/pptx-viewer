/**
 * Round-trip guard for editing master / layout ("template") elements.
 *
 * Background: the slide loader merges the decorative shapes a slide inherits
 * from its layout and master into `slide.elements`, giving each a `layout-` /
 * `master-` prefixed id (master shapes behind, layout shapes on top). Those
 * same elements are also exposed directly via
 * {@link PptxHandler.getTemplateElementsForSlide}. The save writer has a
 * template branch (see `PptxHandlerRuntimeSaveElementWriter`) that writes an
 * edited template element's shape XML back into the owning master / layout
 * `p:spTree`, which the save pipeline then flushes to the ZIP.
 *
 * The committed fixtures (`PresentationBuilder.create()` and the e2e decks)
 * carry layout / master `spTree`s that contain only the group-shape envelope
 * with no decorative `<p:sp>` / `<p:pic>` / `<p:graphicFrame>`, so they expose
 * ZERO template elements. That is correct behaviour, not a bug: there is
 * nothing to inherit. To exercise the editing path this test seeds a deck and
 * injects a decorative shape into both the layout (`slideLayout7.xml`, the
 * "Blank" layout the seed slide uses) and the master (`slideMaster1.xml`),
 * then drives the full load -> read template elements -> mutate -> save ->
 * reload cycle.
 */
import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement, XmlObject } from '../../core/types';

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	preserveOrder: false,
	parseAttributeValue: false,
	parseTagValue: false,
	allowBooleanAttributes: true,
	trimValues: true,
});

const LAYOUT_PATH = 'ppt/slideLayouts/slideLayout7.xml';
const MASTER_PATH = 'ppt/slideMasters/slideMaster1.xml';

/**
 * Build a decorative `<p:sp>` (text box) with the given shape id, name,
 * position (EMU), and run text. Lands as a sibling of the group envelope in a
 * `p:spTree`.
 */
function decorativeShapeXml(
	id: number,
	name: string,
	xEmu: number,
	yEmu: number,
	text: string,
): string {
	return (
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"></p:cNvPr>` +
		`<p:cNvSpPr></p:cNvSpPr><p:nvPr></p:nvPr></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${xEmu}" y="${yEmu}"></a:off>` +
		`<a:ext cx="1828800" cy="457200"></a:ext></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst></a:avLst></a:prstGeom></p:spPr>` +
		`<p:txBody><a:bodyPr></a:bodyPr><a:lstStyle></a:lstStyle>` +
		`<a:p><a:r><a:rPr lang="en-US"></a:rPr><a:t>${text}</a:t></a:r></a:p>` +
		`</p:txBody></p:sp>`
	);
}

/**
 * Seed a deck, inject a decorative shape into the layout the seed slide uses
 * and into the master, and return the repackaged bytes as an ArrayBuffer.
 */
async function buildDeckWithTemplateShapes(): Promise<ArrayBuffer> {
	const { handler, data } = await PresentationBuilder.create({ initialSlideCount: 1 });
	const seed = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(seed);

	const layoutXml = await zip.file(LAYOUT_PATH)!.async('string');
	const masterXml = await zip.file(MASTER_PATH)!.async('string');

	const layoutShape = decorativeShapeXml(90, 'LayoutLogo', 100000, 200000, 'LAYOUT-ORIG');
	const masterShape = decorativeShapeXml(91, 'MasterLogo', 300000, 400000, 'MASTER-ORIG');

	const patchedLayout = layoutXml.replace('</p:spTree>', `${layoutShape}</p:spTree>`);
	const patchedMaster = masterXml.replace('</p:spTree>', `${masterShape}</p:spTree>`);
	zip.file(LAYOUT_PATH, patchedLayout);
	zip.file(MASTER_PATH, patchedMaster);

	const out = await zip.generateAsync({ type: 'uint8array' });
	return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

async function loadSavedPart(bytes: Uint8Array, partPath: string): Promise<string | null> {
	const zip = await JSZip.loadAsync(bytes);
	const entry = zip.file(partPath);
	return entry ? entry.async('string') : null;
}

/** Locate a `<p:sp>` in a parsed spTree by its `@_name`. */
function findSpByName(spTree: XmlObject | undefined, name: string): XmlObject | undefined {
	const raw = spTree?.['p:sp'];
	const shapes = Array.isArray(raw) ? raw : raw ? [raw] : [];
	return (shapes as XmlObject[]).find((sp) => {
		const nv = sp['p:nvSpPr'] as XmlObject | undefined;
		const cNvPr = nv?.['p:cNvPr'] as XmlObject | undefined;
		return cNvPr?.['@_name'] === name;
	});
}

function spText(sp: XmlObject | undefined): string | undefined {
	const txBody = sp?.['p:txBody'] as XmlObject | undefined;
	const p = txBody?.['a:p'] as XmlObject | undefined;
	const r = p?.['a:r'] as XmlObject | undefined;
	const t = r?.['a:t'];
	return t === undefined || t === null ? undefined : String(t);
}

function spOffsetX(sp: XmlObject | undefined): string | undefined {
	const spPr = sp?.['p:spPr'] as XmlObject | undefined;
	const xfrm = spPr?.['a:xfrm'] as XmlObject | undefined;
	const off = xfrm?.['a:off'] as XmlObject | undefined;
	const x = off?.['@_x'];
	return x === undefined || x === null ? undefined : String(x);
}

describe('template element editing round-trip', () => {
	it('exposes inherited master + layout shapes with prefixed ids', async () => {
		const buffer = await buildDeckWithTemplateShapes();
		const handler = new PptxHandler();
		const data = await handler.load(buffer);
		const slide = data.slides[0];

		// Via the merged slide.elements:
		const mergedTemplate = slide.elements.filter(
			(e) => e.id.startsWith('layout-') || e.id.startsWith('master-'),
		);
		expect(mergedTemplate.length).toBeGreaterThanOrEqual(2);

		// Via the dedicated API:
		const apiTemplate = await handler.getTemplateElementsForSlide(slide.id);
		const layoutEl = apiTemplate.find((e) => e.id.startsWith('layout-'));
		const masterEl = apiTemplate.find((e) => e.id.startsWith('master-'));
		expect(layoutEl, 'layout element present').toBeTruthy();
		expect(masterEl, 'master element present').toBeTruthy();
		expect(layoutEl?.type).toBe('text');
		expect('text' in layoutEl! ? layoutEl.text : undefined).toBe('LAYOUT-ORIG');
		expect('text' in masterEl! ? masterEl.text : undefined).toBe('MASTER-ORIG');
	});

	it('persists geometry + text edits to the owning layout and master parts', async () => {
		const buffer = await buildDeckWithTemplateShapes();
		const handler = new PptxHandler();
		const data = await handler.load(buffer);
		const slide = data.slides[0];

		// Work directly from the merged slide.elements (this is what a binding
		// keeps and re-passes to save).
		const layoutEl = slide.elements.find((e) => e.id.startsWith('layout-')) as
			| PptxElement
			| undefined;
		const masterEl = slide.elements.find((e) => e.id.startsWith('master-')) as
			| PptxElement
			| undefined;
		expect(layoutEl).toBeTruthy();
		expect(masterEl).toBeTruthy();

		// Mutate geometry AND text on both template elements.
		layoutEl!.x = 999;
		layoutEl!.y = 111;
		if ('text' in layoutEl!) {
			layoutEl.text = 'LAYOUT-EDITED';
		}
		masterEl!.x = 888;
		if ('text' in masterEl!) {
			masterEl.text = 'MASTER-EDITED';
		}

		const saved = await handler.save(data.slides);

		// Inspect the saved layout / master parts directly.
		const layoutXml = await loadSavedPart(saved, LAYOUT_PATH);
		const masterXml = await loadSavedPart(saved, MASTER_PATH);
		expect(layoutXml).toBeTruthy();
		expect(masterXml).toBeTruthy();

		const layoutTree = (
			(parser.parse(layoutXml!)['p:sldLayout'] as XmlObject)['p:cSld'] as XmlObject
		)['p:spTree'] as XmlObject;
		const masterTree = (
			(parser.parse(masterXml!)['p:sldMaster'] as XmlObject)['p:cSld'] as XmlObject
		)['p:spTree'] as XmlObject;

		const savedLayoutSp = findSpByName(layoutTree, 'LayoutLogo');
		const savedMasterSp = findSpByName(masterTree, 'MasterLogo');
		expect(savedLayoutSp, 'layout shape still present').toBeTruthy();
		expect(savedMasterSp, 'master shape still present').toBeTruthy();

		// Text edits landed.
		expect(spText(savedLayoutSp)).toBe('LAYOUT-EDITED');
		expect(spText(savedMasterSp)).toBe('MASTER-EDITED');

		// Geometry edits landed (x stored in EMU, so it must differ from the
		// original 100000 / 300000 injected offsets).
		expect(spOffsetX(savedLayoutSp)).not.toBe('100000');
		expect(spOffsetX(savedMasterSp)).not.toBe('300000');

		// The shape was edited in place, not duplicated.
		const layoutShapes = Array.isArray(layoutTree['p:sp'])
			? (layoutTree['p:sp'] as XmlObject[])
			: [layoutTree['p:sp'] as XmlObject];
		expect(layoutShapes.filter((sp) => findSpByName({ 'p:sp': sp }, 'LayoutLogo'))).toHaveLength(1);
	});

	it('reloads the edited template geometry + text', async () => {
		const buffer = await buildDeckWithTemplateShapes();
		const handler = new PptxHandler();
		const data = await handler.load(buffer);
		const slide = data.slides[0];

		const layoutEl = slide.elements.find((e) => e.id.startsWith('layout-'))!;
		layoutEl.x = 555;
		layoutEl.y = 666;
		if ('text' in layoutEl) {
			layoutEl.text = 'LAYOUT-RELOADED';
		}

		const saved = await handler.save(data.slides);

		// Reload from the saved bytes and confirm the edit is visible.
		const handler2 = new PptxHandler();
		const reloaded = await handler2.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const reLayoutEl = reloaded.slides[0].elements.find((e) => e.id.startsWith('layout-'))!;
		expect('text' in reLayoutEl ? reLayoutEl.text : undefined).toBe('LAYOUT-RELOADED');
		expect(reLayoutEl.x).toBeCloseTo(555, 0);
		expect(reLayoutEl.y).toBeCloseTo(666, 0);
	});

	it('does not disturb slide-authored content or unmutated template parts', async () => {
		const buffer = await buildDeckWithTemplateShapes();
		const handler = new PptxHandler();
		const data = await handler.load(buffer);
		const slide = data.slides[0];

		// Capture the master shape's original text; we only edit the LAYOUT
		// element this time, so the master part must round-trip verbatim for the
		// shape we never touched.
		const masterElBefore = slide.elements.find((e) => e.id.startsWith('master-'))!;
		const masterTextBefore = 'text' in masterElBefore ? masterElBefore.text : undefined;

		// Snapshot the count of non-template (slide-authored) elements.
		const slideAuthoredBefore = slide.elements.filter(
			(e) => !e.id.startsWith('layout-') && !e.id.startsWith('master-'),
		).length;

		const layoutEl = slide.elements.find((e) => e.id.startsWith('layout-'))!;
		layoutEl.x = 1234;

		const saved = await handler.save(data.slides);

		// The master shape we never edited keeps its original text.
		const masterXml = await loadSavedPart(saved, MASTER_PATH);
		const masterTree = (
			(parser.parse(masterXml!)['p:sldMaster'] as XmlObject)['p:cSld'] as XmlObject
		)['p:spTree'] as XmlObject;
		expect(spText(findSpByName(masterTree, 'MasterLogo'))).toBe(masterTextBefore);

		// Reload and confirm the slide-authored element count is unchanged.
		const handler2 = new PptxHandler();
		const reloaded = await handler2.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const slideAuthoredAfter = reloaded.slides[0].elements.filter(
			(e) => !e.id.startsWith('layout-') && !e.id.startsWith('master-'),
		).length;
		expect(slideAuthoredAfter).toBe(slideAuthoredBefore);
	});
});
