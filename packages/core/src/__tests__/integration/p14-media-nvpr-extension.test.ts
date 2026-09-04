import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { MediaPptxElement } from '../../core/types';

/**
 * G18: `p14:media` (`p14:trim`/`p14:fade`/`p14:bmkLst`/`@r:embed`) lives under
 * `p:pic/p:nvPicPr/p:nvPr/p:extLst/p:ext[@uri="{DAA4B4D4-...}"]`, a sibling of
 * the picture's own `a:videoFile`/`a:audioFile` reference - NOT under the
 * slide's animation timing tree (`p:timing//p:video/p:cMediaNode`), which is
 * where an earlier version of this parser looked. Ground truth for the
 * location: `e2e/fixtures/Image_JPG_PNG_Audio_M4_A_Video_MP_4_..._ff1095731b.pptx`,
 * slide11.xml, has `<p:nvPr><a:videoFile r:link="rId2"/><p:extLst><p:ext
 * uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}"><p14:media r:embed="rId3"/>
 * </p:ext></p:extLst></p:nvPr>`.
 *
 * That fixture's own `p14:media` carries no trim/fade (real-world decks often
 * write the extension purely as an embed fallback), so this test patches in a
 * `p14:trim` whose numbers are COM-measured ground truth, not invented: opening
 * a copy of this exact fixture in real PowerPoint, setting
 * `Shape.MediaFormat.StartPoint = 18374` and `.EndPoint = 29596` (milliseconds,
 * absolute-from-start; the clip's own `MediaFormat.Length` is 30034) and
 * saving produced `<p14:trim st="18374" end="438"/>` verbatim - i.e. `end` is
 * NOT the absolute stop (29596) but the distance from the clip's tail
 * (30034 - 29596 = 438). See G19 in `PptxHandlerRuntimeMediaParsingUtils.ts`.
 */

const FIXTURES = join(__dirname, '../../../../../e2e/fixtures');
const FIXTURE_NAME = 'Image_JPG_PNG_Audio_M4_A_Video_MP_4_12_Slides_36_8_MB_ff1095731b.pptx';

function requireFixture(name: string): Uint8Array {
	const path = join(FIXTURES, name);
	if (!existsSync(path)) {
		throw new Error(`missing fixture ${path}`);
	}
	return new Uint8Array(readFileSync(path));
}

describe('p14:media parsed from p:nvPr/p:extLst (not the timing tree)', () => {
	it('reads trim from a real PowerPoint-authored p14:media under nvPr', async () => {
		const source = requireFixture(FIXTURE_NAME);
		const zip = await JSZip.loadAsync(source);
		const slidePart = zip.file('ppt/slides/slide11.xml');
		expect(slidePart, 'fixture must carry slide11.xml with a p14:media reference').not.toBeNull();
		const slideXml = await slidePart!.async('string');

		// Ground truth: the fixture's own p14:media is embed-only (no trim).
		expect(slideXml).toContain(
			'<p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" r:embed="rId3"/>',
		);

		// Patch in the COM-measured p14:trim (see module doc for the exact
		// PowerPoint round-trip that produced these numbers).
		const patched = slideXml.replace(
			'<p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" r:embed="rId3"/>',
			'<p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" r:embed="rId3">' +
				'<p14:trim st="18374" end="438"/>' +
				'</p14:media>',
		);
		expect(patched).not.toBe(slideXml);
		zip.file('ppt/slides/slide11.xml', patched);
		const bytes = await zip.generateAsync({ type: 'uint8array' });

		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const video = loaded.slides
			.flatMap((slide) => slide.elements)
			.find(
				(element): element is MediaPptxElement =>
					element.type === 'media' && element.mediaType === 'video',
			);
		expect(video).toBeDefined();
		// `st` is absolute ms from the start; `end` is the raw distance-from-tail
		// value, NOT converted to an absolute stop (that conversion needs the
		// clip's real duration, only known once the browser decodes it; see
		// `packages/shared/src/render/media-trim-fade-scheduler.ts`).
		expect(video?.trimStartMs).toBe(18374);
		expect(video?.trimEndMs).toBe(438);
		// The legacy a:videoFile/r:link reference still resolves normally; the
		// p14:media embed is a fallback, not a replacement, for this fixture.
		expect(video?.mediaPath).toContain('media1.mp4');
	});

	it('falls back to the p14:media r:embed target when the primary reference cannot resolve', async () => {
		const source = requireFixture(FIXTURE_NAME);
		const zip = await JSZip.loadAsync(source);
		const slidePart = zip.file('ppt/slides/slide11.xml');
		const slideXml = await slidePart!.async('string');

		// Break the legacy videoFile relationship id so only the p14:media
		// embed can resolve a path, mirroring a deck referenced only via the
		// extension (no legacy a:videoFile/a:audioFile at all).
		const patched = slideXml.replace(
			'<a:videoFile r:link="rId2"/>',
			'<a:videoFile r:link="rIdMissing"/>',
		);
		expect(patched).not.toBe(slideXml);
		zip.file('ppt/slides/slide11.xml', patched);
		const bytes = await zip.generateAsync({ type: 'uint8array' });

		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const video = loaded.slides
			.flatMap((slide) => slide.elements)
			.find(
				(element): element is MediaPptxElement =>
					element.type === 'media' && element.mediaType === 'video',
			);
		expect(video).toBeDefined();
		expect(video?.mediaPath).toContain('media1.mp4');
	});
});
