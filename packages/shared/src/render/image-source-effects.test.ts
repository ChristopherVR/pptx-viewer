import { describe, expect, it } from 'vitest';

import {
	buildCacheKey,
	DEFAULT_COLOR_CHANGE_TOLERANCE,
	setCachedResult,
} from './image-color-change';
import { getImageColorWashStyle, resolveColorChangedImageSource } from './image-source-effects';

describe('image source effects', () => {
	it('clamps color wash opacity into a render-ready fraction', () => {
		expect(getImageColorWashStyle({ color: '#123456', opacity: 40 })).toStrictEqual({
			backgroundColor: '#123456',
			opacity: 0.4,
		});
		expect(getImageColorWashStyle({ color: '#123456', opacity: 140 })?.opacity).toBe(1);
	});

	it('resolves clrChange from the shared cache', async () => {
		const effect = { clrFrom: '#00FF00', clrTo: '#FF0000', clrToTransparent: false };
		const key = buildCacheKey(
			'data:image/png;base64,source',
			effect.clrFrom,
			effect.clrTo,
			DEFAULT_COLOR_CHANGE_TOLERANCE,
			false,
		);
		setCachedResult(key, 'data:image/png;base64,processed');
		await expect(
			resolveColorChangedImageSource('data:image/png;base64,source', effect),
		).resolves.toBe('data:image/png;base64,processed');
	});
});
