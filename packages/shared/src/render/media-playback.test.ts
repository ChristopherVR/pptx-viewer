import { describe, expect, it } from 'vitest';

import { startMediaAutoplay } from './media-playback';

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
