import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	imageAdjustmentsPatch,
	imageAdjustmentsStateOf,
	imageCropPatch,
	imageCropStateOf,
} from './image-adjustments';

function image(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'image',
		id: 'img1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		imagePath: 'ppt/media/image1.png',
		...overrides,
	} as PptxElement;
}

function shape(): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		shapeType: 'rect',
	} as PptxElement;
}

describe('image-adjustments state readers', () => {
	it('defaults brightness/contrast/saturation to 0 when unset', () => {
		expect(imageAdjustmentsStateOf(image())).toStrictEqual({
			brightness: 0,
			contrast: 0,
			saturation: 0,
		});
	});

	it('reads existing imageEffects values', () => {
		const el = image({
			imageEffects: { brightness: 20, contrast: -10, saturation: 5 },
		} as Partial<PptxElement>);
		expect(imageAdjustmentsStateOf(el)).toStrictEqual({
			brightness: 20,
			contrast: -10,
			saturation: 5,
		});
	});

	it('defaults to 0 for non-image elements', () => {
		expect(imageAdjustmentsStateOf(shape())).toStrictEqual({
			brightness: 0,
			contrast: 0,
			saturation: 0,
		});
	});

	it('defaults crop insets to 0 when unset', () => {
		expect(imageCropStateOf(image())).toStrictEqual({
			cropLeft: 0,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0,
		});
	});

	it('reads existing crop insets', () => {
		const el = image({
			cropLeft: 0.1,
			cropTop: 0.2,
			cropRight: 0.05,
			cropBottom: 0,
		} as Partial<PptxElement>);
		expect(imageCropStateOf(el)).toStrictEqual({
			cropLeft: 0.1,
			cropTop: 0.2,
			cropRight: 0.05,
			cropBottom: 0,
		});
	});
});

describe('imageAdjustmentsPatch', () => {
	it('merges a single field into imageEffects, preserving others', () => {
		const el = image({ imageEffects: { brightness: 10, grayscale: true } } as Partial<PptxElement>);
		const patch = imageAdjustmentsPatch(el, { contrast: 30 });
		expect(patch).toStrictEqual({
			imageEffects: { brightness: 10, grayscale: true, contrast: 30 },
		});
	});

	it('is a no-op for a non-image element', () => {
		expect(imageAdjustmentsPatch(shape(), { brightness: 10 })).toStrictEqual({});
	});
});

describe('imageCropPatch', () => {
	it('clamps crop values to the [0, 0.9] range', () => {
		const patch = imageCropPatch(image(), { cropLeft: 1.5, cropTop: -0.2 });
		expect(patch).toStrictEqual({ cropLeft: 0.9, cropTop: 0 });
	});

	it('treats non-finite input as 0', () => {
		const patch = imageCropPatch(image(), { cropRight: Number.NaN });
		expect(patch).toStrictEqual({ cropRight: 0 });
	});

	it('is a no-op for a non-image element', () => {
		expect(imageCropPatch(shape(), { cropLeft: 0.1 })).toStrictEqual({});
	});
});
