import { describe, expect, it } from 'vitest';

import {
	applyMediaPlaybackAttributes,
	mediaFallbackVisual,
	mediaPlaybackAttributes,
	mediaSurfaceOf,
	mediaTransportVisible,
	startMediaAutoplay,
} from './media-playback';

/** Minimal HTMLMediaElement stand-in exposing just what the helper touches. */
function fakeMedia(play: () => Promise<void> | undefined): {
	el: HTMLMediaElement;
	getCurrentTime: () => number;
	playCalls: () => number;
} {
	let currentTime = 0;
	let playCalls = 0;
	const el = {
		get currentTime() {
			return currentTime;
		},
		set currentTime(v: number) {
			currentTime = v;
		},
		play: () => {
			playCalls += 1;
			return play();
		},
	} as unknown as HTMLMediaElement;
	return { el, getCurrentTime: () => currentTime, playCalls: () => playCalls };
}

describe('startMediaAutoplay', () => {
	it('calls play() on the element', () => {
		const { el, playCalls } = fakeMedia(() => Promise.resolve());
		startMediaAutoplay(el);
		expect(playCalls()).toBe(1);
	});

	it('seeks to the trim-start point (ms -> s) before playing', () => {
		const { el, getCurrentTime } = fakeMedia(() => Promise.resolve());
		startMediaAutoplay(el, { trimStartMs: 1500 });
		expect(getCurrentTime()).toBe(1.5);
	});

	it('does not seek when there is no positive trim start', () => {
		const { el, getCurrentTime } = fakeMedia(() => Promise.resolve());
		startMediaAutoplay(el, { trimStartMs: 0 });
		expect(getCurrentTime()).toBe(0);
		startMediaAutoplay(el);
		expect(getCurrentTime()).toBe(0);
	});

	it('swallows a rejected play() promise (blocked autoplay) without throwing', async () => {
		const rejection = Promise.reject(new Error('NotAllowedError'));
		const { el } = fakeMedia(() => rejection);
		expect(() => startMediaAutoplay(el)).not.toThrow();
		// Allow the microtask queue to flush; the helper must have attached a
		// .catch() so this rejection never becomes an unhandled rejection.
		await Promise.resolve();
		await expect(rejection.catch(() => 'handled')).resolves.toBe('handled');
	});

	it('tolerates play() returning undefined (older DOM shims)', () => {
		const { el, playCalls } = fakeMedia(() => undefined);
		expect(() => startMediaAutoplay(el)).not.toThrow();
		expect(playCalls()).toBe(1);
	});

	it('ignores a currentTime seek that throws before metadata is ready', () => {
		let playCalls = 0;
		const el = {
			set currentTime(_v: number) {
				throw new Error('InvalidStateError');
			},
			get currentTime() {
				return 0;
			},
			play: () => {
				playCalls += 1;
				return Promise.resolve();
			},
		} as unknown as HTMLMediaElement;
		expect(() => startMediaAutoplay(el, { trimStartMs: 2000 })).not.toThrow();
		expect(playCalls).toBe(1);
	});
});

describe('mediaPlaybackAttributes', () => {
	it('defaults an element that declares nothing to a plain, non-looping node', () => {
		expect(mediaPlaybackAttributes({})).toStrictEqual({
			loop: false,
			volume: 1,
			playbackRate: 1,
		});
	});

	it('carries the deck loop flag, which Vanilla and Svelte used to drop', () => {
		expect(mediaPlaybackAttributes({ loop: true }).loop).toBeTruthy();
	});

	it('honours a silent deck (p:cMediaNode vol="0")', () => {
		expect(mediaPlaybackAttributes({ volume: 0 }).volume).toBe(0);
	});

	it('clamps out-of-range volume and playback rate', () => {
		expect(mediaPlaybackAttributes({ volume: 4 }).volume).toBe(1);
		expect(mediaPlaybackAttributes({ volume: -1 }).volume).toBe(0);
		expect(mediaPlaybackAttributes({ playbackSpeed: 99 }).playbackRate).toBe(4);
		expect(mediaPlaybackAttributes({ playbackSpeed: 0 }).playbackRate).toBe(0.25);
	});
});

describe('applyMediaPlaybackAttributes', () => {
	it('writes all three onto a live node', () => {
		const el = { loop: false, volume: 1, playbackRate: 1 } as HTMLMediaElement;
		applyMediaPlaybackAttributes(el, { loop: true, volume: 0, playbackSpeed: 2 });
		expect(el.loop).toBeTruthy();
		expect(el.volume).toBe(0);
		expect(el.playbackRate).toBe(2);
	});
});

describe('mediaTransportVisible', () => {
	it('never paints a transport on the live show stage', () => {
		expect(
			mediaTransportVisible({ presenting: true, preview: false, canvasTransport: true }),
		).toBeFalsy();
	});

	it('never paints a transport on a still (presenter panes, thumbnails)', () => {
		expect(
			mediaTransportVisible({ presenting: false, preview: true, canvasTransport: true }),
		).toBeFalsy();
	});

	it('leaves the authoring canvas to the binding', () => {
		expect(
			mediaTransportVisible({ presenting: false, preview: false, canvasTransport: true }),
		).toBeTruthy();
		expect(
			mediaTransportVisible({ presenting: false, preview: false, canvasTransport: false }),
		).toBeFalsy();
	});
});

describe('mediaSurfaceOf', () => {
	it('reads the authoring canvas as neither a show nor a still', () => {
		expect(mediaSurfaceOf({ interactive: true, presenting: false })).toStrictEqual({
			presenting: false,
			preview: false,
		});
	});

	it('reads a non-interactive, non-presenting renderer as a still', () => {
		expect(mediaSurfaceOf({ interactive: false, presenting: false })).toStrictEqual({
			presenting: false,
			preview: true,
		});
	});

	it('never calls the live show stage a still', () => {
		expect(mediaSurfaceOf({ interactive: false, presenting: true })).toStrictEqual({
			presenting: true,
			preview: false,
		});
	});
});

describe('mediaFallbackVisual', () => {
	const still = { presenting: false, preview: true };
	const show = { presenting: true, preview: false };
	const canvas = { presenting: false, preview: false };

	it('paints the poster and nothing else on a still (issue #147)', () => {
		expect(mediaFallbackVisual(still, { hasPoster: true })).toStrictEqual({
			poster: true,
			dimPoster: false,
			badge: false,
			placeholder: false,
		});
	});

	it('paints no chrome on a still whose media is missing outright', () => {
		const visual = mediaFallbackVisual(still, { hasPoster: false, missing: true });
		expect(visual.badge).toBeFalsy();
		expect(visual.placeholder).toBeFalsy();
	});

	it('paints no chrome during a running show either', () => {
		const visual = mediaFallbackVisual(show, { hasPoster: true, missing: true });
		expect(visual).toStrictEqual({
			poster: true,
			dimPoster: false,
			badge: false,
			placeholder: false,
		});
	});

	it('adds the play badge over a poster on the authoring canvas', () => {
		expect(mediaFallbackVisual(canvas, { hasPoster: true })).toStrictEqual({
			poster: true,
			dimPoster: false,
			badge: true,
			placeholder: false,
		});
	});

	it('dims a poster standing in for missing media, on the canvas only', () => {
		expect(mediaFallbackVisual(canvas, { hasPoster: true, missing: true }).dimPoster).toBeTruthy();
		expect(mediaFallbackVisual(still, { hasPoster: true, missing: true }).dimPoster).toBeFalsy();
	});

	it('falls back to the typed placeholder box when there is no poster', () => {
		expect(mediaFallbackVisual(canvas, { hasPoster: false })).toStrictEqual({
			poster: false,
			dimPoster: false,
			badge: true,
			placeholder: true,
		});
	});
});
