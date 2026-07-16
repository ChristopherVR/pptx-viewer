import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxHandoutMaster } from '../../core/types';

const HANDOUT_PATH = 'ppt/handoutMasters/handoutMaster1.xml';

describe('authored handout master package round-trip', () => {
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
