import { describe, expect, it } from 'vitest';

import { parseModel3DScene } from './model3d-scene-parser';

const authored = {
	'am3d:camera': {
		'am3d:pos': { '@_x': '0', '@_y': '1000000', '@_z': '66519324' },
		'am3d:up': { '@_dx': '0', '@_dy': '36000000', '@_dz': '0' },
		'am3d:lookAt': { '@_x': '0', '@_y': '0', '@_z': '0' },
		'am3d:perspective': { '@_fov': '2700000' },
	},
	'am3d:trans': {
		'am3d:meterPerModelUnit': { '@_n': '1', '@_d': '4' },
		'am3d:preTrans': { '@_dx': '10', '@_dy': '20', '@_dz': '30' },
		'am3d:scale': {
			'am3d:sx': { '@_n': '2', '@_d': '1' },
			'am3d:sy': { '@_n': '1', '@_d': '2' },
			'am3d:sz': { '@_n': '1', '@_d': '1' },
		},
		'am3d:rot': { '@_ax': '5400000', '@_ay': '0', '@_az': '60000' },
		'am3d:postTrans': { '@_dx': '1', '@_dy': '2', '@_dz': '3' },
	},
	'am3d:objViewport': { '@_viewportSz': '3888064' },
	'am3d:ambientLight': {
		'am3d:clr': { 'a:scrgbClr': { '@_r': '50000', '@_g': '50000', '@_b': '100000' } },
		'am3d:illuminance': { '@_n': '500000', '@_d': '1000000' },
	},
	'am3d:ptLight': [
		{
			'am3d:clr': { 'a:srgbClr': { '@_val': 'FFAA00' } },
			'am3d:pos': { '@_x': '5', '@_y': '6', '@_z': '7' },
		},
	],
	'am3d:dirLight': { 'am3d:dir': { '@_dx': '0', '@_dy': '-1', '@_dz': '0' } },
	'am3d:spotLight': {
		'am3d:pos': { '@_x': '1', '@_y': '1', '@_z': '1' },
		'@_spotAngle': '3000000',
	},
};

describe('parseModel3DScene', () => {
	it('returns undefined when nothing is authored', () => {
		expect(parseModel3DScene({})).toBeUndefined();
		expect(parseModel3DScene({ 'am3d:raster': {} })).toBeUndefined();
	});

	it('parses the perspective camera', () => {
		const cam = parseModel3DScene(authored)?.camera;
		expect(cam?.projection).toBe('perspective');
		expect(cam?.fovDeg).toBe(45);
		expect(cam?.position).toStrictEqual({ x: 0, y: 1000000, z: 66519324 });
		expect(cam?.up).toStrictEqual({ x: 0, y: 36000000, z: 0 });
		expect(cam?.lookAt).toStrictEqual({ x: 0, y: 0, z: 0 });
	});

	it('detects an orthographic camera', () => {
		const cam = parseModel3DScene({
			'am3d:camera': { 'am3d:orthographic': { '@_sx': '3' } },
		})?.camera;
		expect(cam?.projection).toBe('orthographic');
		expect(cam?.orthoScale).toBe(3);
		expect(cam?.fovDeg).toBeUndefined();
	});

	it('parses the model transform', () => {
		const t = parseModel3DScene(authored)?.transform;
		expect(t?.meterPerModelUnit).toBe(0.25);
		expect(t?.preTranslate).toStrictEqual({ x: 10, y: 20, z: 30 });
		expect(t?.scale).toStrictEqual({ x: 2, y: 0.5, z: 1 });
		expect(t?.rotationDeg).toStrictEqual({ x: 90, y: 0, z: 1 });
		expect(t?.postTranslate).toStrictEqual({ x: 1, y: 2, z: 3 });
	});

	it('parses every light kind, colours and viewport', () => {
		const scene = parseModel3DScene(authored);
		expect(scene?.viewportSizeEmu).toBe(3888064);
		const [amb, pt, spot, dir] = scene?.lights ?? [];
		expect(amb).toMatchObject({ kind: 'ambient', color: '#8080ff', illuminance: 0.5 });
		expect(pt).toMatchObject({ kind: 'point', color: '#ffaa00', position: { x: 5, y: 6, z: 7 } });
		expect(spot).toMatchObject({ kind: 'spot', spotAngleDeg: 50 });
		expect(dir).toMatchObject({ kind: 'directional', direction: { x: 0, y: -1, z: 0 } });
	});

	it('rejects zero denominators', () => {
		const t = parseModel3DScene({
			'am3d:trans': { 'am3d:meterPerModelUnit': { '@_n': '1', '@_d': '0' } },
		})?.transform;
		expect(t?.meterPerModelUnit).toBeUndefined();
	});
});
