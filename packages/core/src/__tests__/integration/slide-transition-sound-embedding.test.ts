import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

/** A tiny (invalid, but decodable) WAV payload: embedding only needs valid base64. */
const SOUND_DATA_URL = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IAAAAAA=';

async function deckWithPickedSound() {
	const created = await PresentationBuilder.create();
	const slide = created.createSlide('Blank').addText('Transition').build();
	slide.transition = {
		type: 'fade',
		soundData: SOUND_DATA_URL,
		soundFileName: 'chime.wav',
		soundName: 'chime',
	};
	created.data.slides.push(slide);
	return { handler: created.handler, slides: created.data.slides };
}

describe('slide transition sound embedding (save pipeline)', () => {
	it('embeds a newly-picked sound file as a media part with a slide relationship', async () => {
		const { handler, slides } = await deckWithPickedSound();
		const bytes = await handler.save(slides);
		const zip = await JSZip.loadAsync(bytes);

		// A new audio media part was written into the package.
		const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith('ppt/media/audio'));
		expect(mediaFiles).toHaveLength(1);
		expect(mediaFiles[0]).toMatch(/\.wav$/);

		// The slide's own model no longer carries the pending data URL.
		expect(slides[0].transition?.soundData).toBeUndefined();
		expect(slides[0].transition?.soundRId).toBeTruthy();
		expect(slides[0].transition?.soundPath).toBe(mediaFiles[0]);

		// The slide relationship references the new media part.
		const relsXml = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		const rId = slides[0].transition!.soundRId!;
		expect(relsXml).toContain(`Id="${rId}"`);
		expect(relsXml).toContain(`Target="../media/${mediaFiles[0].split('/').pop()}"`);

		// The transition XML references the same relationship id, per ECMA-376
		// `p:transition/p:sndAc/p:stSnd/p:snd/@r:embed`.
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toContain(`<p:sndAc><p:stSnd><p:snd r:embed="${rId}"`);
		expect(slideXml).toContain('name="chime"');

		// The new extension has a content-type default so PowerPoint can open the part.
		const contentTypesXml = await zip.file('[Content_Types].xml')!.async('string');
		expect(contentTypesXml).toContain('Extension="wav"');
	});

	it('round-trips the picked sound through a reload: soundFileName and soundPath survive', async () => {
		const { handler, slides } = await deckWithPickedSound();
		const bytes = await handler.save(slides);

		const reloaded = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		const transition = reloaded.slides[0].transition;
		expect(transition?.soundRId).toBeTruthy();
		expect(transition?.soundPath).toMatch(/^ppt\/media\/audio\d+\.wav$/);
		expect(transition?.soundName).toBe('chime');
		expect(transition?.soundData).toBeUndefined();
	});

	it('reports a warning and drops the pending sound when the payload cannot be decoded', async () => {
		const created = await PresentationBuilder.create();
		const slide = created.createSlide('Blank').addText('Transition').build();
		slide.transition = { type: 'fade', soundData: 'not-a-data-url', soundFileName: 'broken.wav' };
		created.data.slides.push(slide);

		const bytes = await created.handler.save(created.data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith('ppt/media/'));
		expect(mediaFiles).toHaveLength(0);
		expect(created.data.slides[0].transition?.soundData).toBeUndefined();

		const warnings = created.handler.getCompatibilityWarnings();
		expect(
			warnings.some((w) => w.code === 'SAVE_TRANSITION_SOUND_PAYLOAD_UNSUPPORTED'),
		).toBeTruthy();
	});
});
