import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

const FONT_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';
const PML = 'http://schemas.openxmlformats.org/presentationml/2006/main';

async function buildDeck(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	const presentation = await zip.file('ppt/presentation.xml')!.async('string');
	zip.file(
		'ppt/presentation.xml',
		presentation.replace(
			'<p:defaultTextStyle>',
			`<x:embeddedFontLst xmlns:x="${PML}" vendor="list"><x:embeddedFont vendor="entry"><x:font typeface="Old Face" charset="1" vendor="font"/><x:regular r:id="rIdFont1" vendor="regular"/><x:italic r:id="rIdFont2"/><x:future val="keep"/></x:embeddedFont></x:embeddedFontLst><p:defaultTextStyle>`,
		),
	);
	const rels = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');
	zip.file(
		'ppt/_rels/presentation.xml.rels',
		rels.replace(
			'</Relationships>',
			`<Relationship Id="rIdFont1" Type="${FONT_REL_TYPE}" Target="fonts/font1.fntdata"/><Relationship Id="rIdFont2" Type="${FONT_REL_TYPE}" Target="fonts/font2.fntdata"/></Relationships>`,
		),
	);
	zip.file('ppt/fonts/font1.fntdata', new Uint8Array([1, 2, 3, 4]));
	zip.file('ppt/fonts/font2.fntdata', new Uint8Array([5, 6, 7, 8]));
	return (await zip.generateAsync({ type: 'uint8array' })).buffer as ArrayBuffer;
}

describe('embedded font list package round trip', () => {
	it('loads unresolved variants, edits metadata, and preserves unknown XML', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeck());
		const list = data.embeddedFontList!;
		const entry = list.fonts[0];

		expect(data.embeddedFonts).toBeUndefined();
		expect(entry).toMatchObject({
			font: { typeface: 'Old Face', charset: '1' },
			regular: { relationshipId: 'rIdFont1' },
			italic: { relationshipId: 'rIdFont2' },
		});

		entry.font.typeface = 'New Face';
		entry.font.charset = null;
		entry.regular!.relationshipId = 'rIdFont2';
		entry.bold = { relationshipId: 'rIdFont1' };
		entry.italic = null;
		const saved = await handler.save(data.slides, { embeddedFontList: list });
		const savedXml = await (
			await JSZip.loadAsync(saved)
		)
			.file('ppt/presentation.xml')!
			.async('string');

		expect(savedXml).toContain('<x:embeddedFontLst xmlns:x=');
		expect(savedXml).toContain('vendor="list"');
		expect(savedXml).toContain('<x:font typeface="New Face" vendor="font"');
		expect(savedXml).toContain('<x:regular r:id="rIdFont2" vendor="regular"');
		expect(savedXml).toContain('<p:bold r:id="rIdFont1"');
		expect(savedXml).not.toContain('<x:italic');
		expect(savedXml).toContain('<x:future val="keep"');
		expect(savedXml.indexOf('<x:font')).toBeLessThan(savedXml.indexOf('<x:regular'));
		expect(savedXml.indexOf('<x:regular')).toBeLessThan(savedXml.indexOf('<p:bold'));
		expect(savedXml.indexOf('<x:embeddedFontLst')).toBeLessThan(
			savedXml.indexOf('<p:defaultTextStyle'),
		);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.embeddedFontList!.fonts[0]).toMatchObject({
			font: { typeface: 'New Face' },
			regular: { relationshipId: 'rIdFont2' },
			bold: { relationshipId: 'rIdFont1' },
		});
	});

	it('removes the list, font relationships, and font parts together', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeck());
		const saved = await handler.save(data.slides, { embeddedFontList: null });
		const zip = await JSZip.loadAsync(saved);
		const presentation = await zip.file('ppt/presentation.xml')!.async('string');
		const rels = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');

		expect(presentation).not.toContain('embeddedFontLst');
		expect(rels).not.toContain(FONT_REL_TYPE);
		expect(zip.file('ppt/fonts/font1.fntdata')).toBeNull();
		expect(zip.file('ppt/fonts/font2.fntdata')).toBeNull();
	});

	it('does not emit the non-schema fontKey attribute for newly embedded fonts', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(createSlide('Blank').build());
		const rawFontData = new Uint8Array(64);
		rawFontData.set([0, 1, 0, 0]);
		const saved = await handler.save(data.slides, {
			embeddedFonts: [
				{
					name: 'New Font',
					dataUrl: '',
					rawFontData,
					format: 'truetype',
				},
			],
		});
		const xml = await (await JSZip.loadAsync(saved)).file('ppt/presentation.xml')!.async('string');
		expect(xml).toContain('<p:regular r:id=');
		expect(xml).not.toContain('fontKey=');
	});
});
