// @vitest-environment jsdom
/**
 * `animation-media-playback` tests. jsdom supplies `HTMLMediaElement` (which the
 * lookup guards on) and a real `querySelectorAll`; jsdom's media element has no
 * playback backend, so `play` / `pause` are stubbed on plain objects instead.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	applyMediaCommandVerb,
	executeMediaCommandInDom,
	findMediaElementByElementId,
	runMediaCommand,
} from './animation-media-playback';
import type { TimelineStepCommand } from './animation-timeline-types';

interface MockMedia {
	play: ReturnType<typeof vi.fn>;
	pause: ReturnType<typeof vi.fn>;
	paused: boolean;
	currentTime: number;
}

function createMockMedia(paused = true): MockMedia {
	return {
		play: vi.fn(() => Promise.resolve()),
		pause: vi.fn(),
		paused,
		currentTime: 0,
	};
}

function asMedia(mock: MockMedia): HTMLMediaElement {
	return mock as unknown as HTMLMediaElement;
}

function command(overrides: Partial<TimelineStepCommand> = {}): TimelineStepCommand {
	return { type: 'call', command: 'playFrom(0.0)', targetId: 'video1', ...overrides };
}

describe('applyMediaCommandVerb', () => {
	it('seeks then plays for playFrom', () => {
		const mock = createMockMedia();
		expect(
			applyMediaCommandVerb(asMedia(mock), { verb: 'playFrom', seekSeconds: 2.5 }),
		).toBeTruthy();
		expect(mock.currentTime).toBe(2.5);
		expect(mock.play).toHaveBeenCalledOnce();
	});

	it('treats a playFrom with no seek target as a seek to zero', () => {
		const mock = createMockMedia();
		mock.currentTime = 9;
		applyMediaCommandVerb(asMedia(mock), { verb: 'playFrom' });
		expect(mock.currentTime).toBe(0);
	});

	it('plays, pauses and stops', () => {
		const playing = createMockMedia(false);
		playing.currentTime = 12;
		expect(applyMediaCommandVerb(asMedia(playing), { verb: 'stop' })).toBeTruthy();
		expect(playing.pause).toHaveBeenCalledOnce();
		expect(playing.currentTime).toBe(0);

		const paused = createMockMedia();
		expect(applyMediaCommandVerb(asMedia(paused), { verb: 'play' })).toBeTruthy();
		expect(paused.play).toHaveBeenCalledOnce();

		const toPause = createMockMedia(false);
		expect(applyMediaCommandVerb(asMedia(toPause), { verb: 'pause' })).toBeTruthy();
		expect(toPause.pause).toHaveBeenCalledOnce();
	});

	it('togglePlay plays when paused and pauses when playing', () => {
		const paused = createMockMedia(true);
		applyMediaCommandVerb(asMedia(paused), { verb: 'togglePlay' });
		expect(paused.play).toHaveBeenCalledOnce();

		const playing = createMockMedia(false);
		applyMediaCommandVerb(asMedia(playing), { verb: 'togglePlay' });
		expect(playing.pause).toHaveBeenCalledOnce();
	});

	it('swallows a rejected play() promise (autoplay policy) instead of throwing', () => {
		const mock = createMockMedia();
		vi.spyOn(mock, 'play').mockRejectedValue(new Error('NotAllowedError'));
		expect(() => applyMediaCommandVerb(asMedia(mock), { verb: 'play' })).not.toThrow();
	});

	it('swallows a throwing currentTime setter (not seekable yet)', () => {
		const mock = createMockMedia();
		const el = {
			...mock,
			set currentTime(_seconds: number) {
				throw new Error('InvalidStateError');
			},
			get currentTime(): number {
				return 0;
			},
		};
		expect(() =>
			applyMediaCommandVerb(el as unknown as HTMLMediaElement, {
				verb: 'playFrom',
				seekSeconds: 3,
			}),
		).not.toThrow();
	});
});

describe('findMediaElementByElementId', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('finds a media node wrapped by a data-element-id host', () => {
		document.body.innerHTML =
			'<div data-element-id="other"><video></video></div>' +
			'<div data-element-id="video1"><video id="wanted"></video></div>';
		expect(findMediaElementByElementId('video1')?.id).toBe('wanted');
	});

	it('finds a media node that carries data-element-id itself', () => {
		document.body.innerHTML = '<audio id="wanted" data-element-id="audio1"></audio>';
		expect(findMediaElementByElementId('audio1')?.id).toBe('wanted');
	});

	it('scopes the search to the supplied root so a thumbnail copy is not hit', () => {
		document.body.innerHTML =
			'<div id="rail"><div data-element-id="video1"><video id="thumb"></video></div></div>' +
			'<div id="stage"><div data-element-id="video1"><video id="stageVideo"></video></div></div>';
		const stage = document.querySelector('#stage');
		expect(findMediaElementByElementId('video1', stage)?.id).toBe('stageVideo');
	});

	it('returns undefined when the id is absent or the host holds no media', () => {
		document.body.innerHTML = '<div data-element-id="video1"><span></span></div>';
		expect(findMediaElementByElementId('video1')).toBeUndefined();
		expect(findMediaElementByElementId('missing')).toBeUndefined();
	});
});

describe('runMediaCommand', () => {
	it('returns false when the resolver finds nothing', () => {
		expect(runMediaCommand(command(), () => undefined)).toBeFalsy();
	});

	it('returns false for a command string with no browser mapping', () => {
		const mock = createMockMedia();
		expect(
			runMediaCommand(command({ command: 'doSomething(1)' }), () => asMedia(mock)),
		).toBeFalsy();
		expect(mock.play).not.toHaveBeenCalled();
	});

	it('resolves by the command target id', () => {
		const mock = createMockMedia();
		const resolve = vi.fn(() => asMedia(mock));
		expect(runMediaCommand(command({ command: 'play', targetId: 'v7' }), resolve)).toBeTruthy();
		expect(resolve).toHaveBeenCalledWith('v7');
	});
});

describe('executeMediaCommandInDom', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('drives the media node found under the frame root', () => {
		document.body.innerHTML = '<div id="stage"><div data-element-id="video1"><video/></div></div>';
		const stage = document.querySelector<HTMLElement>('#stage');
		const video = stage!.querySelector('video')!;
		const play = vi.fn(() => Promise.resolve());
		Object.defineProperty(video, 'play', { value: play });

		expect(executeMediaCommandInDom(command({ command: 'play' }), () => stage)).toBeTruthy();
		expect(play).toHaveBeenCalledOnce();
	});

	it('no-ops when the target is not on the stage', () => {
		expect(executeMediaCommandInDom(command({ command: 'play' }))).toBeFalsy();
	});
});
