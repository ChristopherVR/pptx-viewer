/**
 * Round-trip coverage for two slide-part attributes the loader dropped:
 * `p:cSld/@name` and `p:graphicFrame/.../p:ph`.
 */
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

const SLIDE = 'ppt/slides/slide1.xml';

async function buildDeck(): Promise<Uint8Array> {
	const built = await PresentationBuilder.create({ initialSlideCount: 1 });
	return built.handler.save(built.data.slides);
}

async function patchSlide(bytes: Uint8Array, edit: (xml: string) => string): Promise<ArrayBuffer> {
	const zip = await JSZip.loadAsync(bytes);
	const xml = await zip.file(SLIDE)!.async('string');
	zip.file(SLIDE, edit(xml));
	return zip.generateAsync({ type: 'arraybuffer' });
}

async function readSlideXml(bytes: Uint8Array): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	return zip.file(SLIDE)!.async('string');
}

const TABLE_FRAME =
	'<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="40" name="Table 1"/>' +
	'<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>' +
	'<p:nvPr><p:ph type="tbl" idx="1"/></p:nvPr></p:nvGraphicFramePr>' +
	'<p:xfrm><a:off x="914400" y="914400"/><a:ext cx="1828800" cy="914400"/></p:xfrm>' +
	'<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">' +
	'<a:tbl><a:tblPr/><a:tblGrid><a:gridCol w="1828800"/></a:tblGrid>' +
	'<a:tr h="914400"><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>cell</a:t></a:r></a:p></a:txBody>' +
	'</a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>';

describe('p:cSld/@name round trip', () => {
	it('loads the name, writes a rename, and drops the attribute when cleared', async () => {
		const seeded = await patchSlide(await buildDeck(), (xml) =>
			xml.replace('<p:cSld>', '<p:cSld name="Agenda">'),
		);
		const handler = new PptxHandler();
		const data = await handler.load(seeded);
		expect(data.slides[0].name).toBe('Agenda');

		const renamed = await handler.save([{ ...data.slides[0], name: 'Renamed' }]);
		await expect(readSlideXml(renamed)).resolves.toContain('name="Renamed"');
		const reloaded = await new PptxHandler().load(renamed.buffer as ArrayBuffer);
		expect(reloaded.slides[0].name).toBe('Renamed');

		const cleared = await handler.save([{ ...data.slides[0], name: '' }]);
		await expect(readSlideXml(cleared)).resolves.not.toMatch(/<p:cSld[^>]*\bname=/);
	});
});

describe('p:graphicFrame placeholder round trip', () => {
	it('surfaces the placeholder type and keeps p:ph through a save', async () => {
		const seeded = await patchSlide(await buildDeck(), (xml) =>
			xml.replace('</p:spTree>', `${TABLE_FRAME}</p:spTree>`),
		);
		const handler = new PptxHandler();
		const data = await handler.load(seeded);
		const table = data.slides[0].elements.find((element) => element.type === 'table');
		expect(table).toBeDefined();
		expect(table?.placeholderType).toBe('tbl');

		const saved = await handler.save(data.slides);
		await expect(readSlideXml(saved)).resolves.toMatch(/<p:ph type="tbl" idx="1"\/>/);
	});
});
