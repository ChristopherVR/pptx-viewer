/**
 * A run-level `a:hlinkClick` can carry Microsoft's `ahyp:hlinkClr` vendor
 * extension (`{A12FA001-AC4F-418D-AE19-62706E023703}`, "hyperlink colour")
 * under its own `a:extLst`. Nothing parsed or re-emitted `a:hlinkClick`'s
 * `a:extLst` at all, so the whole vendor extension silently vanished on
 * save. `absolute-path-rels.pptx` (an existing e2e fixture) authors exactly
 * this construct on a template-editing-instructions text run.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/absolute-path-rels.pptx', import.meta.url),
);

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** Count `a:hlinkClick` nodes carrying the `ahyp:hlinkClr` extension across every slide part. */
async function countHlinkClr(zip: JSZip): Promise<number> {
	let total = 0;
	for (const name of Object.keys(zip.files)) {
		if (!/^ppt\/slides\/slide\d+\.xml$/.test(name)) {
			continue;
		}
		const xml = await zip.file(name)!.async('string');
		total += (xml.match(/ahyp:hlinkClr[^>]*val="tx"/g) || []).length;
	}
	return total;
}

describe('a:hlinkClick ahyp:hlinkClr extension round-trip', () => {
	it('re-emits the hyperlink colour extension on an untouched deck round-trip', async () => {
		const original = await JSZip.loadAsync(readFileSync(FIXTURE));
		const originalCount = await countHlinkClr(original);
		expect(originalCount).toBeGreaterThan(0);

		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		for (const slide of data.slides) {
			slide.isDirty = true;
		}
		const saved = await handler.save(data.slides);

		const savedZip = await JSZip.loadAsync(saved);
		const savedCount = await countHlinkClr(savedZip);
		expect(savedCount).toBe(originalCount);
	});
});
