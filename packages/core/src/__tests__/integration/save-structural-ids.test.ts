/**
 * Last-export structural-id gate (`PptxHandlerRuntimeSaveStructuralIds`).
 *
 * The save pipeline passes an UNEDITED slide through byte-for-byte on purpose,
 * so a slide that already carried an invalid or duplicated `p:cNvPr/@id` (or a
 * mis-cased `p:ph/@type`) when it was loaded used to stay that way forever
 * unless the user happened to edit it. These tests seed such defects straight
 * into the package XML, load, save WITHOUT touching the slides, and check the
 * repair, while a valid deck must still round-trip its slide parts
 * byte-identically.
 */
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

const SLIDE1 = 'ppt/slides/slide1.xml';
const SLIDE2 = 'ppt/slides/slide2.xml';

function shapeXml(id: string, name: string, x = 914400): string {
	return (
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${x}" y="914400"/><a:ext cx="914400" cy="914400"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
		`<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${name}</a:t></a:r></a:p></p:txBody></p:sp>`
	);
}

/** A one-effect main sequence whose `p:spTgt` targets `spid`. */
function timingXml(spid: string): string {
	return (
		'<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>' +
		'<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>' +
		'<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>' +
		'<p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
		'<p:par><p:cTn id="5" presetID="1" presetClass="entr" presetSubtype="0" fill="hold" nodeType="clickEffect">' +
		'<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
		'<p:set><p:cBhvr><p:cTn id="6" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>' +
		`<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>` +
		'</p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>' +
		'</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn>' +
		'<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>' +
		'<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>' +
		'</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>'
	);
}

async function seedDeck(patch: (zip: JSZip) => Promise<void>): Promise<ArrayBuffer> {
	const { handler, data } = await PresentationBuilder.create({ initialSlideCount: 2 });
	const seed = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(seed);
	await patch(zip);
	const out = await zip.generateAsync({ type: 'uint8array' });
	return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

async function patchPart(zip: JSZip, path: string, edit: (xml: string) => string): Promise<void> {
	const xml = await zip.file(path)!.async('string');
	const next = edit(xml);
	expect(next).not.toBe(xml);
	zip.file(path, next);
}

async function saveUntouched(
	buffer: ArrayBuffer,
): Promise<{ handler: PptxHandler; zip: JSZip; slides: import('../../core/types').PptxSlide[] }> {
	const handler = new PptxHandler();
	const data = await handler.load(buffer);
	const saved = await handler.save(data.slides);
	return { handler, zip: await JSZip.loadAsync(saved), slides: data.slides };
}

const cNvPrIds = (xml: string): string[] =>
	Array.from(xml.matchAll(/<p:cNvPr\b[^>]*?\sid="([^"]*)"/gu), (m) => m[1]);

const idOfNamed = (xml: string, name: string): string | undefined =>
	xml.match(new RegExp(`<p:cNvPr\\b[^>]*?\\sid="([^"]*)"[^>]*?\\sname="${name}"`, 'u'))?.[1];

describe('save: structural shape-id gate on untouched parts', () => {
	it('renumbers a duplicated id on an unedited slide and keeps the animation target on the renumbered shape', async () => {
		const buffer = await seedDeck(async (zip) => {
			await patchPart(zip, SLIDE1, (xml) =>
				xml
					.replace(
						'</p:spTree>',
						`${shapeXml('5', 'DupA')}${shapeXml('5', 'DupB', 2743200)}</p:spTree>`,
					)
					.replace('</p:sld>', `${timingXml('5')}</p:sld>`),
			);
		});
		const { handler, zip, slides } = await saveUntouched(buffer);
		const slide1 = await zip.file(SLIDE1)!.async('string');

		const ids = cNvPrIds(slide1);
		expect(new Set(ids).size).toBe(ids.length);
		expect(idOfNamed(slide1, 'DupA')).toBe('5');
		const renumbered = idOfNamed(slide1, 'DupB');
		expect(renumbered).toBeDefined();
		expect(renumbered).not.toBe('5');
		expect(slide1).toContain(`<p:spTgt spid="${renumbered}"/>`);
		expect(slide1).not.toContain('<p:spTgt spid="5"/>');

		// The live model followed the repair, so a second save of the same handler
		// (still untouched) is stable and stays valid.
		const dupB = slides[0].elements.find((el) => 'name' in el && el.name === 'DupB');
		const rawId = (
			dupB?.rawXml as { 'p:nvSpPr'?: { 'p:cNvPr'?: { '@_id'?: string } } } | undefined
		)?.['p:nvSpPr']?.['p:cNvPr']?.['@_id'];
		expect(rawId).toBe(renumbered);
		const again = await JSZip.loadAsync(await handler.save(slides));
		await expect(again.file(SLIDE1)!.async('string')).resolves.toBe(slide1);
	});

	it('repairs an out-of-range id on an unedited, non-dirty slide', async () => {
		const buffer = await seedDeck(async (zip) => {
			await patchPart(zip, SLIDE2, (xml) =>
				xml.replace('</p:spTree>', `${shapeXml('4294967296', 'TooBig')}</p:spTree>`),
			);
		});
		const { zip, slides } = await saveUntouched(buffer);
		expect(slides[1].isDirty).toBeFalsy();
		const slide2 = await zip.file(SLIDE2)!.async('string');
		expect(slide2).not.toContain('id="4294967296"');
		expect(slide2).toContain('name="TooBig"');
		for (const id of cNvPrIds(slide2)) {
			const value = Number(id);
			expect(Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff).toBeTruthy();
		}
	});

	it('round-trips the slide parts of a valid untouched deck byte-identically', async () => {
		const buffer = await seedDeck(async (zip) => {
			await patchPart(zip, SLIDE1, (xml) =>
				xml.replace(
					'</p:spTree>',
					`${shapeXml('5', 'Fine')}${shapeXml('6', 'AlsoFine', 2743200)}</p:spTree>`,
				),
			);
		});
		const source = await JSZip.loadAsync(buffer);
		const { zip } = await saveUntouched(buffer);
		for (const path of [SLIDE1, SLIDE2]) {
			await expect(zip.file(path)!.async('string')).resolves.toBe(
				await source.file(path)!.async('string'),
			);
		}
	});

	it('canonicalizes a mis-cased placeholder type on an unedited slide', async () => {
		const buffer = await seedDeck(async (zip) => {
			await patchPart(zip, SLIDE1, (xml) =>
				xml.replace(
					'</p:spTree>',
					'<p:sp><p:nvSpPr><p:cNvPr id="7" name="Title 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
						'<p:nvPr><p:ph type="ctrtitle"/></p:nvPr></p:nvSpPr><p:spPr/>' +
						'<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Hello</a:t></a:r></a:p></p:txBody></p:sp></p:spTree>',
				),
			);
		});
		const { zip } = await saveUntouched(buffer);
		const slide1 = await zip.file(SLIDE1)!.async('string');
		expect(slide1).toContain('<p:ph type="ctrTitle"/>');
		expect(slide1).not.toContain('ctrtitle');
	});
});
