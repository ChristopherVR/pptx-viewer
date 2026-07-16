import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxCustomerData } from '../../core/types';

async function createDeck() {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	return { handler, slides: data.slides };
}

describe('customer data package authoring', () => {
	it('authors presentation customer data with collision-free parts and schema ordering', async () => {
		const initial = await createDeck();
		const seed = await initial.handler.save(initial.slides);
		const seedZip = await JSZip.loadAsync(seed);
		seedZip.file('customXml/item1.xml', '<existing>keep</existing>');
		const seeded = await seedZip.generateAsync({ type: 'uint8array' });
		const handler = new PptxHandler();
		const loaded = await handler.load(seeded.buffer as ArrayBuffer);
		const customerData: PptxCustomerData[] = [
			{
				data: '<deck-data><id>deck-123</id></deck-data>',
				rawXml: {
					'@_customAttr': 'preserve-me',
					'p:extLst': { 'p:ext': { '@_uri': 'urn:customer-data:keep' } },
				},
			},
		];
		const saved = await handler.save(loaded.slides, { customerData });
		const zip = await JSZip.loadAsync(saved);
		expect(customerData[0]).toMatchObject({
			id: 'customXml/item2.xml',
			contentType: 'application/xml',
		});
		expect(customerData[0].relId).toMatch(/^rId\d+$/u);
		await expect(zip.file('customXml/item1.xml')!.async('string')).resolves.toContain('existing');
		await expect(zip.file('customXml/item2.xml')!.async('string')).resolves.toContain('deck-123');
		const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');
		const presentationRels = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');
		expect(presentationXml).toContain(
			`<p:custData customAttr="preserve-me" r:id="${customerData[0].relId}"`,
		);
		expect(presentationXml).toContain('uri="urn:customer-data:keep"');
		expect(presentationXml.indexOf('<p:custDataLst>')).toBeLessThan(
			presentationXml.indexOf('<p:defaultTextStyle>'),
		);
		expect(presentationRels).toContain(
			'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml"',
		);
		expect(presentationRels).toContain('Target="../customXml/item2.xml"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.customerData).toMatchObject([
			{
				id: 'customXml/item2.xml',
				data: '<deck-data><id>deck-123</id></deck-data>',
				contentType: 'application/xml',
			},
		]);
	});

	it('dirty-saves slide customer data while preserving tags and raw entry XML', async () => {
		const { handler, slides } = await createDeck();
		slides[0].customerData = [
			{
				data: '<slide-data><role>agenda</role></slide-data>',
				contentType: 'application/vnd.example.slide-data+xml',
				rawXml: { '@_vendor': 'contoso' },
			},
		];
		const authored = await handler.save(slides);
		const authoredZip = await JSZip.loadAsync(authored);
		const slidePath = slides[0].id;
		const slideXml = await authoredZip.file(slidePath)!.async('string');
		authoredZip.file(
			slidePath,
			slideXml.replace('</p:custDataLst>', '<p:tags vendor="keep"/></p:custDataLst><p:controls/>'),
		);
		const withTags = await authoredZip.generateAsync({ type: 'uint8array' });
		const dirtyHandler = new PptxHandler();
		const loaded = await dirtyHandler.load(withTags.buffer as ArrayBuffer);
		loaded.slides[0].customerData![0].data = '<slide-data><role>updated-agenda</role></slide-data>';
		loaded.slides[0].isDirty = true;
		const saved = await dirtyHandler.save(loaded.slides);
		const zip = await JSZip.loadAsync(saved);
		const savedSlideXml = await zip.file(slidePath)!.async('string');
		const slideRels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		const types = await zip.file('[Content_Types].xml')!.async('string');
		expect(savedSlideXml).toContain('<p:custData vendor="contoso"');
		expect(savedSlideXml).toContain('<p:tags vendor="keep"');
		expect(savedSlideXml.indexOf('<p:spTree>')).toBeLessThan(
			savedSlideXml.indexOf('<p:custDataLst>'),
		);
		expect(savedSlideXml.indexOf('<p:custDataLst>')).toBeLessThan(
			savedSlideXml.indexOf('<p:controls>'),
		);
		expect(slideRels).toContain('Target="../../customXml/item1.xml"');
		expect(types).toContain(
			'PartName="/customXml/item1.xml" ContentType="application/vnd.example.slide-data+xml"',
		);
		await expect(zip.file('customXml/item1.xml')!.async('string')).resolves.toContain(
			'updated-agenda',
		);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.slides[0].customerData).toMatchObject([
			{
				id: 'customXml/item1.xml',
				data: '<slide-data><role>updated-agenda</role></slide-data>',
				contentType: 'application/vnd.example.slide-data+xml',
			},
		]);
	});
});
