/**
 * `p:bgPr/@shadeToTitle` (CT_BackgroundProperties, ECMA-376 §19.3.1.2) is
 * captured on the typed model and re-serialized on save. Core itself only
 * carries the flag; the actual visual effect (shading the background
 * gradient toward the title placeholder's colour) is applied by
 * `pptx-viewer-shared`'s `getSlideBackgroundStyle`, consumed by all five
 * bindings (see `packages/shared/src/render/background-shade-to-title.ts`
 * and its end-to-end test `background-shade-to-title-render.test.ts`). It
 * remains a legacy PowerPoint 97-2003 hint not observed in this project's
 * real-world fixture corpus and not settable from any modern PowerPoint UI
 * (`docs/guide/limitations.md`). This test locks in the core parse/save
 * round-trip of the flag itself.
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

async function fixtureWithShadeToTitle(value: '0' | '1'): Promise<ArrayBuffer> {
	const zip = await JSZip.loadAsync(fixtureBytes());
	const slidePath = Object.keys(zip.files).find((p) => /^ppt\/slides\/slide\d+\.xml$/u.test(p))!;
	const xml = await zip.file(slidePath)!.async('string');
	expect(xml).toContain('<p:bgPr>');
	zip.file(slidePath, xml.replace('<p:bgPr>', `<p:bgPr shadeToTitle="${value}">`));
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('p:bgPr/@shadeToTitle', () => {
	it('parses an explicit "1" as true', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithShadeToTitle('1'));
		expect(data.slides[0]?.backgroundShadeToTitle).toBeTruthy();
	});

	it('leaves the field undefined when the attribute is absent', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		expect(data.slides[0]?.backgroundShadeToTitle).toBeUndefined();
	});

	it('round-trips through a full save/reload', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithShadeToTitle('1'));
		const slide = data.slides[0]!;
		expect(slide.backgroundShadeToTitle).toBeTruthy();

		slide.isDirty = true;
		const saved = await handler.save(data.slides);
		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		expect(reloaded.slides[0]?.backgroundShadeToTitle).toBeTruthy();
	});
});
