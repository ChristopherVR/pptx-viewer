import type { MediaPptxElement } from 'pptx-viewer-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const registerPersistentAudioMock = vi.fn();
vi.mock(import('./media-persistent-audio'), () => ({
	registerPersistentAudio: registerPersistentAudioMock,
	hasPersistentAudio: vi.fn(),
	stopAllPersistentAudio: vi.fn(),
	pauseAllPersistentAudio: vi.fn(),
	resumeAllPersistentAudio: vi.fn(),
}));

// Imported after the mock so `registerCrossSlideAudio` binds to the mocked
// `registerPersistentAudio`.
const { registerCrossSlideAudio } = await import('./cross-slide-audio');

function makeAudioElement(overrides: Partial<MediaPptxElement> = {}): MediaPptxElement {
	return {
		id: 'media-1',
		type: 'media',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		mediaType: 'audio',
		playAcrossSlides: true,
		...overrides,
	} as MediaPptxElement;
}

beforeEach(() => {
	registerPersistentAudioMock.mockClear();
});

describe('registerCrossSlideAudio', () => {
	it('returns false and does not register when playAcrossSlides is not set', () => {
		const el = makeAudioElement({ playAcrossSlides: undefined });
		expect(registerCrossSlideAudio(el, 'blob:src')).toBeFalsy();
		expect(registerPersistentAudioMock).not.toHaveBeenCalled();
	});

	it('returns false for a non-audio media element', () => {
		const el = makeAudioElement({ mediaType: 'video' });
		expect(registerCrossSlideAudio(el, 'blob:src')).toBeFalsy();
		expect(registerPersistentAudioMock).not.toHaveBeenCalled();
	});

	it('returns false when there is no resolved source', () => {
		expect(registerCrossSlideAudio(makeAudioElement(), undefined)).toBeFalsy();
		expect(registerPersistentAudioMock).not.toHaveBeenCalled();
	});

	it('registers with the resolved playback settings and returns true', () => {
		const el = makeAudioElement({
			mediaMimeType: 'audio/mpeg',
			volume: 0.5,
			trimStartMs: 2000,
			loop: true,
		});

		expect(registerCrossSlideAudio(el, 'blob:src')).toBeTruthy();
		expect(registerPersistentAudioMock).toHaveBeenCalledWith(
			'media-1',
			'blob:src',
			'audio/mpeg',
			true,
			0.5,
			2,
		);
	});

	it('defaults trim start to 0, loop to false, and volume to 1 when unset', () => {
		registerCrossSlideAudio(makeAudioElement(), 'blob:src');
		expect(registerPersistentAudioMock).toHaveBeenCalledWith(
			'media-1',
			'blob:src',
			undefined,
			false,
			1,
			0,
		);
	});
});
