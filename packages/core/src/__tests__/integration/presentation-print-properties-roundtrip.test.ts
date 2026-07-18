import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

async function buildPrefixedDeck(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	const xml = await zip.file('ppt/presProps.xml')!.async('string');
	const rootWithAlternatePrefix = xml
		.replace('<p:presentationPr', '<q:presentationPr xmlns:q="urn:presentationml-test"')
		.replace(
			/(<q:presentationPr\b[^>]*?)\/>/u,
			'$1><q:prnPr prnWhat="handouts4" clrMode="gray" hiddenSlides="true" scaleToFitPaper="0" frameSlides="1" vendor="keep"><q:extLst><q:ext uri="urn:test"/></q:extLst></q:prnPr></q:presentationPr>',
		);
	zip.file('ppt/presProps.xml', rootWithAlternatePrefix);
	return (await zip.generateAsync({ type: 'uint8array' })).buffer as ArrayBuffer;
}

describe('presentationML print properties integration', () => {
	it('loads an alternate prefix, edits all attributes, and preserves extensions', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildPrefixedDeck());
		const print = data.presentationProperties!.printProperties!;

		expect(print).toMatchObject({
			printWhat: 'handouts4',
			colorMode: 'gray',
			hiddenSlides: true,
			scaleToFitPaper: false,
			frameSlides: true,
		});

		print.printWhat = 'outline';
		print.colorMode = 'bw';
		print.hiddenSlides = false;
		print.scaleToFitPaper = true;
		print.frameSlides = null;
		const saved = await handler.save(data.slides, {
			presentationProperties: data.presentationProperties,
		});
		const savedZip = await JSZip.loadAsync(saved);
		const savedXml = await savedZip.file('ppt/presProps.xml')!.async('string');

		expect(savedXml).toContain('<q:prnPr prnWhat="outline" clrMode="bw" hiddenSlides="0"');
		expect(savedXml).toContain('scaleToFitPaper="1" vendor="keep"');
		expect(savedXml).not.toContain('frameSlides=');
		expect(savedXml).toContain('<q:extLst><q:ext uri="urn:test"></q:ext></q:extLst>');
		expect(savedXml.indexOf('<q:prnPr')).toBeLessThan(savedXml.indexOf('<p:showPr'));

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.presentationProperties!.printProperties).toMatchObject({
			printWhat: 'outline',
			colorMode: 'bw',
			hiddenSlides: false,
			scaleToFitPaper: true,
		});
	});

	it('removes p:prnPr when printProperties is null', async () => {
		const firstHandler = new PptxHandler();
		const data = await firstHandler.load(await buildPrefixedDeck());
		const removed = await firstHandler.save(data.slides, {
			presentationProperties: { printProperties: null },
		});
		const removedXml = await (
			await JSZip.loadAsync(removed)
		)
			.file('ppt/presProps.xml')!
			.async('string');
		expect(removedXml).not.toMatch(/<[^>]*:?prnPr\b/u);
	});
});
