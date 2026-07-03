import type { MediaCaptionTrack, MediaPptxElement, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	asMediaElement,
	buildTrimFragment,
	resolveCaptionTracks,
	resolveMediaSrc,
} from './media-renderer-helpers';

function mediaEl(overrides: Partial<MediaPptxElement> = {}): MediaPptxElement {
	return {
		id: 'm1',
		type: 'media',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as MediaPptxElement;
}

describe('asMediaElement', () => {
	it('narrows a media element', () => {
		const el = mediaEl();
		expect(asMediaElement(el)).toBe(el);
	});

	it('returns undefined for non-media elements', () => {
		const shape = { id: 's1', type: 'shape', x: 0, y: 0, width: 1, height: 1 } as PptxElement;
		expect(asMediaElement(shape)).toBeUndefined();
	});
});

describe('resolveMediaSrc', () => {
	it('prefers inline mediaData', () => {
		const el = mediaEl({ mediaData: 'data:video/mp4;base64,AAAA', mediaPath: 'ppt/media/v.mp4' });
		expect(resolveMediaSrc(el, new Map([['ppt/media/v.mp4', 'blob:x']]))).toBe(
			'data:video/mp4;base64,AAAA',
		);
	});

	it('falls back to the resolved archive path', () => {
		const el = mediaEl({ mediaPath: 'ppt/media/v.mp4' });
		expect(resolveMediaSrc(el, new Map([['ppt/media/v.mp4', 'blob:x']]))).toBe('blob:x');
	});

	it('returns undefined when nothing resolves', () => {
		expect(resolveMediaSrc(mediaEl(), new Map())).toBeUndefined();
	});
});

describe('buildTrimFragment', () => {
	it('is empty without trim points', () => {
		expect(buildTrimFragment(mediaEl())).toBe('');
	});

	it('encodes start and end in seconds', () => {
		expect(buildTrimFragment(mediaEl({ trimStartMs: 1500, trimEndMs: 4200 }))).toBe(
			'#t=1.500,4.200',
		);
	});

	it('encodes an open-ended start with a leading empty part', () => {
		expect(buildTrimFragment(mediaEl({ trimEndMs: 3000 }))).toBe('#t=,3.000');
	});
});

describe('resolveCaptionTracks', () => {
	it('returns empty for no tracks', () => {
		expect(resolveCaptionTracks(undefined)).toStrictEqual([]);
	});

	it('wraps inline content in a data URL and drops sourceless tracks', () => {
		const tracks: MediaCaptionTrack[] = [
			{
				id: 't1',
				label: 'EN',
				language: 'en',
				kind: 'subtitles',
				content: 'WEBVTT',
				isDefault: true,
			},
			{ id: 't2', label: 'ES', language: 'es', kind: 'captions', src: 'blob:cc' },
			{ id: 't3', label: 'FR', language: 'fr', kind: 'subtitles' },
		];
		const resolved = resolveCaptionTracks(tracks);
		expect(resolved).toHaveLength(2);
		expect(resolved[0].src).toBe(`data:text/vtt;charset=utf-8,${encodeURIComponent('WEBVTT')}`);
		expect(resolved[0].isDefault).toBeTruthy();
		expect(resolved[1].src).toBe('blob:cc');
		expect(resolved[1].isDefault).toBeFalsy();
	});
});
