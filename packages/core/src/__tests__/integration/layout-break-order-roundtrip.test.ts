import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

describe('issue 358: untouched template paragraph child order', () => {
	for (const part of ['slideLayouts/slideLayout1', 'slideMasters/slideMaster1']) {
		it(`keeps attributed breaks between runs in ${part} over two saves`, async () => {
			const { handler, data, createSlide } = await PresentationBuilder.create();
			data.slides.push(createSlide('Blank').build());
			const zip = await JSZip.loadAsync(await handler.save(data.slides));
			const path = `ppt/${part}.xml`;
			const xml = await zip.file(path)!.async('string');
			const shape = `<p:sp><p:nvSpPr><p:cNvPr id="9" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="3500"/><a:t>line one</a:t></a:r><a:br><a:rPr sz="3500"/></a:br><a:r><a:rPr lang="en-US" sz="3500"/><a:t>line two</a:t></a:r><a:endParaRPr lang="en-US" sz="3500"/></a:p></p:txBody></p:sp>`;
			zip.file(path, xml.replace('</p:spTree>', `${shape}</p:spTree>`));
			let bytes = await zip.generateAsync({ type: 'uint8array' });
			for (let pass = 0; pass < 2; pass++) {
				const loadedHandler = new PptxHandler();
				const loaded = await loadedHandler.load(bytes.buffer as ArrayBuffer);
				bytes = await loadedHandler.save(loaded.slides);
				const saved = await (await JSZip.loadAsync(bytes)).file(path)!.async('string');
				expect(saved.indexOf('line one')).toBeLessThan(saved.indexOf('<a:br>'));
				expect(saved.indexOf('<a:br>')).toBeLessThan(saved.indexOf('line two'));
				expect(saved).toMatch(/<a:br><a:rPr sz="3500"\s*\/?>(?:<\/a:rPr>)?<\/a:br>/);
			}
		});
	}
});
