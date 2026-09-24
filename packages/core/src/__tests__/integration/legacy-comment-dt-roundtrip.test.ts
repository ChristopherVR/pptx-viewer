import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * Core round-trip audit 2026-09-24, item 3 (legacy counterpart):
 * `PptxSlideCommentsXmlFactory.resolveCreatedAt` had the same bug as the
 * modern comment path: an already-valid `@dt` was reformatted through
 * `Date.parse` -> `new Date(...).toISOString()`, which always renders in
 * UTC. A source `@dt` with no explicit UTC/offset marker is read by
 * `Date.parse` as LOCAL time, so the reformat silently shifted the visible
 * clock time by the local machine's offset on every save, even one that
 * never touched the comment.
 */
describe('legacy p:cm@dt survives an untouched dirty save', () => {
	it('keeps an already-valid @dt exactly as authored, with no UTC reformatting', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slide = createSlide('Blank')
			.addText('Review', { x: 10, y: 10, width: 200, height: 40 })
			.build();
		slide.comments = [
			{
				id: '0',
				author: 'Alice Example',
				// No trailing "Z"/offset: Date.parse reads this as LOCAL time.
				createdAt: '2024-01-15T10:30:00',
				text: 'Please update this chart.',
				x: 12,
				y: 24,
			},
		];
		data.slides.push(slide);
		const baseBytes = await handler.save(data.slides);

		const loadHandler = new PptxHandler();
		const loaded = await loadHandler.load(toArrayBuffer(baseBytes));
		expect(loaded.slides[0].comments?.[0]?.createdAt).toBe('2024-01-15T10:30:00');

		// Force-dirty save without editing the comment.
		loaded.slides[0].isDirty = true;
		const savedBytes = await loadHandler.save(loaded.slides);
		const zip = await JSZip.loadAsync(savedBytes);
		const commentsPath = Object.keys(zip.files).find((path) =>
			/^ppt\/comments\/comment\d+\.xml$/u.test(path),
		);
		expect(commentsPath, 'legacy comment part missing').toBeDefined();
		const commentsXml = await zip.file(commentsPath!)!.async('string');
		expect(commentsXml).toContain('dt="2024-01-15T10:30:00"');

		const reloaded = await new PptxHandler().load(toArrayBuffer(savedBytes));
		expect(reloaded.slides[0].comments?.[0]?.createdAt).toBe('2024-01-15T10:30:00');
	});
});
