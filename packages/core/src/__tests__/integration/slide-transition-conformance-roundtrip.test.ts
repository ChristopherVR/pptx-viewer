import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

async function generatedDeck() {
	const created = await PresentationBuilder.create();
	const slide = created.createSlide('Blank').addText('Transition').build();
	slide.transition = {
		type: 'fade',
		speed: 'slow',
		advanceOnClick: false,
		advanceAfterMs: 2_500,
		soundRId: 'rIdSound',
		soundName: 'Chime',
		soundLoop: true,
	};
	created.data.slides.push(slide);
	return created.handler.save(created.data.slides);
}

describe('slide transition package round-trip', () => {
	it('generates and reloads typed speed, timing, and start-sound options', async () => {
		const bytes = await generatedDeck();
		const zip = await JSZip.loadAsync(bytes);
		const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(xml).toContain('spd="slow"');
		expect(xml).toContain('advClick="0"');
		expect(xml).toContain('advTm="2500"');
		expect(xml).toContain('loop="1"');
		expect(xml).toContain('r:embed="rIdSound"');
		expect(xml).toContain('name="Chime"');

		const data = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		expect(data.slides[0].transition).toMatchObject({
			type: 'fade',
			speed: 'slow',
			advanceOnClick: false,
			advanceAfterMs: 2_500,
			soundRId: 'rIdSound',
			soundName: 'Chime',
			soundLoop: true,
		});
	});

	it('preserves unknown transition markup through a dirty edit and reload', async () => {
		const base = await generatedDeck();
		const zip = await JSZip.loadAsync(base);
		const path = 'ppt/slides/slide1.xml';
		const original = await zip.file(path)!.async('string');
		zip.file(
			path,
			original
				.replace('<p:sld ', '<p:sld xmlns:vendor="urn:vendor" ')
				.replace('<p:transition ', '<p:transition vendor:mode="keep" ')
				.replace('</p:transition>', '<vendor:future value="keep"/></p:transition>'),
		);
		const injected = await zip.generateAsync({ type: 'uint8array' });
		const handler = new PptxHandler();
		const data = await handler.load(injected.buffer as ArrayBuffer);
		data.slides[0].transition!.speed = 'fast';
		data.slides[0].transition!.soundLoop = false;
		data.slides[0].isDirty = true;
		const saved = await handler.save(data.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const savedXml = await savedZip.file(path)!.async('string');
		expect(savedXml).toContain('vendor:mode="keep"');
		expect(savedXml).toContain('<vendor:future value="keep"');
		expect(savedXml).toContain('spd="fast"');
		expect(savedXml).toContain('loop="0"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.slides[0].transition).toMatchObject({ speed: 'fast', soundLoop: false });
	});
});
