/**
 * `buildSrcRectXml` treated any crop inset with a magnitude of 0.0001
 * (0.01%) or less as "no crop" and told the caller to delete `a:srcRect`
 * entirely. That threshold was meant to absorb floating-point noise from an
 * edit that cancelled itself out, but it also discarded a genuinely authored
 * tiny crop: `solution-explorer.pptx` slide 12's second picture authors
 * `<a:srcRect l="2" r="2"/>` (0.00002, i.e. 0.002%), which rounds to a real
 * nonzero attribute and must survive, not vanish on a save that rewrites the
 * shape for an unrelated reason.
 *
 * The fix compares the ROUNDED `a:srcRect` attribute value (thousandths of a
 * percent, matching what actually gets written) instead of the raw fraction,
 * so only a crop that rounds all the way to 0 on every side counts as "no
 * crop".
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/solution-explorer.pptx', import.meta.url),
);

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe('a tiny (but nonzero) authored a:srcRect crop is not dropped', () => {
	it('keeps both slide-12 pictures crops (l="356" r="356" and l="2" r="2") on a dirty save', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		const slide12 = data.slides[11]!;
		slide12.isDirty = true;
		const saved = await handler.save(data.slides);

		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide12.xml')!.async('string');
		const srcRects = [...slideXml.matchAll(/<a:srcRect[^>]*>/g)].map((m) => m[0]);

		expect(srcRects).toHaveLength(2);
		expect(srcRects).toContainEqual(expect.stringContaining('l="356"'));
		expect(srcRects).toContainEqual(expect.stringContaining('l="2"'));
	});
});
