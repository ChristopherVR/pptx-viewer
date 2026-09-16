import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	getFrameInverseTransform,
	getImageFillCounterTransform,
} from './image-fill-counter-transform';

function pictureEl(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'picture',
		id: 'p1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as PptxElement;
}

describe('getFrameInverseTransform', () => {
	it('returns undefined when there is nothing to counteract', () => {
		expect(getFrameInverseTransform({})).toBeUndefined();
	});

	it('is self-inverse for a pure vertical flip', () => {
		expect(getFrameInverseTransform({ flipVertical: true })).toBe('scaleY(-1)');
	});

	it('is self-inverse for a pure horizontal flip', () => {
		expect(getFrameInverseTransform({ flipHorizontal: true })).toBe('scaleX(-1)');
	});

	it('negates a pure rotation', () => {
		expect(getFrameInverseTransform({ rotation: 45 })).toBe('rotate(-45deg)');
	});

	it('orders scaleY, scaleX, then negated rotation for a combined flip+rotate', () => {
		expect(
			getFrameInverseTransform({ rotation: 90, flipHorizontal: true, flipVertical: true }),
		).toBe('scaleY(-1) scaleX(-1) rotate(-90deg)');
	});
});

describe('getImageFillCounterTransform', () => {
	it('returns undefined for an element with no shape properties', () => {
		expect(
			getImageFillCounterTransform({ type: 'zoom' } as unknown as PptxElement),
		).toBeUndefined();
	});

	it('returns undefined when fillImageRotWithShape is unset (default true)', () => {
		const el = pictureEl({ flipVertical: true, shapeStyle: { fillMode: 'image' } });
		expect(getImageFillCounterTransform(el)).toBeUndefined();
	});

	it('returns undefined when fillImageRotWithShape is explicitly true', () => {
		const el = pictureEl({
			flipVertical: true,
			shapeStyle: { fillMode: 'image', fillImageRotWithShape: true },
		});
		expect(getImageFillCounterTransform(el)).toBeUndefined();
	});

	it('returns the inverse flip transform when fillImageRotWithShape is false (the reported bug)', () => {
		const el = pictureEl({
			flipVertical: true,
			shapeStyle: { fillMode: 'image', fillImageRotWithShape: false },
		});
		expect(getImageFillCounterTransform(el)).toBe('scaleY(-1)');
	});

	it('returns undefined when rotWithShape is false but there is no flip/rotation to counteract', () => {
		const el = pictureEl({ shapeStyle: { fillMode: 'image', fillImageRotWithShape: false } });
		expect(getImageFillCounterTransform(el)).toBeUndefined();
	});

	it('returns undefined when a competing crop transform is already active', () => {
		const el = pictureEl({
			flipVertical: true,
			shapeStyle: { fillMode: 'image', fillImageRotWithShape: false },
		});
		expect(getImageFillCounterTransform(el, true)).toBeUndefined();
	});

	it('counteracts rotation too', () => {
		const el = pictureEl({
			rotation: 30,
			shapeStyle: { fillMode: 'image', fillImageRotWithShape: false },
		});
		expect(getImageFillCounterTransform(el)).toBe('rotate(-30deg)');
	});
});
