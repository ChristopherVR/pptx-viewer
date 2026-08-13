/**
 * Regression guards for two save-pipeline defects that only show up when the
 * same deck is saved more than once, or when the output size is measured.
 *
 * 1. **Compression.** JSZip defaults to STORE. The pipeline never overrode it,
 *    so every saved package was written uncompressed and a 4.9 MB deck came
 *    back out at 7.5 MB from a no-op open-and-save.
 *
 * 2. **Run-count growth.** A paragraph-break segment is the literal "\n", and
 *    the paragraph writer split it into two empty halves and emitted a run for
 *    each. That appended one empty `a:r` to the closing paragraph and one to
 *    the opening one; the next load read them back as segments, which emitted
 *    their own empty runs, so `a:r` grew by one per paragraph on every save,
 *    without bound.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, it, expect, beforeAll } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';

const fixtureUrl = (name: string) =>
	fileURLToPath(new URL(`../../../../../e2e/fixtures/${name}`, import.meta.url));

const TEXT_FIXTURE = fixtureUrl('text-features.pptx');

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Count occurrences of an element tag in a raw XML part. */
function countTag(xml: string, tag: string): number {
	return (xml.match(new RegExp(`<${tag}[ />]`, 'g')) ?? []).length;
}

describe('save pipeline: compression', () => {
	beforeAll(() => {
		if (!existsSync(TEXT_FIXTURE)) {
			throw new Error(`missing committed fixture ${TEXT_FIXTURE}`);
		}
	});

	it('writes DEFLATE-compressed parts, not STORE', async () => {
		const bytes = readFileSync(TEXT_FIXTURE);
		const handler = new PptxHandler();
		const loaded = await handler.load(toArrayBuffer(bytes));
		const saved = await handler.save(loaded.slides);

		const zip = await JSZip.loadAsync(saved);
		const slide = zip.file('ppt/slides/slide1.xml');
		expect(slide).toBeTruthy();

		// A STORE-d entry has compressedSize === uncompressedSize. Slide XML is
		// highly repetitive, so DEFLATE must beat it comfortably.
		const uncompressed = await slide!.async('string');
		const meta = (slide as unknown as { _data?: { compressedSize?: number } })._data;
		expect(meta?.compressedSize).toBeDefined();
		expect(meta!.compressedSize!).toBeLessThan(Buffer.byteLength(uncompressed, 'utf8'));

		// And the package as a whole must not balloon past the source.
		expect(saved.byteLength).toBeLessThan(bytes.byteLength * 1.1);
	});
});

describe('save pipeline: idempotency', () => {
	it('keeps the run structure stable across five save cycles', async () => {
		let bytes: Uint8Array = readFileSync(TEXT_FIXTURE);
		const runCounts: number[] = [];
		const paragraphCounts: number[] = [];
		const segmentCounts: number[] = [];

		for (let cycle = 0; cycle < 5; cycle++) {
			const zip = await JSZip.loadAsync(bytes);
			const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
			runCounts.push(countTag(slideXml, 'a:r'));
			paragraphCounts.push(countTag(slideXml, 'a:p'));

			const handler = new PptxHandler();
			const loaded = await handler.load(toArrayBuffer(bytes));
			segmentCounts.push(
				loaded.slides[0].elements.reduce(
					(total, el) =>
						total + ('textSegments' in el && el.textSegments ? el.textSegments.length : 0),
					0,
				),
			);
			bytes = await handler.save(loaded.slides);
		}

		// Every cycle must agree with the first. Before the fix this read
		// 21, 23, 25, 27, 29 - two extra runs per save, forever.
		expect(runCounts).toStrictEqual(Array<number>(5).fill(runCounts[0]));
		expect(paragraphCounts).toStrictEqual(Array<number>(5).fill(paragraphCounts[0]));
		expect(segmentCounts).toStrictEqual(Array<number>(5).fill(segmentCounts[0]));

		// And the fixed point must be the SOURCE structure, not a grown one:
		// the first cycle reads the untouched fixture off disk.
		const finalZip = await JSZip.loadAsync(bytes);
		const finalXml = await finalZip.file('ppt/slides/slide1.xml')!.async('string');
		expect(countTag(finalXml, 'a:r')).toBe(runCounts[0]);
	});
});
