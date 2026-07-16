import type { MediaPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveMediaPreviewUrl } from './media-preview';

const media = (patch: Partial<MediaPptxElement>): MediaPptxElement => ({
	type: 'media',
	id: 'm',
	x: 0,
	y: 0,
	width: 10,
	height: 10,
	...patch,
});

describe('resolveMediaPreviewUrl', () => {
	it('prefers embedded data and resolves relationship-backed media paths', () => {
		expect(
			resolveMediaPreviewUrl(
				media({ mediaData: 'data:audio/a', mediaPath: 'ppt/media/a.mp3' }),
				new Map([['ppt/media/a.mp3', 'blob:path']]),
			),
		).toBe('data:audio/a');
		expect(
			resolveMediaPreviewUrl(
				media({ mediaPath: 'ppt/media/a.mp3' }),
				new Map([['ppt/media/a.mp3', 'blob:path']]),
			),
		).toBe('blob:path');
	});
});
