import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

/**
 * Round-trip proof for a handful of `presentation:` constructs graded
 * partial/unsupported on parse/preserve/edit/serialize:
 *
 *  - `p:photoAlbum/@isPhoto` (was untyped: parsed nothing).
 *  - `p:modifyVerifier` (typed parse + save existed; no test exercised the
 *    actual `PptxPresentationSaveBuilder` writer through a full load/save
 *    cycle).
 *  - `p:smartTags` (was UNSUPPORTED: no data model at all). This library has
 *    no model for the recognizer PART's content, so only the reference
 *    itself - the `@r:id` and, transitively, its relationship + target part
 *    - is typed and proven to survive a save.
 *  - CT_Presentation schema order: `PptxPresentationSaveBuilder` used to
 *    assign new children (`p:photoAlbum`, `p:modifyVerifier`, ...) directly
 *    onto the presentation object, which only ever APPENDS at the end of key
 *    order. Introducing one on a deck that had none placed it after
 *    `p:extLst`, which is schema-invalid per CT_Presentation's strict
 *    `xsd:sequence` (S19.2.1.26).
 */
describe('presentation partial-construct round trips', () => {
	async function baseDeckBytes(): Promise<Uint8Array> {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(createSlide('Blank').build());
		return handler.save(data.slides);
	}

	async function presentationXmlOf(bytes: Uint8Array): Promise<string> {
		const zip = await JSZip.loadAsync(bytes);
		return zip.file('ppt/presentation.xml')!.async('string');
	}

	// -------------------------------------------------------------------
	// p:photoAlbum/@isPhoto
	// -------------------------------------------------------------------
	describe('p:photoAlbum/@isPhoto', () => {
		it('parses, preserves, and re-serializes isPhoto through a full load/save/reload cycle', async () => {
			const handler = new PptxHandler();
			const data = await handler.load((await baseDeckBytes()).buffer as ArrayBuffer);

			const saved = await handler.save(data.slides, {
				photoAlbum: { layout: '4pic', frame: 'frameStyle2', isPhoto: true },
			});
			const xml = await presentationXmlOf(saved);
			expect(xml).toMatch(/<p:photoAlbum[^>]*isPhoto="1"/u);

			const reloadHandler = new PptxHandler();
			const reloaded = await reloadHandler.load(saved.buffer as ArrayBuffer);
			expect(reloaded.photoAlbum).toMatchObject({
				layout: '4pic',
				frame: 'frameStyle2',
				isPhoto: true,
			});

			// A second, no-edit save must keep the flag (preserve, not just edit).
			// `save()` must be called on the SAME handler instance that loaded
			// `reloaded`: it reads back internal state (the loaded zip,
			// presentation XML, relationship maps) populated by `load()`.
			const resaved = await reloadHandler.save(reloaded.slides);
			const rereloaded = await new PptxHandler().load(resaved.buffer as ArrayBuffer);
			expect(rereloaded.photoAlbum?.isPhoto).toBeTruthy();
		});

		it('writes isPhoto="0" for an explicit false value', async () => {
			const handler = new PptxHandler();
			const data = await handler.load((await baseDeckBytes()).buffer as ArrayBuffer);
			const saved = await handler.save(data.slides, { photoAlbum: { isPhoto: false } });
			const xml = await presentationXmlOf(saved);
			expect(xml).toMatch(/<p:photoAlbum[^>]*isPhoto="0"/u);
		});
	});

	// -------------------------------------------------------------------
	// p:modifyVerifier
	// -------------------------------------------------------------------
	describe('p:modifyVerifier', () => {
		it('round-trips a full write-protection verifier through save/reload', async () => {
			const handler = new PptxHandler();
			const data = await handler.load((await baseDeckBytes()).buffer as ArrayBuffer);

			const verifier = {
				algorithmName: 'SHA-512',
				hashData: 'aGFzaA==',
				saltData: 'c2FsdA==',
				spinValue: 100000,
				cryptProvider: 'Microsoft Enhanced RSA and AES Cryptographic Provider',
				cryptProviderType: 'rsaAES',
				cryptAlgorithmClass: 'hash',
				cryptAlgorithmType: 'typeAny',
				cryptAlgorithmSid: 14,
			};
			const saved = await handler.save(data.slides, { modifyVerifier: verifier });
			const reloadHandler = new PptxHandler();
			const reloaded = await reloadHandler.load(saved.buffer as ArrayBuffer);
			expect(reloaded.modifyVerifier).toMatchObject(verifier);

			// No-edit resave must preserve it verbatim. `save()` must be called on
			// the SAME handler instance that loaded `reloaded`.
			const resaved = await reloadHandler.save(reloaded.slides);
			const rereloaded = await new PptxHandler().load(resaved.buffer as ArrayBuffer);
			expect(rereloaded.modifyVerifier).toMatchObject(verifier);
		});

		it('removes the verifier when explicitly set to null', async () => {
			const handler = new PptxHandler();
			const data = await handler.load((await baseDeckBytes()).buffer as ArrayBuffer);
			const saved = await handler.save(data.slides, {
				modifyVerifier: { algorithmName: 'SHA-1', hashData: 'x' },
			});
			const verifierHandler = new PptxHandler();
			const withVerifier = await verifierHandler.load(saved.buffer as ArrayBuffer);
			expect(withVerifier.modifyVerifier?.algorithmName).toBe('SHA-1');

			const cleared = await verifierHandler.save(withVerifier.slides, { modifyVerifier: null });
			const reloaded = await new PptxHandler().load(cleared.buffer as ArrayBuffer);
			expect(reloaded.modifyVerifier).toBeUndefined();
		});
	});

	// -------------------------------------------------------------------
	// CT_Presentation schema order
	// -------------------------------------------------------------------
	describe('schema-ordered re-emit (CT_Presentation)', () => {
		it('inserts freshly-introduced photoAlbum and modifyVerifier in schema order', async () => {
			const handler = new PptxHandler();
			const data = await handler.load((await baseDeckBytes()).buffer as ArrayBuffer);

			// The blank-presentation fixture has no photoAlbum/modifyVerifier yet,
			// so both are freshly introduced here.
			const saved = await handler.save(data.slides, {
				photoAlbum: { layout: '1pic' },
				modifyVerifier: { algorithmName: 'SHA-512', hashData: 'h' },
			});
			const xml = await presentationXmlOf(saved);

			const sldIdLstIdx = xml.indexOf('<p:sldIdLst');
			const sldSzIdx = xml.indexOf('<p:sldSz');
			const photoAlbumIdx = xml.indexOf('<p:photoAlbum');
			const modifyVerifierIdx = xml.indexOf('<p:modifyVerifier');

			expect(sldIdLstIdx).toBeGreaterThan(-1);
			expect(sldSzIdx).toBeGreaterThan(-1);
			expect(photoAlbumIdx).toBeGreaterThan(-1);
			expect(modifyVerifierIdx).toBeGreaterThan(-1);

			// CT_Presentation order: sldIdLst, sldSz, notesSz, ..., photoAlbum,
			// custDataLst, kinsoku, defaultTextStyle, modifyVerifier, extLst.
			expect(sldIdLstIdx).toBeLessThan(sldSzIdx);
			expect(sldSzIdx).toBeLessThan(photoAlbumIdx);
			expect(photoAlbumIdx).toBeLessThan(modifyVerifierIdx);

			// And the file must still parse back into the same typed values.
			const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
			expect(reloaded.photoAlbum?.layout).toBe('1pic');
			expect(reloaded.modifyVerifier?.algorithmName).toBe('SHA-512');
		});

		it('keeps an existing p:extLst (CT_ExtensionListModify) last when photoAlbum is freshly introduced', async () => {
			// The bug this guards against: `applyPhotoAlbum` assigns
			// `presentation['p:photoAlbum'] = pa` directly, which (before the
			// unconditional `reorderObjectKeys` pass) only ever APPENDS at the
			// end of key order. On a deck that already ends in `p:extLst`,
			// introducing photoAlbum for the first time put it AFTER extLst,
			// violating CT_Presentation's `xsd:sequence` and risking
			// PowerPoint's repair dialog.
			const zip = await JSZip.loadAsync(await baseDeckBytes());
			let presXml = await zip.file('ppt/presentation.xml')!.async('string');
			presXml = presXml.replace(
				'</p:presentation>',
				'<p:extLst><p:ext uri="{TEST-EXT}"><test:marker xmlns:test="urn:test"/></p:ext></p:extLst></p:presentation>',
			);
			zip.file('ppt/presentation.xml', presXml);
			const bytes = await zip.generateAsync({ type: 'uint8array' });

			const handler = new PptxHandler();
			const data = await handler.load(bytes.buffer as ArrayBuffer);
			const saved = await handler.save(data.slides, { photoAlbum: { layout: '2pic' } });
			const xml = await presentationXmlOf(saved);

			const photoAlbumIdx = xml.indexOf('<p:photoAlbum');
			const extLstIdx = xml.indexOf('<p:extLst');
			expect(photoAlbumIdx).toBeGreaterThan(-1);
			expect(extLstIdx).toBeGreaterThan(-1);
			expect(photoAlbumIdx).toBeLessThan(extLstIdx);
			expect(xml).toContain('{TEST-EXT}');
		});
	});

	// -------------------------------------------------------------------
	// p:smartTags (legacy Office Smart Tags recognizer reference)
	// -------------------------------------------------------------------
	describe('p:smartTags', () => {
		/** Splice a `<p:smartTags r:id=".."/>` + matching rel + target part into a base deck. */
		async function deckWithSmartTags(): Promise<{ bytes: Uint8Array; targetPath: string }> {
			const zip = await JSZip.loadAsync(await baseDeckBytes());
			const targetPath = 'ppt/smartTagsData1.xml';

			let presXml = await zip.file('ppt/presentation.xml')!.async('string');
			expect(presXml).toContain('</p:notesSz>');
			presXml = presXml.replace('</p:notesSz>', '</p:notesSz><p:smartTags r:id="rIdSmartTags1"/>');
			zip.file('ppt/presentation.xml', presXml);

			let relsXml = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');
			relsXml = relsXml.replace(
				'</Relationships>',
				'<Relationship Id="rIdSmartTags1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/smartTags" Target="smartTagsData1.xml"/></Relationships>',
			);
			zip.file('ppt/_rels/presentation.xml.rels', relsXml);

			zip.file(
				targetPath,
				'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><ct:smartTagLst xmlns:ct="http://schemas.microsoft.com/office/2006/coverXml"/>',
			);

			return { bytes: await zip.generateAsync({ type: 'uint8array' }), targetPath };
		}

		it('parses the relationship id and resolves the target part', async () => {
			const { bytes, targetPath } = await deckWithSmartTags();
			const data = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
			expect(data.smartTags).toMatchObject({ relId: 'rIdSmartTags1', targetPath });
			expect(data.smartTags?.rawXml).toBeDefined();
		});

		it('preserves the element, relationship, and target part through a no-edit save', async () => {
			const { bytes, targetPath } = await deckWithSmartTags();
			const handler = new PptxHandler();
			const data = await handler.load(bytes.buffer as ArrayBuffer);

			const saved = await handler.save(data.slides);
			const savedZip = await JSZip.loadAsync(saved);

			const presXml = await savedZip.file('ppt/presentation.xml')!.async('string');
			expect(presXml).toMatch(/<p:smartTags[^>]*r:id="rIdSmartTags1"/u);

			const relsXml = await savedZip.file('ppt/_rels/presentation.xml.rels')!.async('string');
			expect(relsXml).toContain('Id="rIdSmartTags1"');
			expect(relsXml).toContain('smartTagsData1.xml');

			expect(savedZip.file(targetPath)).not.toBeNull();

			const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
			expect(reloaded.smartTags).toMatchObject({ relId: 'rIdSmartTags1', targetPath });
		});

		it('returns undefined when the presentation has no p:smartTags', async () => {
			const data = await new PptxHandler().load((await baseDeckBytes()).buffer as ArrayBuffer);
			expect(data.smartTags).toBeUndefined();
		});
	});
});
