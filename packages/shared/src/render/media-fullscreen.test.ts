import { describe, expect, it } from 'vitest';

import {
	MEDIA_FULLSCREEN_OVERLAY_STYLE,
	isMediaFullscreenActive,
	shouldShowMediaFullscreenStopButton,
} from './media-fullscreen';

describe('isMediaFullscreenActive', () => {
	it('is active only when authored fullScrn, presenting, and playing all hold', () => {
		expect(
			isMediaFullscreenActive({ fullScreen: true, presenting: true, playing: true }),
		).toBeTruthy();
	});

	it('is inactive when the element was not authored fullScrn', () => {
		expect(
			isMediaFullscreenActive({ fullScreen: false, presenting: true, playing: true }),
		).toBeFalsy();
		expect(isMediaFullscreenActive({ presenting: true, playing: true })).toBeFalsy();
	});

	it('is inactive off the live show stage (a still, preview, or the authoring canvas)', () => {
		expect(
			isMediaFullscreenActive({ fullScreen: true, presenting: false, playing: true }),
		).toBeFalsy();
	});

	it('is inactive before playback actually starts', () => {
		expect(
			isMediaFullscreenActive({ fullScreen: true, presenting: true, playing: false }),
		).toBeFalsy();
	});
});

describe('shouldShowMediaFullscreenStopButton', () => {
	it('mirrors isMediaFullscreenActive exactly', () => {
		const cases = [
			{ fullScreen: true, presenting: true, playing: true },
			{ fullScreen: true, presenting: true, playing: false },
			{ fullScreen: true, presenting: false, playing: true },
			{ fullScreen: false, presenting: true, playing: true },
		];
		for (const input of cases) {
			expect(shouldShowMediaFullscreenStopButton(input)).toBe(isMediaFullscreenActive(input));
		}
	});
});

describe('mediaFullscreenOverlayStyle', () => {
	it('pins the element to the full slide, above scenery, on a black backdrop', () => {
		expect(MEDIA_FULLSCREEN_OVERLAY_STYLE).toMatchObject({
			left: 0,
			top: 0,
			width: '100%',
			height: '100%',
			transform: 'none',
			zIndex: 20,
			background: '#000',
		});
	});
});
