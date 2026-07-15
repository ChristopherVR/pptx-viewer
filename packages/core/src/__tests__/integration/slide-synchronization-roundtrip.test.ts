import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import { SLIDE_SYNC_CONTENT_TYPE } from '../../core/utils/slide-synchronization';

const REL_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideSyncData';
const PART_PATH = 'ppt/slideSyncData/slideSyncData1.xml';

async function buildSynchronizedDeck(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	const bytes = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(bytes);

	const relsPath = 'ppt/slides/_rels/slide1.xml.rels';
	const rels = await zip.file(relsPath)!.async('string');
	zip.file(
		relsPath,
		rels.replace(
			'</Relationships>',
			`<Relationship Id="rIdSync" Type="${REL_TYPE}" Target="../slideSyncData/slideSyncData1.xml"/></Relationships>`,
		),
	);
	zip.file(
		PART_PATH,
		`<p:sldSyncPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" serverSldId="server-1" serverSldModifiedTime="2026-01-02T03:04:05Z" clientInsertedTime="2026-01-01T00:00:00Z"><p:extLst><p:ext uri="keep-me"><x:payload xmlns:x="urn:test" value="preserved"/></p:ext></p:extLst></p:sldSyncPr>`,
	);
	const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
	zip.file(
		'[Content_Types].xml',
		contentTypes.replace(
			'</Types>',
			`<Override PartName="/${PART_PATH}" ContentType="${SLIDE_SYNC_CONTENT_TYPE}"/></Types>`,
		),
	);
	return zip.generateAsync({ type: 'uint8array' });
}

describe('slide synchronization data round-trip', () => {
	it('loads, reports, mutates, and preserves the related OPC part', async () => {
		const handler = new PptxHandler();
		const data = await handler.load((await buildSynchronizedDeck()).buffer as ArrayBuffer);
		const slide = data.slides[0];
		expect(slide.slideSynchronization).toMatchObject({
			serverSlideId: 'server-1',
			serverSlideModifiedTime: '2026-01-02T03:04:05Z',
			clientInsertedTime: '2026-01-01T00:00:00Z',
			partPath: PART_PATH,
			relationshipId: 'rIdSync',
		});
		expect(handler.getCompatibilityWarnings()).toStrictEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'SLIDE_SYNCHRONIZATION_METADATA', slideId: slide.id }),
			]),
		);

		slide.slideSynchronization!.serverSlideId = 'server-2';
		slide.slideSynchronization!.serverSlideModifiedTime = '2026-07-16T01:02:03Z';
		slide.isDirty = true;
		const saved = await handler.save(data.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const syncXml = await savedZip.file(PART_PATH)!.async('string');
		expect(syncXml).toContain('serverSldId="server-2"');
		expect(syncXml).toContain('serverSldModifiedTime="2026-07-16T01:02:03Z"');
		expect(syncXml).toContain('uri="keep-me"');
		expect(syncXml).toContain('value="preserved"');

		const rels = await savedZip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		expect(rels).toContain(REL_TYPE);
		expect(rels).toContain('../slideSyncData/slideSyncData1.xml');
		const contentTypes = await savedZip.file('[Content_Types].xml')!.async('string');
		expect(contentTypes).toContain(`PartName="/${PART_PATH}"`);
		expect(contentTypes).toContain(SLIDE_SYNC_CONTENT_TYPE);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.slides[0].slideSynchronization?.serverSlideId).toBe('server-2');
	});

	it('creates the relationship, part, and content type from typed metadata', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slide = createSlide('Blank').build();
		slide.slideSynchronization = {
			serverSlideId: 'created-server',
			serverSlideModifiedTime: '2026-07-16T02:00:00Z',
			clientInsertedTime: '2026-07-16T01:00:00Z',
		};
		data.slides.push(slide);
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const syncXml = await zip.file(PART_PATH)!.async('string');
		expect(syncXml).toContain('serverSldId="created-server"');
		const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		expect(rels).toContain('/slideSyncData');
		const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
		expect(contentTypes).toContain(SLIDE_SYNC_CONTENT_TYPE);
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.slides[0].slideSynchronization?.serverSlideId).toBe('created-server');
	});
});
