import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

describe('authored notes package round-trip', () => {
	it('creates notes master and slide OPC references for a new presentation', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slide = createSlide('Blank').build();
		slide.notes = 'A newly authored speaker note';
		data.slides.push(slide);

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const requiredParts = [
			'ppt/notesMasters/notesMaster1.xml',
			'ppt/notesMasters/_rels/notesMaster1.xml.rels',
			'ppt/notesSlides/notesSlide1.xml',
			'ppt/notesSlides/_rels/notesSlide1.xml.rels',
		];
		for (const path of requiredParts) {
			expect(zip.file(path), `${path} should exist`).not.toBeNull();
		}

		const presentation = await zip.file('ppt/presentation.xml')!.async('string');
		expect(presentation).toContain('p:notesMasterIdLst');
		const presentationRels = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');
		expect(presentationRels).toContain('relationships/notesMaster');
		expect(presentationRels).toContain('notesMasters/notesMaster1.xml');

		const slideRels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		expect(slideRels).toContain('relationships/notesSlide');
		const notesRels = await zip.file('ppt/notesSlides/_rels/notesSlide1.xml.rels')!.async('string');
		expect(notesRels).toContain('relationships/notesMaster');
		expect(notesRels).toContain('relationships/slide');

		const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
		expect(contentTypes).toContain('/ppt/notesMasters/notesMaster1.xml');
		expect(contentTypes).toContain('/ppt/notesSlides/notesSlide1.xml');

		const reloader = new PptxHandler();
		const reloaded = await reloader.load(saved.buffer as ArrayBuffer);
		expect(reloaded.slides[0].notes).toBe(slide.notes);
		expect(reloaded.notesMaster?.path).toBe('ppt/notesMasters/notesMaster1.xml');

		const resaved = await reloader.save(reloaded.slides, { notesMaster: reloaded.notesMaster });
		const finalLoader = new PptxHandler();
		const final = await finalLoader.load(resaved.buffer as ArrayBuffer);
		expect(final.slides[0].notes).toBe(slide.notes);
		expect(final.notesMaster).toBeDefined();
	});
});
