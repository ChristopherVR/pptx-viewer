import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

async function buildDeck(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	const xml = await zip.file('ppt/presentation.xml')!.async('string');
	zip.file(
		'ppt/presentation.xml',
		xml.replace(
			'<p:defaultTextStyle>',
			'<x:kinsoku xmlns:x="http://schemas.openxmlformats.org/presentationml/2006/main" lang="ja-JP" invalStChars="old-start" invalEndChars="old-end" vendor="keep"/><p:defaultTextStyle>',
		),
	);
	return (await zip.generateAsync({ type: 'uint8array' })).buffer as ArrayBuffer;
}

describe('kinsoku package round trip', () => {
	it('loads an alternate prefix, edits values, and preserves unknown XML', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeck());
		const kinsoku = data.kinsoku!;

		expect(kinsoku).toMatchObject({
			lang: 'ja-JP',
			invalStChars: 'old-start',
			invalEndChars: 'old-end',
		});
		kinsoku.lang = null;
		kinsoku.invalStChars = 'new-start';
		kinsoku.invalEndChars = 'new-end';
		const saved = await handler.save(data.slides, { kinsoku });
		const savedXml = await (
			await JSZip.loadAsync(saved)
		)
			.file('ppt/presentation.xml')!
			.async('string');

		expect(savedXml).toContain(
			'<x:kinsoku xmlns:x="http://schemas.openxmlformats.org/presentationml/2006/main" invalStChars="new-start" invalEndChars="new-end" vendor="keep"',
		);
		expect(savedXml).not.toMatch(/<x:kinsoku\b[^>]*\slang=/u);
		expect(savedXml.indexOf('<x:kinsoku')).toBeLessThan(savedXml.indexOf('<p:defaultTextStyle'));

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.kinsoku).toMatchObject({
			invalStChars: 'new-start',
			invalEndChars: 'new-end',
		});
		expect(reloaded.kinsoku?.lang).toBeUndefined();
	});

	it('removes kinsoku without disturbing adjacent presentation children', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeck());
		const saved = await handler.save(data.slides, { kinsoku: null });
		const xml = await (await JSZip.loadAsync(saved)).file('ppt/presentation.xml')!.async('string');

		expect(xml).not.toContain(':kinsoku');
		expect(xml).toContain('<p:notesSz');
		expect(xml).toContain('<p:defaultTextStyle');
	});
});
