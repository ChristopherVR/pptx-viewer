import type { MediaPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getOnlineVideoEmbed, resolveOnlineVideoEmbed } from './online-video';

function media(overrides: Partial<MediaPptxElement>): MediaPptxElement {
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

describe('resolveOnlineVideoEmbed', () => {
	it('returns undefined for an unlinked (embedded) media path', () => {
		expect(
			resolveOnlineVideoEmbed('https://www.youtube.com/watch?v=abc123', false),
		).toBeUndefined();
	});

	it('returns undefined for a plain linked media file', () => {
		expect(resolveOnlineVideoEmbed('https://cdn.example.com/clip.mp4', true)).toBeUndefined();
	});

	it('returns undefined for a non-http(s) or unparsable path', () => {
		expect(resolveOnlineVideoEmbed('ppt/media/media1.mp4', true)).toBeUndefined();
		expect(resolveOnlineVideoEmbed(undefined, true)).toBeUndefined();
	});

	it('normalises a YouTube watch URL to the embed form', () => {
		expect(
			resolveOnlineVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ', true),
		).toStrictEqual({
			embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
		});
	});

	it('normalises a youtu.be short link', () => {
		expect(resolveOnlineVideoEmbed('https://youtu.be/dQw4w9WgXcQ', true)).toStrictEqual({
			embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
		});
	});

	it('normalises a YouTube Shorts link', () => {
		expect(
			resolveOnlineVideoEmbed('https://www.youtube.com/shorts/dQw4w9WgXcQ', true),
		).toStrictEqual({
			embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
		});
	});

	it('passes an already-embed YouTube URL through unchanged', () => {
		expect(
			resolveOnlineVideoEmbed('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', true),
		).toStrictEqual({ embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' });
	});

	it('normalises a Vimeo watch URL to the player form', () => {
		expect(resolveOnlineVideoEmbed('https://vimeo.com/76979871', true)).toStrictEqual({
			embedUrl: 'https://player.vimeo.com/video/76979871',
		});
	});

	it('passes an already-player Vimeo URL through', () => {
		expect(resolveOnlineVideoEmbed('https://player.vimeo.com/video/76979871', true)).toStrictEqual({
			embedUrl: 'https://player.vimeo.com/video/76979871',
		});
	});
});

describe('getOnlineVideoEmbed', () => {
	it('resolves a linked YouTube media element', () => {
		const element = media({ isLinked: true, mediaPath: 'https://www.youtube.com/watch?v=abc123' });
		expect(getOnlineVideoEmbed(element)).toStrictEqual({
			embedUrl: 'https://www.youtube.com/embed/abc123',
		});
	});

	it('returns undefined for a non-media element', () => {
		expect(
			getOnlineVideoEmbed({ id: 'x', type: 'shape', x: 0, y: 0, width: 1, height: 1 } as never),
		).toBeUndefined();
	});

	it('returns undefined for an audio media element', () => {
		const element = media({
			mediaType: 'audio',
			isLinked: true,
			mediaPath: 'https://www.youtube.com/watch?v=abc123',
		});
		expect(getOnlineVideoEmbed(element)).toBeUndefined();
	});
});
