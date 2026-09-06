// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { EFFECT_SOUND_CATALOGUE } from './effect-sound-catalogue';
import {
	applyTransitionSoundFile,
	applyTransitionStockSound,
	clearTransitionSound,
	readSoundFileAsDataUrl,
	TRANSITION_SOUND_CURRENT_VALUE,
	TRANSITION_SOUND_NONE_VALUE,
	TRANSITION_SOUND_OTHER_VALUE,
	transitionSoundOptions,
	transitionSoundSelectedValue,
	transitionStockSoundId,
} from './slide-transition-sound';

describe('slide-transition-sound', () => {
	describe('transitionSoundOptions', () => {
		it('offers None, all 19 stock sounds, and Other Sound when no sound is set', () => {
			expect(transitionSoundOptions(undefined)).toStrictEqual([
				{ value: TRANSITION_SOUND_NONE_VALUE, i18nKey: 'pptx.ribbon.soundNone' },
				...EFFECT_SOUND_CATALOGUE.map((entry) => ({ value: entry.id, i18nKey: entry.i18nKey })),
				{ value: TRANSITION_SOUND_OTHER_VALUE, i18nKey: 'pptx.ribbon.soundOther' },
			]);
		});

		it('leads with the currently-picked custom file name when one is set', () => {
			expect(transitionSoundOptions({ type: 'fade', soundFileName: 'chime.wav' })).toStrictEqual([
				{ value: TRANSITION_SOUND_CURRENT_VALUE, label: 'chime.wav' },
				{ value: TRANSITION_SOUND_NONE_VALUE, i18nKey: 'pptx.ribbon.soundNone' },
				...EFFECT_SOUND_CATALOGUE.map((entry) => ({ value: entry.id, i18nKey: entry.i18nKey })),
				{ value: TRANSITION_SOUND_OTHER_VALUE, i18nKey: 'pptx.ribbon.soundOther' },
			]);
		});

		it('does not add a redundant "current" entry when the sound name matches a stock entry', () => {
			const options = transitionSoundOptions({ type: 'fade', soundName: 'CHIMES.WAV' });
			expect(options.filter((o) => o.value === TRANSITION_SOUND_CURRENT_VALUE)).toHaveLength(0);
			expect(options.some((o) => o.value === 'chime')).toBeTruthy();
		});
	});

	describe('transitionSoundSelectedValue', () => {
		it('is none for a transition with no sound', () => {
			expect(transitionSoundSelectedValue({ type: 'fade' })).toBe(TRANSITION_SOUND_NONE_VALUE);
			expect(transitionSoundSelectedValue(undefined)).toBe(TRANSITION_SOUND_NONE_VALUE);
		});

		it('is current for a transition that already carries a custom sound file name', () => {
			expect(transitionSoundSelectedValue({ type: 'fade', soundFileName: 'chime.wav' })).toBe(
				TRANSITION_SOUND_CURRENT_VALUE,
			);
		});

		it('is the catalogue id for a transition whose sound name matches a stock entry', () => {
			expect(
				transitionSoundSelectedValue({
					type: 'fade',
					soundFileName: 'CHIMES.WAV',
					soundName: 'CHIMES.WAV',
				}),
			).toBe('chime');
		});
	});

	describe('applyTransitionSoundFile', () => {
		it('stores the picked file as pending sound data and clears any embedded identity', () => {
			expect(
				applyTransitionSoundFile({ name: 'Applause.wav', dataUrl: 'data:audio/wav;base64,AA==' }),
			).toStrictEqual({
				soundData: 'data:audio/wav;base64,AA==',
				soundFileName: 'Applause.wav',
				soundName: 'Applause',
				soundRId: undefined,
				soundPath: undefined,
				stopSound: undefined,
			});
		});

		it('keeps the whole name when the file has no extension', () => {
			expect(
				applyTransitionSoundFile({ name: 'chime', dataUrl: 'data:audio/wav;base64,AA==' }),
			).toMatchObject({ soundName: 'chime', soundFileName: 'chime' });
		});
	});

	describe('applyTransitionStockSound', () => {
		it('stages a synthesised stock sound with its canonical name', () => {
			const patch = applyTransitionStockSound('applause');
			expect(patch).toBeDefined();
			expect(patch?.soundData?.startsWith('data:audio/wav;base64,')).toBeTruthy();
			expect(patch?.soundName).toBe('APPLAUSE.WAV');
			expect(patch?.soundFileName).toBe('APPLAUSE.WAV');
			expect(patch?.soundRId).toBeUndefined();
			expect(patch?.stopSound).toBeUndefined();
		});

		it('returns undefined for an id absent from the catalogue', () => {
			expect(applyTransitionStockSound('not-a-real-sound')).toBeUndefined();
		});
	});

	describe('transitionStockSoundId', () => {
		it('matches a stock sound name back to its catalogue id', () => {
			expect(transitionStockSoundId({ type: 'fade', soundName: 'CHIMES.WAV' })).toBe('chime');
		});

		it('is undefined for a custom sound name or no sound at all', () => {
			expect(transitionStockSoundId({ type: 'fade', soundName: 'my-sound.mp3' })).toBeUndefined();
			expect(transitionStockSoundId({ type: 'fade' })).toBeUndefined();
			expect(transitionStockSoundId(undefined)).toBeUndefined();
		});
	});

	describe('clearTransitionSound', () => {
		it('clears every sound-related field', () => {
			expect(clearTransitionSound()).toStrictEqual({
				soundData: undefined,
				soundRId: undefined,
				soundPath: undefined,
				soundFileName: undefined,
				soundName: undefined,
				soundLoop: undefined,
				stopSound: undefined,
				rawSoundAction: undefined,
			});
		});
	});

	describe('readSoundFileAsDataUrl', () => {
		it('resolves the picked file as a data: URL', async () => {
			const file = new File(['fake wav bytes'], 'chime.wav', { type: 'audio/wav' });
			const dataUrl = await readSoundFileAsDataUrl(file);
			expect(dataUrl).toMatch(/^data:audio\/wav;base64,/);
		});

		it('resolves null rather than rejecting on a read failure', async () => {
			const file = new File(['x'], 'chime.wav', { type: 'audio/wav' });
			const originalReadAsDataURL = FileReader.prototype.readAsDataURL;
			FileReader.prototype.readAsDataURL = function readAsDataURL(this: FileReader) {
				this.dispatchEvent(new Event('error'));
			};
			try {
				await expect(readSoundFileAsDataUrl(file)).resolves.toBeNull();
			} finally {
				FileReader.prototype.readAsDataURL = originalReadAsDataURL;
			}
		});
	});
});
