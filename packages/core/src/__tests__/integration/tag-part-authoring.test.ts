import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxTagCollection } from '../../core/types';

async function createDeck(): Promise<{
	handler: PptxHandler;
	slides: Awaited<ReturnType<typeof PresentationBuilder.create>>['data']['slides'];
}> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	return { handler, slides: data.slides };
}

describe('user-defined tags package integration', () => {
	it('authors a presentation-owned collection by default and reloads ownership', async () => {
		const { handler, slides } = await createDeck();
		const tags: PptxTagCollection[] = [{ tags: [{ name: 'DECK_ID', value: 'deck-123' }] }];
		const saved = await handler.save(slides, { tags });
		const zip = await JSZip.loadAsync(saved);
		const tagPath = tags[0].path!;
		const tagXml = await zip.file(tagPath)!.async('string');
		const rels = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');
		const types = await zip.file('[Content_Types].xml')!.async('string');
		expect(tagPath).toMatch(/^ppt\/tags\/tag\d+\.xml$/u);
		expect(tagXml).toContain('name="DECK_ID" val="deck-123"');
		expect(rels).toContain(
			'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags"',
		);
		expect(rels).toContain(`Target="tags/${tagPath.split('/').pop()}"`);
		expect(types).toContain(
			`PartName="/${tagPath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"`,
		);

		const loaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(loaded.tags).toMatchObject([
			{
				path: tagPath,
				owner: 'presentation',
				sourcePartPath: 'ppt/presentation.xml',
				tags: [{ name: 'DECK_ID', value: 'deck-123' }],
			},
		]);
	});

	it('authors the owning <p:tags r:id> element referencing the same relationship id (structural gap fix)', async () => {
		const { handler, slides } = await createDeck();
		const tags: PptxTagCollection[] = [{ tags: [{ name: 'DECK_ID', value: 'deck-123' }] }];
		const saved = await handler.save(slides, { tags });
		const zip = await JSZip.loadAsync(saved);
		const rels = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');
		const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');

		const relMatch = rels.match(
			/<Relationship Id="(rId\d+)" Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/tags"/u,
		);
		expect(relMatch).toBeTruthy();
		const relId = relMatch![1]!;
		// The element AND the relationship both exist and reference each other:
		// the relationship id above and the element's r:id below must match.
		expect(presentationXml).toContain(`<p:tags r:id="${relId}"></p:tags>`);
		expect(presentationXml).toMatch(
			/<p:custDataLst>[\s\S]*<p:tags r:id="rId\d+">[\s\S]*<\/p:custDataLst>/u,
		);
	});

	it('removes the owning element, relationship, part, and content-type override when a collection is cleared', async () => {
		const { handler, slides } = await createDeck();
		const tags: PptxTagCollection[] = [{ tags: [{ name: 'DECK_ID', value: 'deck-123' }] }];
		const saved = await handler.save(slides, { tags });

		const loaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const collection = loaded.tags![0]!;
		const tagPath = collection.path!;
		collection.tags = [];
		const cleared = await handler.save(loaded.slides, { tags: loaded.tags });

		const zip = await JSZip.loadAsync(cleared);
		expect(zip.file(tagPath)).toBeNull();
		const rels = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');
		expect(rels).not.toContain(
			'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags"',
		);
		const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');
		expect(presentationXml).not.toContain('<p:tags');
		const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
		expect(contentTypes).not.toContain(`PartName="/${tagPath}"`);

		const reloaded = await new PptxHandler().load(cleared.buffer as ArrayBuffer);
		expect(reloaded.tags ?? []).toHaveLength(0);
	});

	it('authors slide-owned tags and preserves unknown XML on dirty reload', async () => {
		const { handler, slides } = await createDeck();
		const tags: PptxTagCollection[] = [
			{
				owner: 'slide',
				sourcePartPath: 'ppt/slides/slide1.xml',
				tags: [{ name: 'SLIDE_ROLE', value: 'agenda' }],
			},
		];
		const authored = await handler.save(slides, { tags });
		const authoredZip = await JSZip.loadAsync(authored);
		const rels = await authoredZip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		expect(rels).toContain('/relationships/tags');
		expect(rels).toContain(`Target="../tags/${tags[0].path!.split('/').pop()}"`);
		const relId = rels.match(/<Relationship Id="(rId\d+)"[^>]*\/relationships\/tags"/u)?.[1];
		expect(relId).toBeTruthy();

		// The owning element lives in the slide's own p:cSld/p:custDataLst, not
		// the presentation root, and references the same relationship id.
		const slideXml = await authoredZip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toContain(`<p:tags r:id="${relId}"></p:tags>`);

		const tagXml = await authoredZip.file(tags[0].path!)!.async('string');
		authoredZip.file(
			tags[0].path!,
			tagXml.replace('</p:tagLst>', '<p:extLst><p:ext uri="urn:tag:keep"/></p:extLst></p:tagLst>'),
		);
		const withUnknown = await authoredZip.generateAsync({ type: 'uint8array' });
		const dirtyHandler = new PptxHandler();
		const loaded = await dirtyHandler.load(withUnknown.buffer as ArrayBuffer);
		const collection = loaded.tags![0];
		expect(collection).toMatchObject({
			owner: 'slide',
			sourcePartPath: 'ppt/slides/slide1.xml',
		});
		collection.tags[0].value = 'updated-agenda';
		const saved = await dirtyHandler.save(loaded.slides, { tags: loaded.tags });
		const zip = await JSZip.loadAsync(saved);
		const savedTagXml = await zip.file(collection.path!)!.async('string');
		expect(savedTagXml).toContain('val="updated-agenda"');
		expect(savedTagXml).toContain('uri="urn:tag:keep"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.tags?.[0]).toMatchObject({
			owner: 'slide',
			tags: [{ name: 'SLIDE_ROLE', value: 'updated-agenda' }],
		});
	});
});
