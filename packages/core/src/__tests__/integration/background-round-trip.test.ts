import fs from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';

/**
 * Integration: round-trip of slide backgrounds that use an rId-referenced
 * `a:blipFill` image (rather than a data-URL on slide.backgroundImage).
 *
 * Regression guard: the save pipeline previously stripped `a:blipFill` when
 * `slide.backgroundImage` either was unset or failed to parse as a data URL,
 * emitting `<p:bgPr><a:effectLst/></p:bgPr>` — which is both lossy and
 * schema-invalid (effectLst without a preceding fill).
 */
describe('background round-trip with rId-referenced blipFill (V8-Updated.pptx)', () => {
	// Fixture lives at the repo root; tests run from packages/core.
	const fixturePath = path.resolve(__dirname, '../fixtures/embedded-assets-sample.pptx');
	const hasFixture = fs.existsSync(fixturePath);

	it.skipIf(!hasFixture)(
		'preserves <a:blipFill> inside <p:bg> after save for slide2 and slide3',
		async () => {
			const fileBytes = fs.readFileSync(fixturePath);
			const buffer = fileBytes.buffer.slice(
				fileBytes.byteOffset,
				fileBytes.byteOffset + fileBytes.byteLength,
			) as ArrayBuffer;

			const handler = new PptxHandler();
			const data = await handler.load(buffer);
			expect(data.slides.length).toBeGreaterThanOrEqual(3);

			const saved = await handler.save(data.slides);
			const zip = await JSZip.loadAsync(saved);

			for (const slideNumber of [2, 3] as const) {
				const entry = zip.file(`ppt/slides/slide${slideNumber}.xml`);
				expect(entry, `ppt/slides/slide${slideNumber}.xml missing from saved archive`).toBeTruthy();
				const xml = await entry!.async('string');

				// 1. A <p:bg> with a blipFill must survive the round-trip.
				const bgMatch = xml.match(/<p:bg\b[^>]*>(?<inner>[\s\S]*?)<\/p:bg>/u);
				expect(bgMatch, `slide${slideNumber} has no <p:bg>`).toBeTruthy();
				const bgInner = bgMatch!.groups!.inner;
				expect(bgInner, `slide${slideNumber} <p:bg> lost its <a:blipFill>`).toContain(
					'<a:blipFill',
				);

				// 2. Any <p:bgPr> emitted must be schema-valid: a fill child
				//    (blipFill / solidFill / gradFill / pattFill / noFill / grpFill)
				//    must precede any <a:effectLst>. No empty bgPr with only
				//    effectLst.
				const bgPrMatch = bgInner.match(/<p:bgPr\b[^>]*>(?<inner>[\s\S]*?)<\/p:bgPr>/u);
				if (bgPrMatch) {
					const bgPrInner = bgPrMatch.groups!.inner;
					const fillIdx = [
						'<a:blipFill',
						'<a:solidFill',
						'<a:gradFill',
						'<a:pattFill',
						'<a:noFill',
						'<a:grpFill',
					]
						.map((token) => bgPrInner.indexOf(token))
						.filter((i) => i >= 0)
						.sort((a, b) => a - b)[0];
					expect(
						fillIdx,
						`slide${slideNumber} <p:bgPr> has no fill child (schema-invalid)`,
					).toBeGreaterThanOrEqual(0);
					const effectIdx = bgPrInner.indexOf('<a:effectLst');
					if (effectIdx >= 0) {
						expect(
							fillIdx,
							`slide${slideNumber} <p:bgPr> emits <a:effectLst> before the fill (schema-invalid order)`,
						).toBeLessThan(effectIdx);
					}
				}
			}
		},
	);
});
