import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

/**
 * Legacy `p:cmLst` / `CT_Comment` has no reply model at all, so a reply added
 * to a legacy comment used to be dropped on save without a warning: the legacy
 * writer never emitted `replies`, and nothing promoted the thread. The thread
 * is now written to the modern Office 2021 threaded-comment part (`p188`),
 * which models `replyLst` natively.
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
	it('is promoted to the modern threaded part and survives a reload', async () => {
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

		const modernPath = Object.keys(zip.files).find((path) =>
			/^ppt\/comments\/modernComment\d+\.xml$/u.test(path),
		);
		expect(modernPath, 'threaded comment part missing').toBeDefined();
		const modernXml = await zip.file(modernPath!)!.async('string');
		expect(modernXml).toContain('<p188:replyLst>');
		expect(modernXml).toContain('Done, updated it.');
		expect(modernXml).toContain('Please update this chart.');

		// The promoted thread must not also be left behind in the legacy part.
		const legacyPath = Object.keys(zip.files).find((path) =>
			/^ppt\/comments\/comment\d+\.xml$/u.test(path),
		);
		expect(legacyPath).toBeUndefined();

		const reloaded = await new PptxHandler().load(toArrayBuffer(saved));
		const comments = reloaded.slides[0].comments ?? [];
		expect(comments).toHaveLength(1);
		expect(comments[0].format).toBe('modern');
		expect(comments[0].text).toBe('Please update this chart.');
		expect(comments[0].replies?.map((reply) => reply.text)).toStrictEqual(['Done, updated it.']);
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
});
