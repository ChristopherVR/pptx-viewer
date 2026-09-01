import { describe, expect, it } from 'vitest';

import type { PicturePptxElement } from '../types';
import {
	cropShapeForPresetGeometry,
	pictureRetainedPresetGeometry,
	presetGeometryForCropShape,
	syncPictureShapeTypeWithCropShape,
} from './crop-shape-geometry';

function picture(overrides: Partial<PicturePptxElement>): PicturePptxElement {
	return {
		id: 'pic-1',
		type: 'picture',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeType: 'rect',
		...overrides,
	};
}

describe('cropShapeForPresetGeometry', () => {
	it('derives the crop shape from the presets the gallery offers', () => {
		expect(cropShapeForPresetGeometry('ellipse')).toBe('ellipse');
		expect(cropShapeForPresetGeometry('roundRect')).toBe('roundedRect');
		expect(cropShapeForPresetGeometry('triangle')).toBe('triangle');
		expect(cropShapeForPresetGeometry('diamond')).toBe('diamond');
		expect(cropShapeForPresetGeometry('pentagon')).toBe('pentagon');
		expect(cropShapeForPresetGeometry('hexagon')).toBe('hexagon');
		expect(cropShapeForPresetGeometry('star5')).toBe('star');
	});

	it('normalises aliases and casing through getShapeType', () => {
		expect(cropShapeForPresetGeometry('oval')).toBe('ellipse');
		expect(cropShapeForPresetGeometry('Ellipse')).toBe('ellipse');
		expect(cropShapeForPresetGeometry('RoundRect')).toBe('roundedRect');
		expect(cropShapeForPresetGeometry('Star6')).toBe('star');
	});

	it('is undefined for rect, absent, and presets outside the gallery', () => {
		expect(cropShapeForPresetGeometry('rect')).toBeUndefined();
		expect(cropShapeForPresetGeometry(undefined)).toBeUndefined();
		expect(cropShapeForPresetGeometry('')).toBeUndefined();
		expect(cropShapeForPresetGeometry('cylinder')).toBeUndefined();
		expect(cropShapeForPresetGeometry('rtArrow')).toBeUndefined();
		expect(cropShapeForPresetGeometry('custom')).toBeUndefined();
	});
});

describe('presetGeometryForCropShape', () => {
	it('is the inverse of cropShapeForPresetGeometry for every gallery shape', () => {
		for (const shape of [
			'ellipse',
			'roundedRect',
			'triangle',
			'diamond',
			'pentagon',
			'hexagon',
			'star',
		] as const) {
			expect(cropShapeForPresetGeometry(presetGeometryForCropShape(shape))).toBe(shape);
		}
	});

	it('writes nothing for none or absent', () => {
		expect(presetGeometryForCropShape('none')).toBeUndefined();
		expect(presetGeometryForCropShape(undefined)).toBeUndefined();
	});
});

describe('syncPictureShapeTypeWithCropShape', () => {
	it('rewrites shapeType when the crop shape changed', () => {
		const el = picture({ cropShape: 'ellipse', shapeAdjustments: { adj: 0.2 } });
		expect(syncPictureShapeTypeWithCropShape(el, 'rect')).toBeTruthy();
		expect(el.shapeType).toBe('ellipse');
		expect(el.shapeAdjustments).toBeUndefined();
	});

	it('leaves the geometry alone for none or an unset crop shape', () => {
		const none = picture({ cropShape: 'none', shapeType: 'roundRect' });
		expect(syncPictureShapeTypeWithCropShape(none, 'roundRect')).toBeFalsy();
		expect(none.shapeType).toBe('roundRect');

		const unset = picture({ shapeType: 'diamond' });
		expect(syncPictureShapeTypeWithCropShape(unset, 'diamond')).toBeFalsy();
		expect(unset.shapeType).toBe('diamond');
	});

	it('does nothing when shapeType already expresses the crop', () => {
		const el = picture({
			cropShape: 'roundedRect',
			shapeType: 'roundRect',
			shapeAdjustments: { adj: 0.1 },
		});
		expect(syncPictureShapeTypeWithCropShape(el, 'roundRect')).toBeFalsy();
		expect(el.shapeAdjustments).toStrictEqual({ adj: 0.1 });
	});

	it('does not drag a directly changed shapeType back to a crop parsed on load', () => {
		// Loaded as an ellipse (cropShape derived), then the user set shapeType.
		const el = picture({ cropShape: 'ellipse', shapeType: 'rect' });
		expect(syncPictureShapeTypeWithCropShape(el, 'ellipse')).toBeFalsy();
		expect(el.shapeType).toBe('rect');
	});

	it('reads the baseline preset from the retained p:spPr by default', () => {
		const rawXml = { 'p:spPr': { 'a:prstGeom': { '@_prst': 'ellipse' } } };
		expect(pictureRetainedPresetGeometry(picture({ rawXml }))).toBe('ellipse');

		const el = picture({ cropShape: 'ellipse', shapeType: 'rect', rawXml });
		expect(syncPictureShapeTypeWithCropShape(el)).toBeFalsy();

		const fresh = picture({ cropShape: 'ellipse', shapeType: 'rect' });
		expect(syncPictureShapeTypeWithCropShape(fresh)).toBeTruthy();
		expect(fresh.shapeType).toBe('ellipse');
	});

	it('never touches custom geometry', () => {
		const el = picture({
			cropShape: 'hexagon',
			shapeType: 'custom',
			customGeometryPaths: [{ width: 100, height: 100, segments: [] }],
		});
		expect(syncPictureShapeTypeWithCropShape(el, undefined)).toBeFalsy();
		expect(el.shapeType).toBe('custom');
	});
});
