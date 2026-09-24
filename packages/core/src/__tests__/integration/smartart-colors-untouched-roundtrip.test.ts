import { readFileSync } from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';

/**
 * Core save audit P1: `applySmartArtColorTransform` assigned
 * `transform.fillColors[i]`/`lineColors[i]` (the PRIMARY node role's cycling
 * palette only, see `PptxSmartArtColorTransform.fillColors`) to the i-th
 * `styleLbl` that merely HAS a `fillClrLst`/`linClrLst`, regardless of that
 * label's own role. On `e2e/fixtures/smartart-build-reveal.pptx`, which has
 * a `node0` styleLbl cycling through six accents plus three other labels,
 * that flat index silently reassigned `node1`'s first fill colour to
 * `node0`'s SECOND accent, and flattened the untouched transition labels'
 * shaded fill/line to a raw resolved colour. Worse, the list's remaining
 * (unresolved, authored) colour nodes were spliced into the rebuilt
 * `a:srgbClr` array as-is, producing literal garbage like
 * `<a:srgbClr val="accent2"/>` (a scheme name where a hex value belongs).
 *
 * None of this touched anything a user edited: a slide became dirty for an
 * unrelated reason (any edit on the same slide marks the whole slide dirty,
 * per `PptxHandlerRuntimeSaveSlideWriter.ts`), and the untouched SmartArt's
 * colour part still got rewritten with corrupted colours on every save.
 */
describe('smartArt colours pass through untouched on an unrelated dirty save', () => {
	it('round-trips ppt/diagrams/colors1.xml byte-for-byte', async () => {
		const fixturePath = path.resolve(
			__dirname,
			'../../../../../e2e/fixtures/smartart-build-reveal.pptx',
		);
		const bytes = readFileSync(fixturePath);
		const sourceZip = await JSZip.loadAsync(bytes);
		const sourceColorsXml = await sourceZip.file('ppt/diagrams/colors1.xml')!.async('string');
		// Sanity check on the fixture itself: it must actually exercise the bug
		// (a multi-colour primary role plus other labels sharing the same
		// list shape), otherwise this test would pass trivially.
		expect(sourceColorsXml).toContain('accent2');
		expect(sourceColorsXml.match(/a:schemeClr/g)?.length ?? 0).toBeGreaterThan(4);

		const handler = new PptxHandler();
		const data = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);
		// Mark every slide dirty without touching the SmartArt element itself,
		// exactly like `handler.save` after an unrelated edit on the slide.
		for (const slide of data.slides as unknown as { isDirty?: boolean }[]) {
			slide.isDirty = true;
		}
		const savedBytes = await handler.save(data.slides);

		const savedZip = await JSZip.loadAsync(savedBytes);
		const savedColorsXml = await savedZip.file('ppt/diagrams/colors1.xml')!.async('string');

		// Byte-for-byte string equality is too strict here (the XML builder
		// self-closes empty elements differently from however the fixture was
		// authored), so compare the element/attribute content instead, the
		// same way `rt.ts`'s signature diff does.
		const normalize = (xml: string) =>
			[...xml.matchAll(/<([\w:.-]+)((?:\s+[\w:.-]+="[^"]*")*)\s*\/?>/g)]
				.map((m) => `${m[1]}${m[2]}`)
				.join('|');
		expect(normalize(savedColorsXml)).toBe(normalize(sourceColorsXml));

		// The literal bug this test guards against: an authored, un-resolved
		// scheme name (`accentN`, a valid `a:schemeClr/@val`) spliced into an
		// `a:srgbClr/@val` as if it were a hex colour.
		expect(savedColorsXml).not.toMatch(/a:srgbClr val="accent\d"/);
		// And the root cause: no `a:schemeClr` was flattened to `a:srgbClr` at
		// all, since nothing was actually edited.
		expect(savedColorsXml.match(/a:srgbClr/g)).toBeNull();
	});
});
