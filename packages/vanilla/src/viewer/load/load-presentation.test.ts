import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { MediaPptxElement, PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createDefaultRegistry, renderSlideStage } from '../render';
import { loadPresentation, resolveMediaUrls } from './load-presentation';
import { resolveSourceToBuffer } from './source';

const FIXTURE = resolve(__dirname, '../../../../../e2e/fixtures/sample-deck.pptx');

function readFixture(): ArrayBuffer {
	const bytes = readFileSync(FIXTURE);
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return buffer;
}

describe('loadPresentation (real .pptx happy path)', () => {
	it('parses a real deck and renders its first slide through the registry', async () => {
		const loaded = await loadPresentation(readFixture());
		try {
			expect(loaded.slides.length).toBeGreaterThan(0);
			expect(loaded.canvasSize.width).toBeGreaterThan(0);
			expect(loaded.canvasSize.height).toBeGreaterThan(0);
			expect(Array.isArray(loaded.embeddedFonts)).toBeTruthy();
			expect(loaded.digitalSignatureCount).toBeGreaterThanOrEqual(0);

			const stage = renderSlideStage({
				document,
				slide: loaded.slides[0],
				canvasSize: loaded.canvasSize,
				mediaDataUrls: loaded.mediaDataUrls,
				registry: createDefaultRegistry(),
				t: createTranslator(),
				scale: 0.5,
			});
			expect(stage.querySelectorAll('[data-element-id]').length).toBeGreaterThan(0);
		} finally {
			loaded.handler.dispose();
		}
	});

	it('rejects on invalid bytes without leaking the handler', async () => {
		await expect(loadPresentation(new ArrayBuffer(8))).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// resolveMediaUrls (G17: linked/external media source resolution)
// ---------------------------------------------------------------------------
describe('resolveMediaUrls', () => {
	function mediaElement(overrides: Partial<MediaPptxElement> = {}): MediaPptxElement {
		return {
			id: 'm1',
			type: 'media',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			mediaType: 'video',
			...overrides,
		} as MediaPptxElement;
	}

	// G17: a LINKED (TargetMode="External") element's mediaPath is already the
	// verbatim URL by the time it reaches here; it must play directly from
	// that URL, never be marked mediaMissing from a failed archive lookup.
	it('hands an external mediaPath straight to the URL map without touching the handler', async () => {
		const getMediaArrayBuffer = vi.fn(async () => undefined);
		const handler = { getMediaArrayBuffer, getImageData: vi.fn() } as unknown as PptxHandler;
		const media = mediaElement({ mediaPath: 'https://cdn.example.com/demo.mp4' });
		const slide: PptxSlide = { id: 's1', elements: [media] } as unknown as PptxSlide;
		const blobUrls: string[] = [];

		const urls = await resolveMediaUrls(handler, [slide], blobUrls);

		expect(urls.get('https://cdn.example.com/demo.mp4')).toBe('https://cdn.example.com/demo.mp4');
		expect(media.mediaMissing).not.toBeTruthy();
		expect(getMediaArrayBuffer).not.toHaveBeenCalled();
		expect(blobUrls).toHaveLength(0);
	});

	it('marks an embedded element missing when the archive lookup fails', async () => {
		const handler = {
			getMediaArrayBuffer: vi.fn(async () => undefined),
			getImageData: vi.fn(),
		} as unknown as PptxHandler;
		const media = mediaElement({ mediaPath: 'ppt/media/missing.mp4' });
		const slide: PptxSlide = { id: 's1', elements: [media] } as unknown as PptxSlide;

		await resolveMediaUrls(handler, [slide], []);

		expect(media.mediaMissing).toBeTruthy();
	});
});

describe('resolveSourceToBuffer', () => {
	it('normalises Uint8Array views to their exact byte range', async () => {
		const backing = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
		const view = new Uint8Array(backing.buffer, 2, 3);
		const buffer = await resolveSourceToBuffer(view);
		expect(Array.from(new Uint8Array(buffer))).toStrictEqual([2, 3, 4]);
	});

	it('passes ArrayBuffers through and reads Blobs', async () => {
		const raw = new Uint8Array([9, 8, 7]).buffer;
		await expect(resolveSourceToBuffer(raw)).resolves.toBe(raw);

		const blob = new Blob([new Uint8Array([1, 2])]);
		const fromBlob = await resolveSourceToBuffer(blob);
		expect(new Uint8Array(fromBlob)).toHaveLength(2);
	});
});
