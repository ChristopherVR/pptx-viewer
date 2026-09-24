import type { PptxSmartArtData, PptxSmartArtDrawingShape } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildSmartArt3DDrawingModel } from './smartart-3d-drawing-model';
import { hasSmartArtShape3D, resolveSmartArt3DStylePath } from './smartart-3d-style-path';

const BEVEL_SHAPE3D = { presetMaterial: 'plastic', bevelTopWidth: 120900, bevelTopHeight: 88900 };

function shape(overrides: Partial<PptxSmartArtDrawingShape> = {}): PptxSmartArtDrawingShape {
	return {
		id: 's1',
		shapeType: 'rect',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		fillColor: '#156082',
		...overrides,
	};
}

describe('hasSmartArtShape3D', () => {
	it('is false for a missing or empty sp3d', () => {
		expect(hasSmartArtShape3D(undefined)).toBeFalsy();
		expect(hasSmartArtShape3D({})).toBeFalsy();
		expect(hasSmartArtShape3D({ presetMaterial: 'matte' })).toBeFalsy();
	});

	it('is true for a bevel, an extrusion or a contour', () => {
		expect(hasSmartArtShape3D({ bevelTopType: 'circle' })).toBeTruthy();
		expect(hasSmartArtShape3D({ extrusionHeight: 381000 })).toBeTruthy();
		expect(hasSmartArtShape3D({ contourWidth: 38100 })).toBeTruthy();
	});
});

describe('resolveSmartArt3DStylePath', () => {
	it('picks bevel when any shape carries its own scene3d', () => {
		expect(
			resolveSmartArt3DStylePath([
				{ scene3d: { cameraPreset: 'orthographicFront' }, shape3d: BEVEL_SHAPE3D },
			]),
		).toBe('bevel');
	});

	it('picks scene when shapes carry only sp3d', () => {
		expect(resolveSmartArt3DStylePath([{ shape3d: { extrusionHeight: 381000 } }])).toBe('scene');
	});

	it('stays flat with no 3D at all, or an sp3d that changes nothing', () => {
		expect(resolveSmartArt3DStylePath([{}])).toBe('flat');
		expect(resolveSmartArt3DStylePath([{ shape3d: { presetMaterial: 'matte' } }])).toBe('flat');
		expect(resolveSmartArt3DStylePath([])).toBe('flat');
	});
});

describe('buildSmartArt3DDrawingModel style paths', () => {
	const data = (shapes: PptxSmartArtDrawingShape[], extra: Partial<PptxSmartArtData> = {}) =>
		({ nodes: [], style: 'flat', drawingShapes: shapes, ...extra }) as PptxSmartArtData;

	it('keeps flat styles flat: no solid, no camera, no lighting', () => {
		const model = buildSmartArt3DDrawingModel(data([shape()]))!;
		expect(model.styleCategory).toBe('flat');
		expect(model.meshes[0].solid).toBeUndefined();
		expect(model.meshes[0].flat).toBeTruthy();
		expect(model.camera).toBeUndefined();
		expect(model.lighting).toBeUndefined();
	});

	it('gives a bevel style a lit solid in px and the shape rig, but no camera', () => {
		const model = buildSmartArt3DDrawingModel(
			data([
				shape({
					scene3d: {
						cameraPreset: 'orthographicFront',
						lightRigType: 'flat',
						lightRigDirection: 't',
					},
					shape3d: BEVEL_SHAPE3D,
				}),
			]),
		)!;
		expect(model.styleCategory).toBe('bevel');
		const solid = model.meshes[0].solid!;
		expect(solid.bevelTop?.width).toBeCloseTo(120900 / 9525, 6);
		expect(solid.bevelTop?.height).toBeCloseTo(88900 / 9525, 6);
		expect(solid.bevelTop?.profile).toBe('circle');
		expect(solid.material).toBe('plastic');
		expect(model.meshes[0].flat).toBeFalsy();
		expect(model.lighting).toStrictEqual({ rig: 'flat', direction: 't', revDeg: 0 });
		expect(model.camera).toBeUndefined();
	});

	it('gives a scene style the quick-style camera and rig', () => {
		const model = buildSmartArt3DDrawingModel(
			data([shape({ shape3d: { extrusionHeight: 381000, presetMaterial: 'matte' } })], {
				quickStyle: {
					scene3d: {
						cameraPreset: 'isometricOffAxis2Left',
						cameraZoom: 95000,
						lightRigType: 'flat',
						lightRigDirection: 't',
					},
				},
			}),
		)!;
		expect(model.styleCategory).toBe('scene');
		expect(model.meshes[0].solid?.extrusion).toBeCloseTo(40, 6);
		expect(model.camera?.projection).toBe('orthographic');
		expect(model.camera?.zoom).toBeCloseTo(0.95, 6);
		expect(model.lighting?.rig).toBe('flat');
	});

	it('maps a gradient fill into mesh-local space for the lit path', () => {
		const model = buildSmartArt3DDrawingModel(
			data([
				shape({
					scene3d: { cameraPreset: 'orthographicFront' },
					shape3d: BEVEL_SHAPE3D,
					fillGradientStops: [
						{ color: '#ffffff', position: 0 },
						{ color: '#000000', position: 100 },
					],
					fillGradientAngle: 90,
				}),
			]),
		)!;
		const gradient = model.meshes[0].gradient!;
		expect(gradient.kind).toBe('linear');
		// 90deg runs top -> bottom: y-up mesh space goes from +h/2 to -h/2.
		expect(gradient.from.y).toBeCloseTo(100, 6);
		expect(gradient.to.y).toBeCloseTo(-100, 6);
	});
});
