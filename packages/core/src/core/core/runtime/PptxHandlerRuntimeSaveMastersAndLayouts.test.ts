/**
 * Tests for the slide-master, slide-layout, notes-master, and handout-master
 * save writers (ECMA-376 §19.3.1.42 / §19.3.1.40 / §19.3.1.27 / §19.3.1.24).
 *
 * Coverage:
 *   - Round-trip equality for unmutated parts (raw XML passthrough).
 *   - Typed mutations to `clrMap`, `@matchingName`, `@preserve`,
 *     `headerFooter` flags survive a load → mutate → save → reparse cycle.
 *   - Helpers (`applyHeaderFooterFlagsToNode`,
 *     `applyClrMapOverrideToLayoutRoot`, `applyBackgroundColorToCSld`)
 *     produce correct attribute / element output.
 */

import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../builders/sdk/PresentationBuilder';
import type { XmlObject } from '../../types';
import {
	applyBackgroundColorToCSld,
	applyClrMapOverrideToLayoutRoot,
	applyHeaderFooterFlagsToNode,
} from './master-save-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	preserveOrder: false,
	parseAttributeValue: false,
	parseTagValue: false,
	allowBooleanAttributes: true,
	trimValues: true,
});

async function loadSavedZipPart(bytes: Uint8Array, partPath: string): Promise<string | null> {
	const zip = await JSZip.loadAsync(bytes);
	const entry = zip.file(partPath);
	if (!entry) {
		return null;
	}
	return entry.async('string');
}

// ---------------------------------------------------------------------------
// Helper unit tests
// ---------------------------------------------------------------------------

describe('applyHeaderFooterFlagsToNode', () => {
	it('emits all four boolean attributes when flags are set', () => {
		const root: XmlObject = {};
		applyHeaderFooterFlagsToNode(root, {
			hasHeader: true,
			hasFooter: false,
			hasDateTime: true,
			hasSlideNumber: false,
		});
		expect(root['p:hf']).toStrictEqual({
			'@_hdr': '1',
			'@_ftr': '0',
			'@_dt': '1',
			'@_sldNum': '0',
		});
	});

	it('preserves an existing `<p:hf>` and only overrides explicit fields', () => {
		const root: XmlObject = {
			'p:hf': { '@_hdr': '0', '@_ftr': '0', '@_dt': '0', '@_sldNum': '0' },
		};
		applyHeaderFooterFlagsToNode(root, { hasHeader: true });
		expect(root['p:hf']).toStrictEqual({
			'@_hdr': '1',
			'@_ftr': '0',
			'@_dt': '0',
			'@_sldNum': '0',
		});
	});

	it('is a no-op when flags are undefined or empty', () => {
		const root: XmlObject = { 'p:hf': { '@_hdr': '0' } };
		applyHeaderFooterFlagsToNode(root, undefined);
		applyHeaderFooterFlagsToNode(root, {});
		expect(root['p:hf']).toStrictEqual({ '@_hdr': '0' });
	});
});

describe('applyClrMapOverrideToLayoutRoot', () => {
	it('emits `<a:masterClrMapping/>` when override is empty', () => {
		const root: XmlObject = {};
		applyClrMapOverrideToLayoutRoot(root, {});
		expect(root['p:clrMapOvr']).toStrictEqual({ 'a:masterClrMapping': {} });
	});

	it('emits `<a:overrideClrMapping>` with given attributes when populated', () => {
		const root: XmlObject = {};
		applyClrMapOverrideToLayoutRoot(root, { bg1: 'dk1', accent1: 'accent2' });
		const ovr = root['p:clrMapOvr'] as XmlObject;
		expect(ovr['a:overrideClrMapping']).toStrictEqual({
			'@_bg1': 'dk1',
			'@_accent1': 'accent2',
		});
	});

	it('is a no-op when override is undefined', () => {
		const root: XmlObject = { 'p:clrMapOvr': { 'a:masterClrMapping': {} } };
		applyClrMapOverrideToLayoutRoot(root, undefined);
		expect(root['p:clrMapOvr']).toStrictEqual({ 'a:masterClrMapping': {} });
	});
});

describe('applyBackgroundColorToCSld', () => {
	it('writes a solid-fill background when colour is provided', () => {
		const cSld: XmlObject = {};
		applyBackgroundColorToCSld(cSld, '#FF0000');
		expect(cSld['p:bg']).toStrictEqual({
			'p:bgPr': {
				'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
				'a:effectLst': {},
			},
		});
	});

	it('removes `<p:bg>` when called with empty string', () => {
		const cSld: XmlObject = { 'p:bg': { 'p:bgPr': {} } };
		applyBackgroundColorToCSld(cSld, '');
		expect(cSld['p:bg']).toBeUndefined();
	});

	it('is a no-op when colour is undefined', () => {
		const cSld: XmlObject = { 'p:bg': { 'p:bgPr': {} } };
		applyBackgroundColorToCSld(cSld, undefined);
		expect(cSld['p:bg']).toStrictEqual({ 'p:bgPr': {} });
	});
});

// ---------------------------------------------------------------------------
// End-to-end: round-trip through the save pipeline
// ---------------------------------------------------------------------------

describe('slide master save writer — end-to-end round-trip', () => {
	it('passthroughs an unmutated slide master byte-equally to a reparseable form', async () => {
		const { handler, data } = await PresentationBuilder.create();
		const saved = await handler.save(data.slides);
		const masterXml = await loadSavedZipPart(saved, 'ppt/slideMasters/slideMaster1.xml');
		expect(masterXml).toBeTruthy();
		// Required structural elements are intact.
		expect(masterXml).toContain('<p:sldMaster');
		expect(masterXml).toContain('<p:cSld');
		expect(masterXml).toContain('<p:clrMap');
	});

	it('applies typed clrMap mutations during save', async () => {
		const { handler, data } = await PresentationBuilder.create();
		expect(data.slideMasters?.length).toBeGreaterThanOrEqual(1);
		const master = data.slideMasters![0];

		// Override two aliases — the rest must fall back to the OOXML default
		// mapping so the emitted node is schema-complete.
		master.clrMap = { bg1: 'dk1', accent1: 'accent2' };

		const saved = await handler.save(data.slides, { slideMasters: data.slideMasters });
		const masterXml = await loadSavedZipPart(saved, master.path);
		expect(masterXml).toBeTruthy();
		const reparsed = parser.parse(masterXml!) as XmlObject;
		const clrMap = (reparsed['p:sldMaster'] as XmlObject)['p:clrMap'] as XmlObject;
		expect(clrMap['@_bg1']).toBe('dk1');
		expect(clrMap['@_accent1']).toBe('accent2');
		// Untouched aliases fall back to the spec defaults.
		expect(clrMap['@_tx1']).toBe('dk1');
		expect(clrMap['@_accent2']).toBe('accent2');
		expect(clrMap['@_hlink']).toBe('hlink');
		expect(clrMap['@_folHlink']).toBe('folHlink');
	});

	it('applies typed `headerFooter` mutations to the master', async () => {
		const { handler, data } = await PresentationBuilder.create();
		const master = data.slideMasters![0];
		master.headerFooter = { hasHeader: false, hasSlideNumber: false };

		const saved = await handler.save(data.slides, { slideMasters: data.slideMasters });
		const masterXml = await loadSavedZipPart(saved, master.path);
		const reparsed = parser.parse(masterXml!) as XmlObject;
		const hf = (reparsed['p:sldMaster'] as XmlObject)['p:hf'] as XmlObject;
		expect(hf['@_hdr']).toBe('0');
		expect(hf['@_sldNum']).toBe('0');
	});
});

describe('slide layout save writer — end-to-end round-trip', () => {
	it('preserves layout XML structure on passthrough', async () => {
		const { handler, data } = await PresentationBuilder.create();
		const saved = await handler.save(data.slides);
		const layoutPath = 'ppt/slideLayouts/slideLayout1.xml';
		const xml = await loadSavedZipPart(saved, layoutPath);
		expect(xml).toBeTruthy();
		expect(xml).toContain('<p:sldLayout');
		expect(xml).toContain('<p:cSld');
		expect(xml).toContain('<p:clrMapOvr');
	});

	it('persists `@matchingName`, `@preserve`, and `clrMapOverride` mutations', async () => {
		const { handler, data } = await PresentationBuilder.create();
		const master = data.slideMasters![0];
		expect(master.layouts?.length).toBeGreaterThanOrEqual(1);
		const layout = master.layouts![0];

		layout.matchingName = 'CustomTitleSlide';
		layout.preserve = true;
		layout.userDrawn = true;
		layout.clrMapOverride = { bg1: 'dk1', accent1: 'accent3' };
		layout.headerFooter = { hasFooter: false };

		const saved = await handler.save(data.slides, { slideLayouts: master.layouts });
		const xml = await loadSavedZipPart(saved, layout.path);
		expect(xml).toBeTruthy();
		const reparsed = parser.parse(xml!) as XmlObject;
		const root = reparsed['p:sldLayout'] as XmlObject;
		expect(root['@_matchingName']).toBe('CustomTitleSlide');
		expect(root['@_preserve']).toBe('1');
		expect(root['@_userDrawn']).toBe('1');
		const ovr = root['p:clrMapOvr'] as XmlObject;
		expect(ovr['a:overrideClrMapping']).toBeDefined();
		expect((ovr['a:overrideClrMapping'] as XmlObject)['@_bg1']).toBe('dk1');
		expect((ovr['a:overrideClrMapping'] as XmlObject)['@_accent1']).toBe('accent3');
		const hf = root['p:hf'] as XmlObject;
		expect(hf['@_ftr']).toBe('0');
	});

	it('switches `clrMapOverride` back to `<a:masterClrMapping/>` when set to empty', async () => {
		const { handler, data } = await PresentationBuilder.create();
		const master = data.slideMasters![0];
		const layout = master.layouts![0];
		layout.clrMapOverride = {};

		const saved = await handler.save(data.slides, { slideLayouts: master.layouts });
		const xml = await loadSavedZipPart(saved, layout.path);
		const reparsed = parser.parse(xml!) as XmlObject;
		const root = reparsed['p:sldLayout'] as XmlObject;
		const ovr = root['p:clrMapOvr'] as XmlObject;
		expect(ovr['a:masterClrMapping']).toBeDefined();
		expect(ovr['a:overrideClrMapping']).toBeUndefined();
	});
});

describe('notes/handout master save writer — direct part round-trip', () => {
	// PresentationBuilder.create() does not emit notesMaster/handoutMaster,
	// so we hand-craft a minimal package containing both and exercise the
	// writers via the load → mutate → save pipeline.

	async function buildMinimalPackageWithMasters(): Promise<ArrayBuffer> {
		const { handler, data } = await PresentationBuilder.create();
		const seed = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(seed);

		// Drop in minimal notesMaster and handoutMaster parts.
		const notesMasterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notesMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes body"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="2743200" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Master notes</a:t></a:r><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>
<p:pic><p:nvPicPr><p:cNvPr id="3" name="Logo"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="4572000" y="914400"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>
<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Unsupported frame"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></p:xfrm><a:graphic><a:graphicData uri="urn:test:unsupported"><test:payload xmlns:test="urn:test" value="preserved-frame"/></a:graphicData></a:graphic></p:graphicFrame>
</p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:notesStyle><a:lvl1pPr><a:defRPr/></a:lvl1pPr></p:notesStyle>
<p:extLst><p:ext uri="test-unknown"><test:payload xmlns:test="urn:test" value="kept"/></p:ext></p:extLst>
</p:notesMaster>`;
		const handoutMasterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:handoutMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="Footer"/><p:cNvSpPr/><p:nvPr><p:ph type="ftr" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="5943600"/><a:ext cx="2743200" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Handout footer</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
</p:handoutMaster>`;
		zip.file('ppt/notesMasters/notesMaster1.xml', notesMasterXml);
		zip.file('ppt/handoutMasters/handoutMaster1.xml', handoutMasterXml);
		zip.file(
			'ppt/notesMasters/_rels/notesMaster1.xml.rels',
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/master-logo.png"/></Relationships>`,
		);
		zip.file(
			'ppt/media/master-logo.png',
			Uint8Array.from(
				Buffer.from(
					'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4pQAAAAASUVORK5CYII=',
					'base64',
				),
			),
		);
		const out = await zip.generateAsync({ type: 'uint8array' });
		return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
	}

	it('round-trips notes master clrMap and headerFooter mutations', async () => {
		const buffer = await buildMinimalPackageWithMasters();
		const { PptxHandler } = await import('../../PptxHandler');
		const handler = new PptxHandler();
		const data = await handler.load(buffer);
		expect(data.notesMaster).toBeTruthy();

		const notes = data.notesMaster!;
		notes.clrMap = { bg1: 'dk1', tx1: 'lt1' };
		notes.headerFooter = { hasDateTime: false, hasSlideNumber: false };

		const saved = await handler.save(data.slides, { notesMaster: notes });
		const xml = await loadSavedZipPart(saved, notes.path);
		expect(xml).toBeTruthy();
		const reparsed = parser.parse(xml!) as XmlObject;
		const root = reparsed['p:notesMaster'] as XmlObject;
		const clrMap = root['p:clrMap'] as XmlObject;
		expect(clrMap['@_bg1']).toBe('dk1');
		expect(clrMap['@_tx1']).toBe('lt1');
		expect(clrMap['@_accent1']).toBe('accent1');
		const hf = root['p:hf'] as XmlObject;
		expect(hf['@_dt']).toBe('0');
		expect(hf['@_sldNum']).toBe('0');
	});

	it('loads and edits notes master placeholders and relationship-backed pictures', async () => {
		const buffer = await buildMinimalPackageWithMasters();
		const { PptxHandler } = await import('../../PptxHandler');
		const handler = new PptxHandler();
		const data = await handler.load(buffer);
		const notes = data.notesMaster!;

		expect(notes.elements).toHaveLength(3);
		expect(notes.clrMap).toMatchObject({ bg1: 'lt1', tx1: 'dk1', accent1: 'accent1' });
		expect(notes.elements?.some((element) => element.type === 'picture')).toBeTruthy();
		const body = notes.elements?.find((element) => element.type === 'text');
		expect(body).toBeDefined();
		if (body?.type === 'text') {
			body.text = 'Edited master notes';
			body.x = 150;
		}

		const saved = await handler.save(data.slides, { notesMaster: notes });
		const savedXml = await loadSavedZipPart(saved, notes.path);
		expect(savedXml).toContain('Edited master notes');
		expect(savedXml).toContain('test-unknown');
		expect(savedXml).toContain('value="kept"');
		expect(savedXml).toContain('preserved-frame');

		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		expect(reloaded.notesMaster?.elements).toHaveLength(3);
		expect(reloaded.notesMaster?.elements?.find((element) => element.type === 'text')?.x).toBe(150);
	});

	it('preserves `<p:notesStyle>` verbatim across mutations', async () => {
		const buffer = await buildMinimalPackageWithMasters();
		const { PptxHandler } = await import('../../PptxHandler');
		const handler = new PptxHandler();
		const data = await handler.load(buffer);
		const notes = data.notesMaster!;
		notes.headerFooter = { hasFooter: false };

		const saved = await handler.save(data.slides, { notesMaster: notes });
		const xml = await loadSavedZipPart(saved, notes.path);
		expect(xml).toContain('<p:notesStyle>');
		expect(xml).toContain('<a:lvl1pPr>');
	});

	it('round-trips handout master clrMap and headerFooter mutations', async () => {
		const buffer = await buildMinimalPackageWithMasters();
		const { PptxHandler } = await import('../../PptxHandler');
		const handler = new PptxHandler();
		const data = await handler.load(buffer);
		expect(data.handoutMaster).toBeTruthy();

		const handout = data.handoutMaster!;
		handout.clrMap = { bg1: 'dk1' };
		handout.headerFooter = { hasHeader: false };

		const saved = await handler.save(data.slides, { handoutMaster: handout });
		const xml = await loadSavedZipPart(saved, handout.path);
		expect(xml).toBeTruthy();
		const reparsed = parser.parse(xml!) as XmlObject;
		const root = reparsed['p:handoutMaster'] as XmlObject;
		const clrMap = root['p:clrMap'] as XmlObject;
		expect(clrMap['@_bg1']).toBe('dk1');
		const hf = root['p:hf'] as XmlObject;
		expect(hf['@_hdr']).toBe('0');
	});

	it('loads and edits handout master placeholder elements', async () => {
		const buffer = await buildMinimalPackageWithMasters();
		const { PptxHandler } = await import('../../PptxHandler');
		const handler = new PptxHandler();
		const data = await handler.load(buffer);
		const handout = data.handoutMaster!;
		expect(handout.elements).toHaveLength(1);
		const footer = handout.elements?.[0];
		if (footer?.type === 'text') {
			footer.text = 'Edited handout footer';
		}

		const saved = await handler.save(data.slides, { handoutMaster: handout });
		const savedXml = await loadSavedZipPart(saved, handout.path);
		expect(savedXml).toContain('Edited handout footer');
		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		expect(reloaded.handoutMaster?.elements?.[0]).toMatchObject({
			type: 'text',
			text: 'Edited handout footer',
		});
	});

	it('passes notes/handout masters through verbatim when no typed mutation is supplied', async () => {
		const buffer = await buildMinimalPackageWithMasters();
		const { PptxHandler } = await import('../../PptxHandler');
		const handler = new PptxHandler();
		const data = await handler.load(buffer);

		const saved = await handler.save(data.slides);
		const notesXml = await loadSavedZipPart(saved, 'ppt/notesMasters/notesMaster1.xml');
		const handoutXml = await loadSavedZipPart(saved, 'ppt/handoutMasters/handoutMaster1.xml');
		expect(notesXml).toContain('<p:notesStyle>');
		expect(handoutXml).toContain('<p:clrMap');
	});
});
