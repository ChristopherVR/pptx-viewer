import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

/**
 * `CT_PresentationProperties` is a fixed sequence:
 *   htmlPubPr?, webPr?, prnPr?, showPr?, clrMru?, extLst?
 *
 * The save pipeline used to assign `root['p:showPr']` by raw key, which
 * fast-xml-parser appends at the tail. On the common PowerPoint shape (no
 * `p:showPr`, only `p:clrMru` / `p:extLst`) that emitted `showPr` AFTER
 * `extLst` - Sch_UnexpectedElementContentExpectingComplex - and fabricated a
 * `p:showPr` into decks that never had one, because every binding passes the
 * loaded `presentationProperties` back to `save()` unconditionally.
 */

const POWERPOINT_SHAPED_PRESPROPS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:clrMru><a:srgbClr val="D9B265"/></p:clrMru><p:extLst><p:ext uri="{E76CE94A-603C-4142-B9EB-6D1370010A27}"><p14:discardImageEditData xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="0"/></p:ext></p:extLst></p:presentationPr>`;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deckWithPowerPointShapedPresProps(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(
		createSlide('Blank').addText('hello', { x: 10, y: 10, width: 200, height: 50 }).build(),
	);
	const bytes = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(bytes);
	zip.file('ppt/presProps.xml', POWERPOINT_SHAPED_PRESPROPS);
	return zip.generateAsync({ type: 'uint8array' });
}

describe('presProps.xml child order on a plain load-save', () => {
	it('does not fabricate p:showPr when the caller set no show-related field', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(await deckWithPowerPointShapedPresProps()));
		expect(data.presentationProperties?.mruColors).toStrictEqual(['#D9B265']);

		const saved = await handler.save(data.slides, {
			presentationProperties: data.presentationProperties,
		});
		const xml = await (await JSZip.loadAsync(saved)).file('ppt/presProps.xml')!.async('string');

		expect(xml).not.toContain('<p:showPr');
		expect(xml.indexOf('<p:clrMru')).toBeLessThan(xml.indexOf('<p:extLst'));
	});

	it('writes p:showPr before p:clrMru and p:extLst when a show field is set', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(await deckWithPowerPointShapedPresProps()));

		const saved = await handler.save(data.slides, {
			presentationProperties: {
				...data.presentationProperties,
				loopContinuously: true,
				showType: 'kiosk',
				kioskRestartTime: 5000,
			},
		});
		const xml = await (await JSZip.loadAsync(saved)).file('ppt/presProps.xml')!.async('string');

		const showPrIndex = xml.indexOf('<p:showPr');
		const clrMruIndex = xml.indexOf('<p:clrMru');
		const extLstIndex = xml.indexOf('<p:extLst');
		expect(showPrIndex).toBeGreaterThanOrEqual(0);
		expect(showPrIndex).toBeLessThan(clrMruIndex);
		expect(clrMruIndex).toBeLessThan(extLstIndex);
		expect(xml).toContain('<p:kiosk restart="5000">');
	});

	it('keeps an existing show-mode choice when the caller supplies none', async () => {
		const zip = await JSZip.loadAsync(await deckWithPowerPointShapedPresProps());
		zip.file(
			'ppt/presProps.xml',
			POWERPOINT_SHAPED_PRESPROPS.replace(
				'<p:clrMru>',
				'<p:showPr showNarration="1"><p:browse/><p:sldAll/></p:showPr><p:clrMru>',
			),
		);
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(await zip.generateAsync({ type: 'uint8array' })));

		const saved = await handler.save(data.slides, {
			presentationProperties: { loopContinuously: true },
		});
		const xml = await (await JSZip.loadAsync(saved)).file('ppt/presProps.xml')!.async('string');

		expect(xml).toContain('<p:browse>');
		expect(xml).not.toContain('<p:present>');
		expect(xml.indexOf('<p:showPr')).toBeLessThan(xml.indexOf('<p:clrMru'));
	});
});
