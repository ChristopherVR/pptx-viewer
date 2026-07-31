// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { TimelineStepCommand } from '../utils/animation-timeline';
import {
	registerMediaElement,
	getRegisteredMediaElement,
	clearMediaElementRegistry,
	executeMediaCommand,
} from './media-element-registry';

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

function asMediaElement(mock: MockMedia): HTMLMediaElement {
	return mock as unknown as HTMLMediaElement;
}

function command(overrides: Partial<TimelineStepCommand> = {}): TimelineStepCommand {
	return { type: 'call', command: 'playFrom(0.0)', targetId: 'video1', ...overrides };
}

describe('media-element-registry', () => {
	beforeEach(() => {
		clearMediaElementRegistry();
	});

	it('registers and looks up a media element by id', () => {
		const mock = createMockMedia();
		registerMediaElement('video1', asMediaElement(mock));
		expect(getRegisteredMediaElement('video1')).toBe(asMediaElement(mock));
	});

	it('unregister only removes the entry when it still points at the same node', () => {
		const first = createMockMedia();
		const second = createMockMedia();
		const unregisterFirst = registerMediaElement('video1', asMediaElement(first));
		// A newer registration replaces the first.
		registerMediaElement('video1', asMediaElement(second));
		// Late unmount of the first must not clobber the newer node.
		unregisterFirst();
		expect(getRegisteredMediaElement('video1')).toBe(asMediaElement(second));
	});
});

describe('executeMediaCommand', () => {
	beforeEach(() => {
		clearMediaElementRegistry();
	});

	it('returns false when no media element is registered for the target', () => {
		expect(executeMediaCommand(command())).toBeFalsy();
	});

	it('returns false for an unrecognised command string', () => {
		const mock = createMockMedia();
		registerMediaElement('video1', asMediaElement(mock));
		expect(executeMediaCommand(command({ command: 'doSomething(1)' }))).toBeFalsy();
		expect(mock.play).not.toHaveBeenCalled();
	});

	it('seeks and plays for playFrom', () => {
		const mock = createMockMedia();
		registerMediaElement('video1', asMediaElement(mock));
		expect(executeMediaCommand(command({ command: 'playFrom(2.5)' }))).toBeTruthy();
		expect(mock.currentTime).toBe(2.5);
		expect(mock.play).toHaveBeenCalledOnce();
	});

	it('plays for play', () => {
		const mock = createMockMedia();
		registerMediaElement('video1', asMediaElement(mock));
		expect(executeMediaCommand(command({ command: 'play' }))).toBeTruthy();
		expect(mock.play).toHaveBeenCalledOnce();
	});

	it('pauses for pause', () => {
		const mock = createMockMedia(false);
		registerMediaElement('video1', asMediaElement(mock));
		expect(executeMediaCommand(command({ command: 'pause' }))).toBeTruthy();
		expect(mock.pause).toHaveBeenCalledOnce();
	});

	it('pauses and rewinds for stop', () => {
		const mock = createMockMedia(false);
		mock.currentTime = 12;
		registerMediaElement('video1', asMediaElement(mock));
		expect(executeMediaCommand(command({ command: 'stop' }))).toBeTruthy();
		expect(mock.pause).toHaveBeenCalledOnce();
		expect(mock.currentTime).toBe(0);
	});

	it('falls back to the shared data-element-id DOM lookup when nothing is registered', () => {
		// Only `PresentationMediaController` registers, so a `p:cmd` aimed at media
		// rendered anywhere else used to no-op in React while the other four
		// bindings (which query the stage by `data-element-id`) drove it fine.
		document.body.innerHTML =
			'<div id="stage"><div data-element-id="video1"><video></video></div></div>';
		const stage = document.querySelector<HTMLElement>('#stage');
		const video = stage!.querySelector('video')!;
		const play = vi.fn(() => Promise.resolve());
		Object.defineProperty(video, 'play', { value: play });

		expect(executeMediaCommand(command({ command: 'play' }), () => stage)).toBeTruthy();
		expect(play).toHaveBeenCalledOnce();
		document.body.innerHTML = '';
	});

	it('prefers the registered element over the DOM fallback', () => {
		document.body.innerHTML = '<div data-element-id="video1"><video id="domCopy"></video></div>';
		const domVideo = document.querySelector('video')!;
		const domPlay = vi.fn(() => Promise.resolve());
		Object.defineProperty(domVideo, 'play', { value: domPlay });
		const registered = createMockMedia();
		registerMediaElement('video1', asMediaElement(registered));

		expect(executeMediaCommand(command({ command: 'play' }))).toBeTruthy();
		expect(registered.play).toHaveBeenCalledOnce();
		expect(domPlay).not.toHaveBeenCalled();
		document.body.innerHTML = '';
	});

	it('togglePlay plays when paused and pauses when playing', () => {
		const paused = createMockMedia(true);
		registerMediaElement('video1', asMediaElement(paused));
		executeMediaCommand(command({ command: 'togglePlay' }));
		expect(paused.play).toHaveBeenCalledOnce();

		clearMediaElementRegistry();
		const playing = createMockMedia(false);
		registerMediaElement('video1', asMediaElement(playing));
		executeMediaCommand(command({ command: 'togglePlay' }));
		expect(playing.pause).toHaveBeenCalledOnce();
	});
});
