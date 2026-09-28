import type { Model3DSceneData } from 'pptx-viewer-core';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { buildModel3DRig, computeMetresToSceneScale } from './model3d-scene-apply';
import {
	DEFAULT_MODEL3D_CAMERA,
	DEFAULT_MODEL3D_LIGHTS,
	resolveModel3DSceneDescriptor,
} from './model3d-scene-descriptor';

const EMU = 914400;

const fixture: Model3DSceneData = {
	camera: {
		position: { x: 0, y: EMU, z: 4 * EMU },
		up: { x: 0, y: 36000000, z: 0 },
		lookAt: { x: 0, y: 0, z: 0 },
		projection: 'perspective',
		fovDeg: 45,
	},
	transform: {
		meterPerModelUnit: 0.5,
		scale: { x: 2, y: 2, z: 2 },
		rotationDeg: { x: 0, y: 90, z: 0 },
		postTranslate: { x: EMU, y: 0, z: 0 },
	},
	lights: [
		{ kind: 'ambient', color: '#8080ff', illuminance: 0.25 },
		{ kind: 'point', position: { x: 0, y: 2 * EMU, z: 0 } },
		{ kind: 'spot', position: { x: EMU, y: EMU, z: EMU }, spotAngleDeg: 30 },
		{ kind: 'directional', direction: { x: 0, y: -3, z: 0 } },
	],
};

describe('resolveModel3DSceneDescriptor', () => {
	it('reproduces the default rig when nothing is authored', () => {
		for (const input of [undefined, { lights: [] } satisfies Model3DSceneData]) {
			const d = resolveModel3DSceneDescriptor(input);
			expect(d.authored).toBeFalsy();
			expect(d.lightsAuthored).toBeFalsy();
			expect(d.camera).toBe(DEFAULT_MODEL3D_CAMERA);
			expect(d.lights).toStrictEqual([...DEFAULT_MODEL3D_LIGHTS]);
			expect(d.transform).toBeUndefined();
		}
	});

	it('converts an authored perspective camera to metres', () => {
		const { camera, authored } = resolveModel3DSceneDescriptor(fixture);
		expect(authored).toBeTruthy();
		expect(camera).toStrictEqual({
			framing: 'authored',
			kind: 'perspective',
			fovDeg: 45,
			position: [0, 1, 4],
			up: [0, 1, 0],
			target: [0, 0, 0],
		});
	});

	it('keeps the default camera when only lights are authored', () => {
		const d = resolveModel3DSceneDescriptor({ lights: [{ kind: 'ambient' }] });
		expect(d.camera.framing).toBe('default');
		expect(d.authored).toBeTruthy();
		expect(d.lights).toStrictEqual([{ kind: 'ambient', color: '#ffffff', intensity: 0.5 }]);
	});

	it('falls back on invalid fov and zero up vector', () => {
		const d = resolveModel3DSceneDescriptor({
			camera: {
				position: { x: 0, y: 0, z: EMU },
				up: { x: 0, y: 0, z: 0 },
				projection: 'perspective',
				fovDeg: 400,
			},
			lights: [],
		});
		expect(d.camera.fovDeg).toBe(50);
		expect(d.camera.up).toStrictEqual([0, 1, 0]);
	});

	it('carries orthographic projection', () => {
		const d = resolveModel3DSceneDescriptor({
			camera: { position: { x: 0, y: 0, z: EMU }, projection: 'orthographic' },
			lights: [],
		});
		expect(d.camera.kind).toBe('orthographic');
	});

	it('ignores a camera with no position', () => {
		const d = resolveModel3DSceneDescriptor({ camera: { projection: 'perspective' }, lights: [] });
		expect(d.camera).toBe(DEFAULT_MODEL3D_CAMERA);
	});

	it('maps the model transform', () => {
		expect(resolveModel3DSceneDescriptor(fixture).transform).toStrictEqual({
			meterPerModelUnit: 0.5,
			scale: [2, 2, 2],
			rotationDeg: [0, 90, 0],
			postTranslate: [1, 0, 0],
		});
	});

	it('maps every light kind', () => {
		const { lights, lightsAuthored } = resolveModel3DSceneDescriptor(fixture);
		expect(lightsAuthored).toBeTruthy();
		expect(lights).toStrictEqual([
			{ kind: 'ambient', color: '#8080ff', intensity: 0.25 },
			{ kind: 'point', color: '#ffffff', intensity: 1, position: [0, 2, 0] },
			{ kind: 'spot', color: '#ffffff', intensity: 1, position: [1, 1, 1], spotAngleDeg: 30 },
			{ kind: 'directional', color: '#ffffff', intensity: 1, direction: [0, -1, 0] },
		]);
	});
});

describe('buildModel3DRig (real three)', () => {
	it('builds the default framing unchanged', () => {
		const rig = buildModel3DRig(THREE, resolveModel3DSceneDescriptor(undefined), 2, 4);
		expect(rig.camera).toBeInstanceOf(THREE.PerspectiveCamera);
		expect((rig.camera as THREE.PerspectiveCamera).fov).toBe(50);
		expect(rig.camera.position.toArray()).toStrictEqual([0, 0, 5]);
		expect(rig.distance).toBe(5);
		expect(rig.lights).toHaveLength(3);
		const model = new THREE.Object3D();
		expect(rig.placeModel(model)).toBe(model);
	});

	it('scales metres into fitted scene units via meterPerModelUnit', () => {
		const desc = resolveModel3DSceneDescriptor(fixture);
		// model max dim 4 units * 0.5 m/unit = 2 m -> 2 scene units => 1 unit per metre
		expect(computeMetresToSceneScale(desc, 4)).toBe(1);
		const rig = buildModel3DRig(THREE, desc, 1, 4);
		expect(rig.camera.position.toArray()).toStrictEqual([0, 1, 4]);
		expect(rig.camera.up.toArray()).toStrictEqual([0, 1, 0]);
		expect((rig.camera as THREE.PerspectiveCamera).fov).toBe(45);
	});

	it('normalises camera distance when meterPerModelUnit is unknown', () => {
		const desc = resolveModel3DSceneDescriptor({
			camera: { position: { x: 0, y: 0, z: 10 * EMU }, projection: 'perspective' },
			lights: [],
		});
		expect(computeMetresToSceneScale(desc, 3)).toBeCloseTo(0.5);
		expect(buildModel3DRig(THREE, desc, 1, 3).distance).toBeCloseTo(5);
	});

	it('wraps the model with authored scale, rotation and offset', () => {
		const rig = buildModel3DRig(THREE, resolveModel3DSceneDescriptor(fixture), 1, 4);
		const model = new THREE.Object3D();
		const group = rig.placeModel(model);
		expect(group).not.toBe(model);
		expect(group.children).toContain(model);
		expect(group.scale.toArray()).toStrictEqual([2, 2, 2]);
		expect(group.rotation.y).toBeCloseTo(Math.PI / 2);
		expect(group.position.toArray()).toStrictEqual([1, 0, 0]);
	});

	it('creates typed lights and orthographic cameras', () => {
		const desc = resolveModel3DSceneDescriptor({
			...fixture,
			camera: { ...fixture.camera!, projection: 'orthographic' },
		});
		const rig = buildModel3DRig(THREE, desc, 2, 4);
		expect(rig.camera).toBeInstanceOf(THREE.OrthographicCamera);
		const ortho = rig.camera as THREE.OrthographicCamera;
		const before = ortho.right;
		rig.setAspect(4);
		expect(ortho.right).toBeCloseTo(before * 2);
		expect(rig.lights.map((l) => l.type)).toStrictEqual([
			'AmbientLight',
			'PointLight',
			'SpotLight',
			'DirectionalLight',
		]);
		expect((rig.lights[2] as THREE.SpotLight).angle).toBeCloseTo(Math.PI / 6);
		expect(rig.lights[1]!.position.toArray()).toStrictEqual([0, 2, 0]);
	});
});
