/**
 * Pure decision function: authored PowerPoint 3D scene data -> a
 * framework-neutral three.js scene descriptor.
 *
 * `resolveModel3DSceneDescriptor` reads the camera, model transform and lights
 * parsed by core (`Model3DSceneData`) and returns plain numbers/strings. All
 * lengths in the descriptor are METRES (EMU / 914400); the three.js applier
 * ({@link ./model3d-scene-apply}) converts metres into fitted scene units once
 * the model's size is known. When nothing is authored the descriptor reproduces
 * the viewer's long-standing default framing and lights.
 *
 * NOTE: not yet verified against PowerPoint renders (axis handedness of
 * `am3d:rot`, ordering of `preTrans`, and orthographic scale are unconfirmed).
 */

import type { Model3DLightData, Model3DSceneData, Model3DVec3 } from 'pptx-viewer-core';

const EMU_PER_METER = 914400;

/** Default vertical field of view (degrees) used when none is authored. */
export const DEFAULT_MODEL3D_FOV_DEG = 50;

/** Plain 3-tuple. */
export type Vec3Tuple = readonly [number, number, number];

/** Camera part of the descriptor. */
export interface Model3DCameraDescriptor {
	/** `authored` = derived from `am3d:camera`; `default` = built-in framing. */
	framing: 'authored' | 'default';
	kind: 'perspective' | 'orthographic';
	fovDeg: number;
	/** Metres in model space (`authored`) or fitted scene units (`default`). */
	position: Vec3Tuple;
	up: Vec3Tuple;
	/** Look-at target, same space as `position`. */
	target: Vec3Tuple;
}

/** Model placement part of the descriptor. */
export interface Model3DTransformDescriptor {
	/** Metres per model unit; `undefined` means "unknown, keep the fitted size". */
	meterPerModelUnit?: number;
	scale: Vec3Tuple;
	/** Euler XYZ rotation in degrees. */
	rotationDeg: Vec3Tuple;
	/** Offset applied after scale/rotation, metres. */
	postTranslate: Vec3Tuple;
}

/** One three.js light. */
export interface Model3DLightDescriptor {
	kind: 'ambient' | 'point' | 'spot' | 'directional';
	/** `#rrggbb`. */
	color: string;
	intensity: number;
	/** Metres (authored) or scene units (default lights). */
	position?: Vec3Tuple;
	/** Direction the light travels; directional/spot only. */
	direction?: Vec3Tuple;
	/** Spot cone half-angle in degrees. */
	spotAngleDeg?: number;
}

/** Framework-neutral scene descriptor consumed by the three.js applier. */
export interface Model3DSceneDescriptor {
	/** `true` when any of camera/transform/lights came from the file. */
	authored: boolean;
	camera: Model3DCameraDescriptor;
	/** `true` when `lights` came from the file (positions are then metres). */
	lightsAuthored: boolean;
	/** `undefined` when no `am3d:trans` was authored. */
	transform?: Model3DTransformDescriptor;
	lights: Model3DLightDescriptor[];
}

/** The built-in camera (unchanged pre-existing framing). */
export const DEFAULT_MODEL3D_CAMERA: Model3DCameraDescriptor = {
	framing: 'default',
	kind: 'perspective',
	fovDeg: DEFAULT_MODEL3D_FOV_DEG,
	position: [0, 0, 5],
	up: [0, 1, 0],
	target: [0, 0, 0],
};

/** The built-in lights (unchanged pre-existing rig). */
export const DEFAULT_MODEL3D_LIGHTS: readonly Model3DLightDescriptor[] = [
	{ kind: 'ambient', color: '#ffffff', intensity: 0.5 },
	{ kind: 'directional', color: '#ffffff', intensity: 1, position: [5, 5, 5] },
	{ kind: 'directional', color: '#ffffff', intensity: 0.3, position: [-3, -3, 2] },
];

const metres = (v: Model3DVec3 | undefined, fallback: Vec3Tuple): Vec3Tuple =>
	v ? [v.x / EMU_PER_METER, v.y / EMU_PER_METER, v.z / EMU_PER_METER] : fallback;

function unit(v: Model3DVec3 | undefined): Vec3Tuple | undefined {
	if (!v) {
		return undefined;
	}
	const len = Math.hypot(v.x, v.y, v.z);
	return len > 0 ? [v.x / len, v.y / len, v.z / len] : undefined;
}

function resolveCamera(scene: Model3DSceneData): Model3DCameraDescriptor {
	const cam = scene.camera;
	const position = cam?.position;
	if (!cam || !position) {
		return DEFAULT_MODEL3D_CAMERA;
	}
	const fov =
		cam.fovDeg !== undefined && cam.fovDeg > 0 && cam.fovDeg < 180 ? cam.fovDeg : undefined;
	return {
		framing: 'authored',
		kind: cam.projection,
		fovDeg: fov ?? DEFAULT_MODEL3D_FOV_DEG,
		position: metres(position, [0, 0, 5]),
		up: unit(cam.up) ?? [0, 1, 0],
		target: metres(cam.lookAt, [0, 0, 0]),
	};
}

function resolveLight(light: Model3DLightData): Model3DLightDescriptor {
	const base = {
		kind: light.kind,
		color: light.color ?? '#ffffff',
		intensity: Math.max(0, light.illuminance ?? (light.kind === 'ambient' ? 0.5 : 1)),
	};
	if (light.kind === 'ambient') {
		return base;
	}
	return {
		...base,
		...(light.position ? { position: metres(light.position, [0, 0, 0]) } : {}),
		...(light.direction ? { direction: unit(light.direction) } : {}),
		...(light.kind === 'spot' && light.spotAngleDeg !== undefined
			? { spotAngleDeg: light.spotAngleDeg }
			: {}),
	};
}

function resolveTransform(scene: Model3DSceneData): Model3DTransformDescriptor | undefined {
	const t = scene.transform;
	if (!t) {
		return undefined;
	}
	const mpu =
		t.meterPerModelUnit !== undefined && t.meterPerModelUnit > 0 ? t.meterPerModelUnit : undefined;
	const s = t.scale;
	const r = t.rotationDeg;
	return {
		...(mpu !== undefined ? { meterPerModelUnit: mpu } : {}),
		scale: s ? [s.x, s.y, s.z] : [1, 1, 1],
		rotationDeg: r ? [r.x, r.y, r.z] : [0, 0, 0],
		postTranslate: metres(t.postTranslate, [0, 0, 0]),
	};
}

/**
 * Turn parsed 3D scene data into a three.js scene descriptor. With no data
 * (or no authored camera / lights) the matching part falls back to the default
 * framing / lights, so `resolveModel3DSceneDescriptor(undefined)` equals the
 * previous hard-coded setup.
 */
export function resolveModel3DSceneDescriptor(
	scene: Model3DSceneData | undefined,
): Model3DSceneDescriptor {
	if (!scene) {
		return {
			authored: false,
			camera: DEFAULT_MODEL3D_CAMERA,
			lightsAuthored: false,
			lights: [...DEFAULT_MODEL3D_LIGHTS],
		};
	}
	const camera = resolveCamera(scene);
	const transform = resolveTransform(scene);
	const lights =
		scene.lights.length > 0 ? scene.lights.map(resolveLight) : [...DEFAULT_MODEL3D_LIGHTS];
	return {
		authored: camera.framing === 'authored' || transform !== undefined || scene.lights.length > 0,
		camera,
		lightsAuthored: scene.lights.length > 0,
		...(transform ? { transform } : {}),
		lights,
	};
}
