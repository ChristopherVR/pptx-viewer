import type { MediaPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveMediaView } from './media-view';

function media(overrides: Partial<MediaPptxElement> = {}): MediaPptxElement {
	return {
		type: 'media',
		id: 'm1',
		x: 0,
		y: 0,
		width: 320,
		height: 180,
		mediaType: 'video',
		...overrides,
	} as MediaPptxElement;
}

describe('resolveMediaView online video', () => {
	it('resolves onlineVideoEmbedUrl for a linked YouTube URL', () => {
		const view = resolveMediaView(
			media({ mediaPath: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', isLinked: true }),
			new Map(),
		);
		expect(view.onlineVideoEmbedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
	});

	it('leaves onlineVideoEmbedUrl undefined for a plain linked media file', () => {
		const view = resolveMediaView(media({ mediaData: 'data:video/mp4;base64,AAAA' }), new Map());
		expect(view.onlineVideoEmbedUrl).toBeUndefined();
	});
});
