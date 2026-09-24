/**
 * `CT_TextField` (`a:fld`) permits its own `a:pPr` child (paragraph
 * properties scoped to the field, distinct from the run's `a:rPr`). An
 * UNSTYLED `<a:pPr/>` parses through fast-xml-parser as the empty STRING
 * (the same trap `<p:spPr/>` hits elsewhere in this codebase; see
 * `ensureXmlChild`), so a truthy-object test on the parsed value missed it
 * and the field's own (empty but present) `a:pPr` silently vanished on
 * save. `absolute-path-rels.pptx` (an existing e2e fixture) has a
 * `slidenum` field authored exactly this way on several slides.
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

/** Count `<a:fld>...<a:pPr/>...` occurrences across every slide part in a zip. */
async function countFieldOwnPPr(zip: JSZip): Promise<number> {
	let total = 0;
	for (const name of Object.keys(zip.files)) {
		if (!/^ppt\/slides\/slide\d+\.xml$/.test(name)) {
			continue;
		}
		const xml = await zip.file(name)!.async('string');
		total += (
			xml.match(
				/<a:fld[^>]*>[^<]*<a:rPr[^>]*(?:\/>|>[^<]*<\/a:rPr>)\s*<a:pPr(?:\/>|><\/a:pPr>)/g,
			) || []
		).length;
	}
	return total;
}

describe('a:fld own a:pPr round-trip', () => {
	it('re-emits the field a:pPr on an untouched deck round-trip', async () => {
		const original = await JSZip.loadAsync(readFileSync(FIXTURE));
		const originalCount = await countFieldOwnPPr(original);
		expect(originalCount).toBeGreaterThan(0);

		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		for (const slide of data.slides) {
			slide.isDirty = true;
		}
		const saved = await handler.save(data.slides);

		const savedZip = await JSZip.loadAsync(saved);
		const savedCount = await countFieldOwnPPr(savedZip);
		expect(savedCount).toBe(originalCount);
	});
});
