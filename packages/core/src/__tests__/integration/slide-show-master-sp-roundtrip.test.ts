/**
 * `p:sld/@showMasterSp` (CT_Slide, ECMA-376 §19.3.1.38) - PowerPoint's "Hide
 * Background Graphics" - governs whether the slide displays its inherited
 * layout/master decorative shapes. The load side already modelled this
 * (`slide.showMasterShapes`, consumed to exclude template elements from
 * `slide.elements` - see `PptxSlideLoaderService`), but nothing ever wrote the
 * attribute back out on save: a user-toggled edit to `showMasterShapes` was
 * silently dropped, unlike its sibling `showMasterPhAnim`.
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

async function partXml(saved: Uint8Array, partPath: string): Promise<string> {
	const zip = await JSZip.loadAsync(saved);
	const entry = zip.file(partPath);
	expect(entry, `${partPath} missing from saved archive`).toBeTruthy();
	return entry!.async('string');
}

describe('p:sld/@showMasterSp', () => {
	it('round-trips an explicit hide edit made through the typed model', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		const slide = data.slides[0]!;
		expect(slide.showMasterShapes).toBeUndefined();

		slide.showMasterShapes = false;
		slide.isDirty = true;
		const saved = await handler.save(data.slides);
		const xml = await partXml(saved, slide.id);
		expect(xml).toContain('showMasterSp="0"');

		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		expect(reloaded.slides[0]?.showMasterShapes).toBeFalsy();
	});

	it('round-trips an explicit show-again edit back to "1"', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		const slide = data.slides[0]!;

		slide.showMasterShapes = true;
		slide.isDirty = true;
		const saved = await handler.save(data.slides);
		const xml = await partXml(saved, slide.id);
		expect(xml).toContain('showMasterSp="1"');
	});
});
