import type { PptxSlideTransition } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import {
	applySlideTransitionSound,
	resolveTransitionSoundAction,
} from './slide-transition-sound-playback';

describe('resolveTransitionSoundAction', () => {
	it('returns none for an undefined transition', () => {
		expect(resolveTransitionSoundAction(undefined)).toStrictEqual({ kind: 'none' });
	});

	it('plays p:stSnd with loop=false by default', () => {
		const transition = { type: 'fade', soundPath: 'ppt/media/media3.wav' } as PptxSlideTransition;
		expect(resolveTransitionSoundAction(transition)).toStrictEqual({
			kind: 'play',
			soundPath: 'ppt/media/media3.wav',
			loop: false,
		});
	});

	it('honors @loop ("Loop Until Next Sound")', () => {
		const transition = {
			type: 'fade',
			soundPath: 'ppt/media/media3.wav',
			soundLoop: true,
		} as PptxSlideTransition;
		expect(resolveTransitionSoundAction(transition)).toStrictEqual({
			kind: 'play',
			soundPath: 'ppt/media/media3.wav',
			loop: true,
		});
	});

	it('stops the current sound for p:endSndAc (stopSound)', () => {
		const transition = { type: 'fade', stopSound: true } as PptxSlideTransition;
		expect(resolveTransitionSoundAction(transition)).toStrictEqual({ kind: 'stop' });
	});

	it('prefers play over stop when a transition somehow authors both', () => {
		const transition = {
			type: 'fade',
			soundPath: 'ppt/media/media3.wav',
			stopSound: true,
		} as PptxSlideTransition;
		expect(resolveTransitionSoundAction(transition).kind).toBe('play');
	});

	it('returns none for a transition with neither a sound nor a stop flag', () => {
		expect(resolveTransitionSoundAction({ type: 'fade' } as PptxSlideTransition)).toStrictEqual({
			kind: 'none',
		});
	});
});

describe('applySlideTransitionSound', () => {
	it('resolves a synchronous URL (a pre-populated mediaDataUrls map) and plays it', () => {
		const transition = { type: 'fade', soundPath: 'a.wav', soundLoop: true } as PptxSlideTransition;
		const map = new Map([['a.wav', 'blob:xyz']]);
		const play = vi.fn();
		const stop = vi.fn();
		applySlideTransitionSound(transition, (p) => map.get(p), { play, stop });
		expect(play).toHaveBeenCalledWith('blob:xyz', true);
		expect(stop).not.toHaveBeenCalled();
	});

	it('does not play when the sync resolver finds no URL', () => {
		const transition = { type: 'fade', soundPath: 'missing.wav' } as PptxSlideTransition;
		const play = vi.fn();
		const stop = vi.fn();
		applySlideTransitionSound(transition, () => undefined, { play, stop });
		expect(play).not.toHaveBeenCalled();
		expect(stop).not.toHaveBeenCalled();
	});

	it('awaits an async resolver before playing', async () => {
		const transition = { type: 'fade', soundPath: 'a.wav' } as PptxSlideTransition;
		const play = vi.fn();
		const stop = vi.fn();
		applySlideTransitionSound(transition, async () => 'blob:async', { play, stop });
		expect(play).not.toHaveBeenCalled();
		await Promise.resolve();
		await Promise.resolve();
		expect(play).toHaveBeenCalledWith('blob:async', false);
	});

	it('calls stop() for p:endSndAc without touching the resolver', () => {
		const transition = { type: 'fade', stopSound: true } as PptxSlideTransition;
		const resolveUrl = vi.fn();
		const play = vi.fn();
		const stop = vi.fn();
		applySlideTransitionSound(transition, resolveUrl, { play, stop });
		expect(stop).toHaveBeenCalledOnce();
		expect(resolveUrl).not.toHaveBeenCalled();
		expect(play).not.toHaveBeenCalled();
	});

	it('does nothing for a transition with no sound action', () => {
		const play = vi.fn();
		const stop = vi.fn();
		applySlideTransitionSound({ type: 'fade' } as PptxSlideTransition, vi.fn(), { play, stop });
		expect(play).not.toHaveBeenCalled();
		expect(stop).not.toHaveBeenCalled();
	});
});
