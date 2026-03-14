import { describe, it, expect } from 'vitest';
import { MediaElementProcessor } from './elements/MediaElementProcessor';
import type { ElementProcessorContext } from './elements/ElementProcessor';
import type { PptxElement } from '../core';
import { MediaContext } from './media-context';

function makeContext(
	overrides: Partial<ElementProcessorContext> = {}
): ElementProcessorContext {
	return {
		mediaContext: new MediaContext('/out', 'media'),
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		semanticMode: true,
		processElements: async () => [],
		...overrides,
	};
}

function makeMediaElement(
	overrides: Record<string, unknown> = {}
): PptxElement {
	return {
		type: 'media',
		id: 'med_1',
		x: 0,
		y: 0,
		width: 640,
		height: 360,
		mediaType: 'video',
		mediaPath: 'ppt/media/video1.mp4',
		...overrides,
	} as unknown as PptxElement;
}

describe('MediaElementProcessor', () => {
	const processor = new MediaElementProcessor();

	// ── Type guard ──────────────────────────────────────────────────

	it('should report supportedTypes as ["media"]', () => {
		expect(processor.supportedTypes).toEqual(['media']);
	});

	it('should return null for non-media elements', async () => {
		const ctx = makeContext();
		const element = {
			type: 'shape',
			id: 's1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toBeNull();
	});

	// ── Video rendering ─────────────────────────────────────────────

	it('should render a video element with filename from path', async () => {
		const ctx = makeContext();
		const element = makeMediaElement();
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Video: video1.mp4');
	});

	it('should include path detail', async () => {
		const ctx = makeContext();
		const element = makeMediaElement();
		const result = await processor.process(element, ctx);
		expect(result).toContain('Path: ppt/media/video1.mp4');
	});

	it('should format duration as minutes:seconds', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({
			metadata: { duration: 125 },
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('Duration: 2:05');
	});

	it('should format zero duration correctly', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({
			metadata: { duration: 0 },
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('Duration: 0:00');
	});

	it('should format duration under 60 seconds', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({
			metadata: { duration: 45 },
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('Duration: 0:45');
	});

	// ── Audio rendering ─────────────────────────────────────────────

	it('should render an audio element with "Audio:" label', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({
			mediaType: 'audio',
			mediaPath: 'ppt/media/song.mp3',
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('Audio: song.mp3');
	});

	// ── Unknown media type ──────────────────────────────────────────

	it('should render unknown media type with "Media:" label', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({
			mediaType: 'unknown',
			mediaPath: 'ppt/media/file.bin',
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('Media: file.bin');
	});

	// ── Missing media path ──────────────────────────────────────────

	it('should use "embedded media" when path is absent', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({
			mediaPath: undefined,
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('Video: embedded media');
	});

	// ── Flags ───────────────────────────────────────────────────────

	it('should include Looping when loop is true', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({ loop: true });
		const result = await processor.process(element, ctx);
		expect(result).toContain('Looping');
	});

	it('should include Auto-play when autoPlay is true', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({ autoPlay: true });
		const result = await processor.process(element, ctx);
		expect(result).toContain('Auto-play');
	});

	it('should include "Plays across slides" flag', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({ playAcrossSlides: true });
		const result = await processor.process(element, ctx);
		expect(result).toContain('Plays across slides');
	});

	it('should combine multiple flags with pipe separator', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({
			loop: true,
			autoPlay: true,
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('Looping');
		expect(result).toContain('Auto-play');
		expect(result).toContain('|');
	});

	// ── Resolution ──────────────────────────────────────────────────

	it('should include resolution from metadata dimensions', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({
			metadata: { videoWidth: 1920, videoHeight: 1080 },
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('Resolution: 1920x1080');
	});

	it('should not include resolution when only width is present', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({
			metadata: { videoWidth: 1920 },
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toContain('Resolution');
	});

	// ── Missing media indicator ─────────────────────────────────────

	it('should indicate when media is missing', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({ mediaMissing: true });
		const result = await processor.process(element, ctx);
		expect(result).toContain('Media source is missing');
	});

	// ── MIME type ───────────────────────────────────────────────────

	it('should include MIME type detail when present', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({
			mediaMimeType: 'video/mp4',
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('MIME: video/mp4');
	});

	// ── Caption tracks ──────────────────────────────────────────────

	it('should render caption tracks', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({
			captionTracks: [
				{ label: 'English', language: 'en' },
				{ label: 'French', language: 'fr' },
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('Captions: English (en), French (fr)');
	});

	it('should not render captions section when tracks array is empty', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({
			captionTracks: [],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toContain('Captions');
	});

	// ── Poster frame ────────────────────────────────────────────────

	it('should render poster frame image when data URL present', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({
			posterFrameData:
				'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAAtJREFUCNdjYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg==',
		});
		const result = await processor.process(element, ctx);
		expect(result).toContain('poster');
		expect(result).toContain('./media/');
	});

	it('should skip poster frame when not a data URL', async () => {
		const ctx = makeContext();
		const element = makeMediaElement({
			posterFrameData: '/images/poster.png',
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toContain('poster');
	});

	// ── Output structure ────────────────────────────────────────────

	it('should wrap label in italic markers', async () => {
		const ctx = makeContext();
		const element = makeMediaElement();
		const result = await processor.process(element, ctx);
		expect(result).toMatch(/^\*\[Video: video1\.mp4\]\*/);
	});
});
