import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

/**
 * Legacy `p:cmLst` / `CT_Comment` has no NATIVE reply model, but a reply chain
 * still round-trips through it via the Office 2013 `p15:threadingInfo`
 * extension (see `utils/legacy-comment-threading`), which records each
 * reply's parent as an (`authorId`, `idx`) pair. A reply used to be silently
 * dropped on save before that extension was written; the fix in between
 * (before p15 support existed) promoted any threaded legacy comment to the
 * modern Office 2021 threaded-comment part (`p188`) instead of dropping it.
 * That promotion is now reserved for what legacy genuinely cannot express:
 * `@`-mentions, or a reply that is already in the modern format.
 */

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deckWithLegacyComment(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	const slide = createSlide('Blank')
		.addText('Review', { x: 10, y: 10, width: 200, height: 40 })
		.build();
	slide.comments = [
		{
			id: '0',
			author: 'Alice Example',
			createdAt: '2024-06-01T10:00:00Z',
			text: 'Please update this chart.',
			x: 12,
			y: 24,
		},
	];
	data.slides.push(slide);
	return handler.save(data.slides);
}

describe('reply to a legacy comment', () => {
	it('threads a plain-text reply via p15:threadingInfo and stays in the legacy part', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(await deckWithLegacyComment()));
		const parent = data.slides[0].comments![0];
		expect(parent.format).toBeUndefined();

		data.slides[0].comments = [
			{
				...parent,
				replies: [
					{
						id: 'reply-1',
						text: 'Done, updated it.',
						author: 'Bob Example',
						createdAt: '2024-06-02T09:00:00Z',
						parentId: parent.id,
						threadId: parent.id,
					},
				],
			},
		];
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);

		const legacyPath = Object.keys(zip.files).find((path) =>
			/^ppt\/comments\/comment\d+\.xml$/u.test(path),
		);
		expect(legacyPath, 'legacy comment part missing').toBeDefined();
		const legacyXml = await zip.file(legacyPath!)!.async('string');
		expect(legacyXml).toContain('Please update this chart.');
		expect(legacyXml).toContain('Done, updated it.');
		expect(legacyXml).toContain('{C676402C-5697-4E1C-873F-D02D1690AC5C}');
		expect(legacyXml).toContain('p15:parentCm');

		// The reply must not ALSO be promoted to the modern part.
		const modernPath = Object.keys(zip.files).find((path) =>
			/^ppt\/comments\/modernComment\d+\.xml$/u.test(path),
		);
		expect(modernPath).toBeUndefined();

		const reloaded = await new PptxHandler().load(toArrayBuffer(saved));
		const comments = reloaded.slides[0].comments ?? [];
		expect(comments).toHaveLength(1);
		expect(comments[0].format).toBeUndefined();
		expect(comments[0].text).toBe('Please update this chart.');
		expect(comments[0].replies?.map((reply) => reply.text)).toStrictEqual(['Done, updated it.']);
		expect(comments[0].replies?.[0].parentId).toBe(comments[0].id);
		expect(comments[0].replies?.[0].threadId).toBe(comments[0].id);
	});

	it('leaves a reply-free legacy comment in the legacy part', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(await deckWithLegacyComment()));
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);

		expect(
			Object.keys(zip.files).some((path) => /^ppt\/comments\/comment\d+\.xml$/u.test(path)),
		).toBeTruthy();
		expect(
			Object.keys(zip.files).some((path) => /^ppt\/comments\/modernComment\d+\.xml$/u.test(path)),
		).toBeFalsy();
	});

	it('still promotes to the modern part when a reply carries @-mentions', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(await deckWithLegacyComment()));
		const parent = data.slides[0].comments![0];

		data.slides[0].comments = [
			{
				...parent,
				replies: [
					{
						id: 'reply-1',
						text: '@Bob thanks',
						author: 'Bob Example',
						parentId: parent.id,
						mentions: [{ personId: 'Bob Example', startIndex: 0, length: 4 }],
					},
				],
			},
		];
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);

		const modernPath = Object.keys(zip.files).find((path) =>
			/^ppt\/comments\/modernComment\d+\.xml$/u.test(path),
		);
		expect(modernPath, 'threaded comment part missing').toBeDefined();

		const legacyPath = Object.keys(zip.files).find((path) =>
			/^ppt\/comments\/comment\d+\.xml$/u.test(path),
		);
		expect(legacyPath).toBeUndefined();
	});
});
