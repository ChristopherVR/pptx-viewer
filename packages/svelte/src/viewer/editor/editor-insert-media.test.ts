import type { CanvasSize } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { buildMediaInsertElement, mediaTypeOfFile } from './editor-insert-media';

const CANVAS: CanvasSize = { width: 960, height: 540 };

describe('editor-insert-media mediaTypeOfFile', () => {
	it('classifies audio and video mime types', () => {
		expect(mediaTypeOfFile('audio/mpeg')).toBe('audio');
		expect(mediaTypeOfFile('video/mp4')).toBe('video');
	});

	it('returns null for anything else', () => {
		expect(mediaTypeOfFile('image/png')).toBeNull();
		expect(mediaTypeOfFile('')).toBeNull();
	});
});

describe('editor-insert-media buildMediaInsertElement', () => {
	it('builds a centred audio element at the fixed player-strip size', async () => {
		const file = new File(['fake-audio-bytes'], 'clip.mp3', { type: 'audio/mpeg' });
		const el = await buildMediaInsertElement(file, CANVAS);
		expect(el).not.toBeNull();
		expect(el?.type).toBe('media');
		if (el?.type === 'media') {
			expect(el.mediaType).toBe('audio');
			expect(el.mediaMimeType).toBe('audio/mpeg');
			expect(el.mediaData?.startsWith('data:audio/mpeg;base64')).toBeTruthy();
		}
		expect(el?.width).toBe(420);
		expect(el?.height).toBe(64);
		expect(el?.x).toBe(Math.round((CANVAS.width - 420) / 2));
	});

	it('resolves null for an unsupported file type', async () => {
		const file = new File(['not media'], 'doc.pdf', { type: 'application/pdf' });
		await expect(buildMediaInsertElement(file, CANVAS)).resolves.toBeNull();
	});
});
