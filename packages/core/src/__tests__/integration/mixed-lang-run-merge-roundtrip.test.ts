/**
 * `textStylesEqual` (the comparator `hasMixedTextStyles`/`areTextSegmentsUniform`
 * use to decide whether a paragraph's runs can be collapsed to a flat text
 * string) only compared a handful of visual style keys. Two adjacent runs
 * differing ONLY in round-trip-only `a:rPr` attributes such as `lang` /
 * `altLang` still counted as "the same style", so the whole paragraph was
 * flattened and rebuilt from a single string + a single resolved style,
 * discarding every run boundary and its per-run attributes.
 *
 * `issue-132-hr-deck.pptx` (an existing e2e fixture, pasted multi-language
 * Chinese/English text) reproduces this at scale: slide 1 authors 7 runs
 * alternating `lang="zh-CN"`/`lang="en-US"` with otherwise-identical
 * (inherited) run styling, and other slides in the same deck go as high as
 * 30+ authored runs. Before the fix, a no-edit round-trip collapsed these to
 * a handful of merged runs and concatenated their text.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/issue-132-hr-deck.pptx', import.meta.url),
);

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe('mixed-language adjacent runs are not merged on save', () => {
	it('preserves run count and per-run lang on an untouched slide1 round-trip', async () => {
		const original = await JSZip.loadAsync(readFileSync(FIXTURE));
		const originalXml = await original.file('ppt/slides/slide1.xml')!.async('string');
		const originalRunCount = (originalXml.match(/<a:r>/g) || []).length;
		const originalLangs = [...originalXml.matchAll(/<a:r><a:rPr[^>]*\blang="([^"]*)"/g)].map(
			(m) => m[1],
		);
		// Sanity: the fixture really does mix languages across multiple runs.
		expect(originalRunCount).toBeGreaterThan(1);
		expect(new Set(originalLangs).size).toBeGreaterThan(1);

		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		data.slides[0]!.isDirty = true;
		const saved = await handler.save(data.slides);

		const savedZip = await JSZip.loadAsync(saved);
		const savedXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');
		const savedRunCount = (savedXml.match(/<a:r>/g) || []).length;
		const savedLangs = [...savedXml.matchAll(/<a:r><a:rPr[^>]*\blang="([^"]*)"/g)].map((m) => m[1]);

		expect(savedRunCount).toBe(originalRunCount);
		expect(savedLangs).toStrictEqual(originalLangs);
	});
});
