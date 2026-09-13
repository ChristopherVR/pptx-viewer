import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxHandoutMaster } from '../../core/types';

const HANDOUT_PATH = 'ppt/handoutMasters/handoutMaster1.xml';

describe('authored handout master package round-trip', () => {
	it.each(['notesMaster', 'handoutMaster'] as const)(
		'preserves %s native identities through no-op and edited saves',
		async (kind) => {
			const created = await PresentationBuilder.create({ initialSlideCount: 1 });
			created.data.slides[0].notes = 'Notes master fixture';
			const seed = await created.handler.save(created.data.slides, {
				handoutMaster: { path: HANDOUT_PATH },
			});
			const zip = await JSZip.loadAsync(seed);
			const partPath = kind === 'notesMaster' ? 'ppt/notesMasters/notesMaster1.xml' : HANDOUT_PATH;
			const part = await zip.file(partPath)!.async('string');
			const transform =
				'<a:xfrm><a:off x="95250" y="95250"/><a:ext cx="952500" cy="952500"/></a:xfrm>';
			const shape = `<p:sp><p:nvSpPr><p:cNvPr id="41" name="Native target"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${
				transform
			}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>`;
			const connector = `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="42" name="Native connection"/><p:cNvCxnSpPr><a:stCxn id="41" idx="1"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr>${
				transform
			}<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom></p:spPr></p:cxnSp>`;
			zip.file(partPath, part.replace('</p:spTree>', `${shape + connector}</p:spTree>`));
			const bytes = await zip.generateAsync({ type: 'uint8array' });
			const handler = new PptxHandler();
			const data = await handler.load(
				bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
			);
			const master = data[kind]!;
			const target = master.elements?.find((element) => element.name === 'Native target');
			expect(target?.shapeId).toBe('41');
			const options = { [kind]: master };
			const untouched = await handler.save(data.slides, options);
			const untouchedNative = await (
				await JSZip.loadAsync(untouched)
			)
				.file(partPath)!
				.async('string');
			expect(untouchedNative).toContain('id="41" name="Native target"');
			expect(untouchedNative).toContain('id="42" name="Native connection"');
			expect(untouchedNative).toContain('<a:stCxn id="41" idx="1"');
			if (!target) {
				throw new Error('expected native target');
			}
			target.x += 10;
			const edited = await handler.save(data.slides, options);
			const native = await (await JSZip.loadAsync(edited)).file(partPath)!.async('string');
			expect(native).toContain('id="41" name="Native target"');
			expect(native).toContain('id="42" name="Native connection"');
			expect(native).toContain('<a:stCxn id="41" idx="1"');
			handler.dispose();
			created.handler.dispose();
		},
	);

	it('creates and preserves the complete handout master OPC graph', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(createSlide('Blank').build());
		const handoutMaster: PptxHandoutMaster = {
			path: HANDOUT_PATH,
			backgroundColor: '#DDEEFF',
			slidesPerPage: 4,
			headerFooter: {
				hasHeader: false,
				hasFooter: true,
				hasDateTime: false,
				hasSlideNumber: true,
			},
		};

		const saved = await handler.save(data.slides, { handoutMaster });
		const zip = await JSZip.loadAsync(saved);
		const masterXml = await zip.file(HANDOUT_PATH)!.async('string');
		const masterRels = await zip
			.file('ppt/handoutMasters/_rels/handoutMaster1.xml.rels')!
			.async('string');
		const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');
		const presentationRels = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');
		const contentTypes = await zip.file('[Content_Types].xml')!.async('string');

		expect(masterXml).toContain('<p:handoutMaster');
		expect(masterXml).toContain('<a:srgbClr val="DDEEFF"');
		expect(masterXml).toContain('<p:hf hdr="0" ftr="1" dt="0" sldNum="1"');
		expect(masterRels).toContain('/relationships/theme');
		expect(masterRels).toContain('Target="../theme/theme1.xml"');
		expect(presentationXml).toMatch(
			/<p:handoutMasterIdLst><p:handoutMasterId r:id="rId\d+"><\/p:handoutMasterId><\/p:handoutMasterIdLst>/u,
		);
		expect(presentationXml.indexOf('<p:handoutMasterIdLst>')).toBeLessThan(
			presentationXml.indexOf('<p:sldIdLst>'),
		);
		expect(presentationRels).toContain('/relationships/handoutMaster');
		expect(presentationRels).toContain('Target="handoutMasters/handoutMaster1.xml"');
		expect(contentTypes).toContain(`PartName="/${HANDOUT_PATH}"`);
		expect(contentTypes).toContain(
			'ContentType="application/vnd.openxmlformats-officedocument.presentationml.handoutMaster+xml"',
		);

		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(saved.buffer as ArrayBuffer);
		expect(reloaded.handoutMaster).toMatchObject({
			path: HANDOUT_PATH,
			backgroundColor: '#DDEEFF',
			slidesPerPage: 4,
			headerFooter: {
				hasHeader: false,
				hasFooter: true,
				hasDateTime: false,
				hasSlideNumber: true,
			},
		});

		const resaved = await reloadHandler.save(reloaded.slides, {
			handoutMaster: reloaded.handoutMaster,
		});
		const reloadedAgain = await new PptxHandler().load(resaved.buffer as ArrayBuffer);
		expect(reloadedAgain.handoutMaster).toMatchObject({
			path: HANDOUT_PATH,
			backgroundColor: '#DDEEFF',
			slidesPerPage: 4,
		});
	});
});
