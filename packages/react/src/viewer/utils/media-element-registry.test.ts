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
