import { describe, expect, it } from 'vitest';

import { smartArt3DGradientColor } from './smartart-3d-drawing-solid';
import { resolveSmartArt3DLightModel, shadeSmartArt3DNormal } from './smartart-3d-lighting';
import {
	MEASURED_SQUARE_PX,
	resolveSmartArt3DCamera,
	smartArt3DCameraMatrix,
	smartArt3DEyeInDiagram,
} from './smartart-3d-scene-camera';
import { hexToRgb, shadeSmartArt3DVertices, srgbToLinear } from './smartart-3d-vertex-shading';

const FACE = { x: 0, y: 0, z: 1 };

describe('shadeSmartArt3DNormal', () => {
	const model = resolveSmartArt3DLightModel(
		{ rig: 'threePt', direction: 't', revDeg: 0 },
		'plastic',
	);

	it('leaves a face-on surface at its fill', () => {
		expect(shadeSmartArt3DNormal(FACE, model)).toStrictEqual({ mul: 1, add: 0 });
	});

	it('brightens a surface tilted toward the light and darkens one tilted away', () => {
		const up = shadeSmartArt3DNormal({ x: 0, y: Math.SQRT1_2, z: Math.SQRT1_2 }, model);
		const down = shadeSmartArt3DNormal({ x: 0, y: -Math.SQRT1_2, z: Math.SQRT1_2 }, model);
		expect(up.mul).toBeGreaterThan(1);
		expect(down.mul).toBeLessThan(1);
	});

	it('turns the key light with the rig revolution (counter-clockwise)', () => {
		const turned = resolveSmartArt3DLightModel(
			{ rig: 'threePt', direction: 't', revDeg: 90 },
			'matte',
		);
		expect(turned.light.x).toBeLessThan(-0.9);
	});
});

describe('light rig specular lights', () => {
	const rig = { rig: 'threePt', direction: 't', revDeg: 344 };

	it("keeps the default highlight for a parallel view (the bevel fit's light)", () => {
		const model = resolveSmartArt3DLightModel(rig, 'metal');
		expect(model.highlights).toHaveLength(1);
		expect(model.highlights[0].direction.z).toBeCloseTo(Math.sin(Math.PI / 3), 6);
	});

	it("switches to the rig's own lights under a perspective scene camera", () => {
		const model = resolveSmartArt3DLightModel(rig, 'metal', true);
		// threePt's highlight light sits up and to the left of the key light.
		expect(model.highlights).toHaveLength(1);
		expect(model.highlights[0].direction.x).toBeLessThan(0);
		expect(model.highlights[0].direction.y).toBeGreaterThan(0);
		expect(
			resolveSmartArt3DLightModel({ ...rig, rig: 'flat' }, 'metal', true).highlights[0],
		).toStrictEqual(resolveSmartArt3DLightModel({ ...rig, rig: 'flat' }, 'metal').highlights[0]);
	});

	it("sweeps Metallic Scene's metal highlight from the top-left to the bottom-right", () => {
		// perspectiveLeft: the eye sits in front of the diagram, to its right.
		const model = resolveSmartArt3DLightModel(rig, 'metal', true);
		const eye = { x: 560, y: 0, z: 1490 };
		const at = (x: number, y: number) =>
			shadeSmartArt3DNormal(FACE, model, {
				x: (eye.x - x) / Math.hypot(eye.x - x, eye.y - y, eye.z),
				y: (eye.y - y) / Math.hypot(eye.x - x, eye.y - y, eye.z),
				z: eye.z / Math.hypot(eye.x - x, eye.y - y, eye.z),
			});
		const topLeft = at(-450, 250);
		const bottomRight = at(450, -250);
		expect(topLeft.mul).toBe(1);
		expect(topLeft.add).toBeGreaterThan(0.3);
		expect(bottomRight.add).toBeLessThan(0.05);
	});
});

describe('shadeSmartArt3DVertices', () => {
	it('gives a face-on vertex a unit factor under a neutral rig', () => {
		const model = resolveSmartArt3DLightModel({ rig: 'flat', direction: 't', revDeg: 0 }, 'matte');
		const out = shadeSmartArt3DVertices([0, 0, 0], [0, 0, 1], () => hexToRgb('#156082'), model);
		expect([...out].map((v) => Number(v.toFixed(6)))).toStrictEqual([1, 1, 1]);
	});

	it('applies the measured morning rig tint in linear light', () => {
		const model = resolveSmartArt3DLightModel(
			{ rig: 'morning', direction: 't', revDeg: 0 },
			'matte',
		);
		const out = shadeSmartArt3DVertices([0, 0, 0], [0, 0, 1], () => [0.5, 0.5, 0.5], model);
		const reference = srgbToLinear(127 / 255);
		expect(out[0]).toBeCloseTo(srgbToLinear(112 / 255) / reference, 6);
		expect(out[2]).toBeCloseTo(srgbToLinear(98 / 255) / reference, 6);
	});
});

describe('resolveSmartArt3DCamera', () => {
	it('is undefined for no scene or a plain orthographicFront', () => {
		expect(resolveSmartArt3DCamera(undefined)).toBeUndefined();
		expect(resolveSmartArt3DCamera({ cameraPreset: 'orthographicFront' })).toBeUndefined();
	});

	it('resolves a fitted perspective preset with an absolute distance and raw zoom', () => {
		const camera = resolveSmartArt3DCamera({ cameraPreset: 'perspectiveLeft', cameraZoom: 91000 })!;
		expect(camera.projection).toBe('perspective');
		expect(camera.lonDeg).toBeCloseTo(20.4, 6);
		expect(camera.distance).toBeCloseTo(8.3 * MEASURED_SQUARE_PX, 6);
		expect(camera.zoom).toBeCloseTo(0.91, 6);
	});

	it('uses an explicit a:rot as authored', () => {
		const camera = resolveSmartArt3DCamera({
			cameraPreset: 'perspectiveRelaxed',
			cameraRotX: 19149996,
			cameraRotY: 20104178,
			cameraRotZ: 1577324,
		})!;
		expect(camera.latDeg).toBeCloseTo(319.17, 2);
		expect(camera.lonDeg).toBeCloseTo(335.07, 2);
		expect(camera.revDeg).toBeCloseTo(26.29, 2);
	});

	it('projects the front plane like the COM-validated a:rot model', () => {
		const camera = {
			projection: 'orthographic' as const,
			latDeg: 25,
			lonDeg: 45,
			revDeg: 0,
			distance: 0,
			zoom: 1,
		};
		const m = smartArt3DCameraMatrix(camera);
		const lat = (25 * Math.PI) / 180;
		const lon = (45 * Math.PI) / 180;
		// Point (X, Y) = (1, 0.5): x = X cos lon, y = Y cos lat - X sin lat sin lon.
		expect(Number(m[0]) + m[1] * 0.5).toBeCloseTo(Math.cos(lon), 6);
		expect(Number(m[3]) + m[4] * 0.5).toBeCloseTo(
			0.5 * Math.cos(lat) - Math.sin(lat) * Math.sin(lon),
			6,
		);
		expect(smartArt3DEyeInDiagram(camera)).toBeUndefined();
	});

	it('places a perspective eye on +z of the diagram when face-on', () => {
		const eye = smartArt3DEyeInDiagram({
			projection: 'perspective',
			latDeg: 0,
			lonDeg: 0,
			revDeg: 0,
			distance: 500,
			zoom: 1,
		})!;
		expect(eye.z).toBeCloseTo(500, 6);
	});
});

describe('smartArt3DGradientColor', () => {
	it('interpolates stops along a linear gradient', () => {
		const gradient = {
			kind: 'linear' as const,
			from: { x: 0, y: 0 },
			to: { x: 10, y: 0 },
			stops: [
				{ offset: 0, color: '#000000' },
				{ offset: 1, color: '#ffffff' },
			],
		};
		expect(smartArt3DGradientColor(gradient, { x: 5, y: 3 })[0]).toBeCloseTo(0.5, 6);
		expect(smartArt3DGradientColor(gradient, { x: -5, y: 0 })).toStrictEqual([0, 0, 0]);
	});
});
