import { describe, it, expect, vi } from 'vitest';

import type { PptxElement } from '../../core';
import type { MediaContext } from '../media-context';
import type { ElementProcessorContext } from './ElementProcessor';
import { MediaElementProcessor } from './MediaElementProcessor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<ElementProcessorContext> = {}): ElementProcessorContext {
	return {
		mediaContext: {
			saveImage: vi.fn(async () => './media/slide1-poster-image-001.png'),
		} as unknown as MediaContext,
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		processElements: vi.fn(async () => []),
		...overrides,
	};
}

function makeMediaElement(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'media',
		id: 'med_1',
		x: 0,
		y: 0,
		width: 640,
		height: 360,
		mediaType: 'video',
		mediaPath: 'ppt/media/media1.mp4',
		...overrides,
	} as unknown as PptxElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mediaElementProcessor', () => {
	const processor = new MediaElementProcessor();

	it('reports supported types as media', () => {
		expect(processor.supportedTypes).toStrictEqual(['media']);
	});

	it('returns null for non-media element', async () => {
		const el = {
			type: 'text',
			id: 'txt_1',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		} as unknown as PptxElement;
		const result = await processor.process(el, makeCtx());
		expect(result).toBeNull();
	});

	it('renders video element with label', async () => {
		const result = await processor.process(makeMediaElement(), makeCtx());
		expect(result).toContain('*[Video: media1.mp4]*');
	});

	it('renders audio element with label', async () => {
		const el = makeMediaElement({
			mediaType: 'audio',
			mediaPath: 'ppt/media/audio1.wav',
		});
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('*[Audio: audio1.wav]*');
	});

	it('renders unknown media type with generic label', async () => {
		const el = makeMediaElement({ mediaType: 'unknown' });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('*[Media: media1.mp4]*');
	});

	it('uses "embedded media" when path is not set', async () => {
		const el = makeMediaElement({ mediaPath: undefined });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('embedded media');
	});

	it('includes media path in details', async () => {
		const result = await processor.process(makeMediaElement(), makeCtx());
		expect(result).toContain('Path: ppt/media/media1.mp4');
	});

	it('formats duration in minutes:seconds', async () => {
		const el = makeMediaElement({ metadata: { duration: 125 } });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('Duration: 2:05');
	});

	it('formats short duration correctly', async () => {
		const el = makeMediaElement({ metadata: { duration: 5 } });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('Duration: 0:05');
	});

	it('includes resolution when available', async () => {
		const el = makeMediaElement({
			metadata: { videoWidth: 1920, videoHeight: 1080 },
		});
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('Resolution: 1920x1080');
	});

	it('includes looping flag', async () => {
		const el = makeMediaElement({ loop: true });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('Looping');
	});

	it('includes auto-play flag', async () => {
		const el = makeMediaElement({ autoPlay: true });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('Auto-play');
	});

	it('includes plays-across-slides flag', async () => {
		const el = makeMediaElement({ playAcrossSlides: true });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('Plays across slides');
	});

	it('includes MIME type', async () => {
		const el = makeMediaElement({ mediaMimeType: 'video/mp4' });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('MIME: video/mp4');
	});

	it('extracts poster frame image', async () => {
		const el = makeMediaElement({
			posterFrameData: 'data:image/png;base64,poster',
		});
		const ctx = makeCtx();
		const result = await processor.process(el, ctx);
		expect(ctx.mediaContext.saveImage).toHaveBeenCalledWith(
			'data:image/png;base64,poster',
			'slide1-poster',
		);
		expect(result).toContain('![Video: media1.mp4 poster]');
	});

	it('skips poster frame when not a data URL', async () => {
		const el = makeMediaElement({
			posterFrameData: 'not-a-data-url',
		});
		const ctx = makeCtx();
		await processor.process(el, ctx);
		expect(ctx.mediaContext.saveImage).not.toHaveBeenCalled();
	});

	it('renders caption tracks', async () => {
		const el = makeMediaElement({
			captionTracks: [
				{ label: 'English', language: 'en' },
				{ label: 'Spanish', language: 'es' },
			],
		});
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('*Captions: English (en), Spanish (es)*');
	});

	it('shows media missing warning', async () => {
		const el = makeMediaElement({ mediaMissing: true });
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('*Media source is missing*');
	});

	it('combines multiple details with pipe separator', async () => {
		const el = makeMediaElement({
			metadata: { duration: 60 },
			loop: true,
			autoPlay: true,
		});
		const result = await processor.process(el, makeCtx());
		expect(result).toContain('|');
	});
});
