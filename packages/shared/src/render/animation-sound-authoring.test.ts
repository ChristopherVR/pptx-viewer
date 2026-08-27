import type { PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getEffectSoundState, setEffectSound } from './animation-sound-authoring';

const BASE: PptxElementAnimation = {
	elementId: 'el-1',
	entrance: 'fadeIn',
	durationMs: 500,
	order: 0,
	trigger: 'onClick',
};

describe('getEffectSoundState', () => {
	it('reports no sound when the element has no animation entry', () => {
		expect(getEffectSoundState([], 'missing')).toStrictEqual({ hasSound: false });
	});

	it('reports no sound when the entry has neither soundData nor soundRId', () => {
		expect(getEffectSoundState([BASE], 'el-1')).toStrictEqual({ hasSound: false });
	});

	it('reports a pending sound staged via soundData, using soundFileName for display', () => {
		const anims = [
			{ ...BASE, soundData: 'data:audio/mpeg;base64,AA==', soundFileName: 'chime.mp3' },
		];
		expect(getEffectSoundState(anims, 'el-1')).toStrictEqual({
			hasSound: true,
			fileName: 'chime.mp3',
		});
	});

	it('reports an already-embedded sound, deriving the display name from soundPath', () => {
		const anims = [{ ...BASE, soundRId: 'rId3', soundPath: 'ppt/media/audio2.wav' }];
		expect(getEffectSoundState(anims, 'el-1')).toStrictEqual({
			hasSound: true,
			fileName: 'audio2.wav',
		});
	});

	it('prefers soundFileName over a derived soundPath name when both are present', () => {
		const anims = [
			{
				...BASE,
				soundRId: 'rId3',
				soundPath: 'ppt/media/audio2.wav',
				soundFileName: 'My Sound.wav',
			},
		];
		expect(getEffectSoundState(anims, 'el-1').fileName).toBe('My Sound.wav');
	});
});

describe('setEffectSound', () => {
	it('stages a picked file as a pending soundData, clearing any resolved reference', () => {
		const anims = [{ ...BASE, soundRId: 'rId1', soundPath: 'ppt/media/audio1.wav' }];
		const result = setEffectSound(anims, 'el-1', {
			dataUrl: 'data:audio/mpeg;base64,AA==',
			fileName: 'new.mp3',
		});
		expect(result[0]).toMatchObject({
			soundData: 'data:audio/mpeg;base64,AA==',
			soundFileName: 'new.mp3',
			soundRId: undefined,
			soundPath: undefined,
		});
	});

	it('clears the sound entirely when passed undefined ("No sound")', () => {
		const anims = [
			{
				...BASE,
				soundRId: 'rId1',
				soundPath: 'ppt/media/audio1.wav',
				soundData: 'data:audio/mpeg;base64,AA==',
				soundFileName: 'x.mp3',
			},
		];
		const result = setEffectSound(anims, 'el-1', undefined);
		expect(getEffectSoundState(result, 'el-1')).toStrictEqual({ hasSound: false });
	});

	it('creates a new animation entry when the element had none yet', () => {
		const result = setEffectSound([], 'el-9', { dataUrl: 'data:audio/mpeg;base64,AA==' });
		expect(result).toHaveLength(1);
		expect(result[0].elementId).toBe('el-9');
		expect(getEffectSoundState(result, 'el-9').hasSound).toBeTruthy();
	});

	it('does not mutate the input array', () => {
		const anims = [BASE];
		const result = setEffectSound(anims, 'el-1', { dataUrl: 'data:audio/mpeg;base64,AA==' });
		expect(anims[0].soundData).toBeUndefined();
		expect(result).not.toBe(anims);
	});
});
