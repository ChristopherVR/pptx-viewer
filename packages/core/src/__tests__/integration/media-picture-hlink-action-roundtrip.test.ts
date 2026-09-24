/**
 * Real PowerPoint's Insert > Action "Play"/"Object Action" dialog on a video
 * or audio placeholder writes `<a:hlinkClick action="ppaction://media"
 * r:id=""/>` on the media picture's OWN `p:nvPicPr/p:cNvPr` (COM-verified:
 * `Shape.ActionSettings(1).Action` reports 12, `ppActionPlay`, for a shape
 * carrying this markup). `PptxHandlerRuntimePictureParsing.ts`'s media
 * branch (a `p:pic` with a `p:nvPr` media reference, real PowerPoint's usual
 * authoring shape for a video/audio placeholder) never called
 * `parseElementActions` at all, so this action was silently dropped on load:
 * the editor never knew the shape had one, and it never reached the saved
 * file. `audio-embed.pptx` (an existing e2e fixture) carries exactly this
 * markup on its audio icon.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/audio-embed.pptx', import.meta.url),
);

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe('media picture ppaction://media hlinkClick', () => {
	it('parses the action off the media p:nvPicPr/p:cNvPr', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		const media = data.slides[0]!.elements.find((element) => element.type === 'media');
		expect(media?.type).toBe('media');
		expect(media?.actionClick?.action).toBe('ppaction://media');
	});

	it('re-emits a:hlinkClick (with the required empty r:id) on save', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		data.slides[0]!.isDirty = true;
		const saved = await handler.save(data.slides);

		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toMatch(
			/<p:nvPicPr>[\s\S]*?<a:hlinkClick[^>]*action="ppaction:\/\/media"[^>]*>/,
		);
		expect(slideXml).toMatch(/<a:hlinkClick[^>]*r:id=""[^>]*action="ppaction:\/\/media"/);

		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const reloadedMedia = reloaded.slides[0]!.elements.find((element) => element.type === 'media');
		expect(reloadedMedia?.actionClick?.action).toBe('ppaction://media');
	});
});
