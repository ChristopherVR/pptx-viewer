/**
 * `p:sld/@showMasterPhAnim` (CT_Slide, ECMA-376 §19.3.1.38) governs whether
 * inherited master placeholder ANIMATIONS replay on this slide. It is
 * distinct from `p:sld/@showMasterSp` (shape visibility), which was already
 * modelled. Only the layout-level twin (`p:sldLayout/@showMasterPhAnim`) was
 * read/written; the slide-level override was silently dropped on parse.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/sample-deck.pptx', import.meta.url),
);

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** Inject `p:sld/@showMasterPhAnim="<value>"` into the first slide part. */
async function fixtureWithShowMasterPhAnim(value: '0' | '1'): Promise<ArrayBuffer> {
	const zip = await JSZip.loadAsync(fixtureBytes());
	const slidePath = Object.keys(zip.files).find((p) => /^ppt\/slides\/slide\d+\.xml$/u.test(p))!;
	const xml = await zip.file(slidePath)!.async('string');
	expect(xml).not.toContain('showMasterPhAnim');
	zip.file(slidePath, xml.replace('<p:sld ', `<p:sld showMasterPhAnim="${value}" `));
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function partXml(saved: Uint8Array, partPath: string): Promise<string> {
	const zip = await JSZip.loadAsync(saved);
	const entry = zip.file(partPath);
	expect(entry, `${partPath} missing from saved archive`).toBeTruthy();
	return entry!.async('string');
}

describe('p:sld/@showMasterPhAnim', () => {
	it('parses an explicit "0" as false', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithShowMasterPhAnim('0'));
		expect(data.slides[0]?.showMasterPhAnim).toBeFalsy();
	});

	it('parses an explicit "1" as true', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithShowMasterPhAnim('1'));
		expect(data.slides[0]?.showMasterPhAnim).toBeTruthy();
	});

	it('leaves the field undefined when the attribute is absent', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		expect(data.slides[0]?.showMasterPhAnim).toBeUndefined();
	});

	it('round-trips an edit made through the typed model', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithShowMasterPhAnim('1'));
		const slide = data.slides[0]!;
		expect(slide.showMasterPhAnim).toBeTruthy();

		slide.showMasterPhAnim = false;
		slide.isDirty = true;
		const saved = await handler.save(data.slides);
		const xml = await partXml(saved, slide.id);
		expect(xml).toContain('showMasterPhAnim="0"');

		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		expect(reloaded.slides[0]?.showMasterPhAnim).toBeFalsy();
	});
});
