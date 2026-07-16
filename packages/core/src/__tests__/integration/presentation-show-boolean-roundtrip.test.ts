import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

async function buildLexicalBooleanDeck(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	const bytes = await handler.save(data.slides, {
		presentationProperties: {
			loopContinuously: true,
			showWithNarration: false,
			showWithAnimation: false,
			advanceMode: 'manual',
		},
	});
	const zip = await JSZip.loadAsync(bytes);
	const xml = await zip.file('ppt/presProps.xml')!.async('string');
	zip.file(
		'ppt/presProps.xml',
		xml
			.replace('loop="1"', 'loop="true"')
			.replace('showNarration="0"', 'showNarration="false"')
			.replace('showAnimation="0"', 'showAnimation="false"')
			.replace('useTimings="0"', 'useTimings="false"'),
	);
	return (await zip.generateAsync({ type: 'uint8array' })).buffer as ArrayBuffer;
}

describe('presentation show XML boolean integration', () => {
	it('loads valid true/false lexical forms and preserves behavior after save', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildLexicalBooleanDeck());

		expect(data.presentationProperties).toMatchObject({
			loopContinuously: true,
			showWithNarration: false,
			showWithAnimation: false,
			advanceMode: 'manual',
		});

		const saved = await handler.save(data.slides, {
			presentationProperties: data.presentationProperties,
		});
		const savedZip = await JSZip.loadAsync(saved);
		const savedXml = await savedZip.file('ppt/presProps.xml')!.async('string');
		expect(savedXml).toContain('loop="1"');
		expect(savedXml).toContain('showNarration="0"');
		expect(savedXml).toContain('showAnimation="0"');
		expect(savedXml).toContain('useTimings="0"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.presentationProperties).toMatchObject({
			loopContinuously: true,
			showWithNarration: false,
			showWithAnimation: false,
			advanceMode: 'manual',
		});
	});
});
