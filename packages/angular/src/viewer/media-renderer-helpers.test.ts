import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { MediaCaptionTrack, MediaPptxElement, PptxElement } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import {
	MEDIA_FALLBACK_ICONS,
	hasPersistentAudio,
	mediaFallbackIcon,
	mediaFallbackLabelKey,
	stopAllPersistentAudio,
} from '../internal/shared';
import { componentSource } from './component-source.test-support';
import {
	asMediaElement,
	buildTrimFragment,
	mediaFallbackFor,
	mediaSurfaceFor,
	registerCrossSlideAudio,
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

describe('registerCrossSlideAudio', () => {
	afterEach(() => {
		stopAllPersistentAudio();
	});

	function crossSlideAudio(overrides: Partial<MediaPptxElement> = {}): MediaPptxElement {
		return mediaEl({
			mediaType: 'audio',
			mediaData: 'data:audio/mpeg;base64,AAAA',
			mediaMimeType: 'audio/mpeg',
			playAcrossSlides: true,
			loop: true,
			volume: 0.5,
			trimStartMs: 2000,
			...overrides,
		});
	}

	it('registers playAcrossSlides audio with the persistent manager', () => {
		expect(registerCrossSlideAudio(crossSlideAudio(), 'data:audio/mpeg;base64,AAAA')).toBeTruthy();
		expect(hasPersistentAudio('m1')).toBeTruthy();

		// The persistent element is DOCUMENT-level: destroying the slide's own DOM
		// on advance cannot touch it, which is the whole point.
		const persistent = document.querySelector<HTMLAudioElement>(
			'[data-pptx-persistent-audio="m1"]',
		);
		expect(persistent?.getAttribute('src')).toBe('data:audio/mpeg;base64,AAAA');
		expect(persistent?.loop).toBeTruthy();
		expect(persistent?.volume).toBe(0.5);
	});

	it('is idempotent per element id (re-entering the slide never restarts the track)', () => {
		registerCrossSlideAudio(crossSlideAudio(), 'data:audio/mpeg;base64,AAAA');
		const persistent = document.querySelector('[data-pptx-persistent-audio="m1"]');
		registerCrossSlideAudio(crossSlideAudio(), 'data:audio/mpeg;base64,AAAA');
		expect(document.querySelectorAll('[data-pptx-persistent-audio="m1"]')).toHaveLength(1);
		expect(document.querySelector('[data-pptx-persistent-audio="m1"]')).toBe(persistent);
	});

	it('declines video, non-cross-slide audio, and a missing source', () => {
		expect(
			registerCrossSlideAudio(
				crossSlideAudio({ mediaType: 'video' }),
				'data:video/mp4;base64,AAAA',
			),
		).toBeFalsy();
		expect(
			registerCrossSlideAudio(
				crossSlideAudio({ playAcrossSlides: undefined }),
				'data:audio/mpeg;base64,AAAA',
			),
		).toBeFalsy();
		expect(registerCrossSlideAudio(crossSlideAudio(), undefined)).toBeFalsy();
		expect(hasPersistentAudio('m1')).toBeFalsy();
	});
});

/**
 * The show must paint no native media transport, and neither must a STILL of a
 * slide.
 *
 * `interactive` alone got this backwards: a running show is non-interactive, so
 * `[controls]="!interactive()"` turned the transport ON, and a full-bleed
 * background video then drew Chrome's own black scrubber across the bottom of
 * the presented slide, on top of the presentation toolbar. Adding `&&
 * !presenting()` fixed the show and left every still wrong the same way: the
 * presenter console's panes and the thumbnail rail are non-interactive AND not
 * presenting, so the console painted a transport over a slide the speaker
 * cannot play. Both bindings now defer to `showControls()`, which asks the
 * shared `mediaTransportVisible` and so cannot drift from the other four.
 *
 * Asserted against the authored template text because this package has no
 * TestBed (see `vitest.config.ts`), the same technique the other component
 * contract specs use.
 */
describe('the media transport during a show', () => {
	it('defers both bindings to the shared show/still rule', () => {
		const source = componentSource(
			dirname(fileURLToPath(import.meta.url)),
			'media-renderer.component.ts',
		);
		const bindings = [...source.matchAll(/\[controls\]="(?<expression>[^"]+)"/gu)].map(
			(match) => match.groups?.expression,
		);
		expect(bindings).toHaveLength(2);
		for (const binding of bindings) {
			expect(binding).toBe('showControls()');
		}
		// ...and the computed behind it is the shared predicate, not a local guess.
		expect(source).toContain(
			'mediaTransportVisible({ ...this.surface(), canvasTransport: false })',
		);
		expect(source).toContain('mediaSurfaceFor(this.interactive(), this.presenting())');
	});
});

/**
 * Issue #147: a slide-transition overlay is a STILL of the outgoing slide, so
 * media chrome painted there rides along inside the transition - the reporter
 * caught a play triangle drifting through a morph out of a background video.
 * These are the template's `@if`s, factored out so they can be asserted without
 * a TestBed (this package has none, see `vitest.config.ts`).
 */
describe('mediaFallbackFor', () => {
	const still = mediaSurfaceFor(false, false);
	const show = mediaSurfaceFor(false, true);
	const canvas = mediaSurfaceFor(true, false);

	it('paints the poster frame and no chrome on a still of a slide', () => {
		expect(mediaFallbackFor(mediaEl(), true, still)).toStrictEqual({
			poster: true,
			dimPoster: false,
			badge: 'none',
			placeholder: 'none',
		});
	});

	it('paints no placeholder box for unresolvable media on a still', () => {
		expect(mediaFallbackFor(mediaEl(), false, still).placeholder).toBe('none');
	});

	it('paints no chrome during a running show either', () => {
		expect(mediaFallbackFor(mediaEl({ mediaMissing: true }), true, show).badge).toBe('none');
	});

	it('keeps the play badge and the placeholder box on the authoring canvas', () => {
		expect(mediaFallbackFor(mediaEl(), true, canvas).badge).toBe('play');
		expect(mediaFallbackFor(mediaEl(), false, canvas).placeholder).toBe('typed');
	});

	// Reading a boolean `badge` as "paint a badge" drew a PLAY triangle over
	// media the package had failed to find - the opposite of what React said.
	it('asks for the not-found mark, never a play badge, over missing media', () => {
		expect(mediaFallbackFor(mediaEl({ mediaMissing: true }), true, canvas).badge).toBe('missing');
		expect(mediaFallbackFor(mediaEl({ mediaMissing: true }), false, canvas).placeholder).toBe(
			'missing',
		);
	});

	it('names the clip type in the placeholder, rather than a flat "Media"', () => {
		const box = mediaFallbackFor(mediaEl({ mediaType: 'video' }), false, canvas);
		expect(mediaFallbackLabelKey(box, 'video')).toBe('pptx.media.videoClip');
		expect(mediaFallbackIcon(box, 'video')).toStrictEqual(MEDIA_FALLBACK_ICONS.play);
	});

	it('dims a poster standing in for missing media, on the canvas only', () => {
		expect(mediaFallbackFor(mediaEl({ mediaMissing: true }), true, canvas).dimPoster).toBeTruthy();
		expect(mediaFallbackFor(mediaEl({ mediaMissing: true }), true, still).dimPoster).toBeFalsy();
	});

	it('is what the template branches on, not a locally re-derived rule', () => {
		const source = componentSource(
			dirname(fileURLToPath(import.meta.url)),
			'media-renderer.component.ts',
		);
		expect(source).toContain('@else if (fallback().poster && poster(); as posterSrc)');
		expect(source).toContain("@if (fallback().badge !== 'none')");
		expect(source).toContain("@else if (fallback().placeholder !== 'none')");
	});
});
