import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	cropResetPatch,
	cropResetState,
	hasImageOverrides,
	imageResetPatch,
	imageResetState,
	mediaTrimResetPatch,
	mediaTrimResetState,
	seriesColorClearState,
	slideBackgroundClearPatch,
	slideBackgroundClearState,
} from './inspector-reset-actions';

const picture = (extra: object = {}): PptxElement =>
	({ id: 'p', type: 'image', x: 0, y: 0, width: 1, height: 1, ...extra }) as PptxElement;

describe('inspector reset actions', () => {
	it('detects image overrides but ignores neutral effects', () => {
		expect(hasImageOverrides(picture())).toBeFalsy();
		expect(
			hasImageOverrides(picture({ imageEffects: { brightness: 0, grayscale: false } })),
		).toBeFalsy();
		expect(hasImageOverrides(picture({ imageEffects: { brightness: 10 } }))).toBeTruthy();
		expect(hasImageOverrides(picture({ cropShape: 'ellipse' }))).toBeTruthy();
		expect(hasImageOverrides(picture({ cropShape: 'none' }))).toBeFalsy();
	});

	it('gates Reset Picture on picture, edit and overrides', () => {
		const dirty = picture({ imageEffects: { contrast: 5 } });
		expect(imageResetState(dirty, true, true)).toStrictEqual({ visible: true, enabled: true });
		expect(imageResetState(dirty, false, true)).toStrictEqual({ visible: true, enabled: false });
		expect(imageResetState(picture(), true, true)).toStrictEqual({ visible: true, enabled: false });
		expect(imageResetState(dirty, true, false).visible).toBeFalsy();
		expect(imageResetPatch()).toStrictEqual({ imageEffects: undefined, cropShape: 'none' });
	});

	it('gates Reset Crop on edit and the noCrop lock', () => {
		expect(cropResetState(picture(), true, true).enabled).toBeTruthy();
		expect(cropResetState(picture(), false, true).enabled).toBeFalsy();
		expect(cropResetPatch()).toStrictEqual({
			cropLeft: 0,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0,
		});
	});

	it('shows Reset trim only for editable trimmed media', () => {
		expect(mediaTrimResetState({ trimStartMs: 10 }, true).visible).toBeTruthy();
		expect(mediaTrimResetState({ trimEndMs: 10 }, true).visible).toBeTruthy();
		expect(mediaTrimResetState({}, true).visible).toBeFalsy();
		expect(mediaTrimResetState({ trimStartMs: 10 }, false).visible).toBeFalsy();
		expect(mediaTrimResetPatch()).toStrictEqual({ trimStartMs: 0, trimEndMs: 0 });
	});

	it('shows the series colour clear only for a coloured, editable series', () => {
		expect(seriesColorClearState({ color: '#fff' }, true).visible).toBeTruthy();
		expect(seriesColorClearState({}, true).visible).toBeFalsy();
		expect(seriesColorClearState({ color: '#fff' }, false).visible).toBeFalsy();
	});

	it('shows Clear Background when any facet is set and clears all of them', () => {
		expect(slideBackgroundClearState({}, true).visible).toBeFalsy();
		expect(slideBackgroundClearState({ backgroundColor: '#fff' }, true)).toStrictEqual({
			visible: true,
			enabled: true,
		});
		expect(slideBackgroundClearState({ backgroundImage: 'x' }, false).enabled).toBeFalsy();
		expect(Object.keys(slideBackgroundClearPatch()).sort()).toStrictEqual([
			'backgroundColor',
			'backgroundGradient',
			'backgroundImage',
			'backgroundPattern',
		]);
	});
});
