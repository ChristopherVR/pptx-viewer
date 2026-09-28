/**
 * three.js applier for a {@link Model3DSceneDescriptor}.
 *
 * Builds the camera, lights and (optional) model wrapper for
 * `mountModel3D` from the pure descriptor. `three` is passed in by the caller
 * (it is an optional, dynamically imported peer), so this file only carries
 * type-only imports.
 */

import type * as THREE from 'three';

import { DEFAULT_MODEL3D_FOV_DEG } from './model3d-scene-descriptor';
import type {
	Model3DLightDescriptor,
	Model3DSceneDescriptor,
	Vec3Tuple,
} from './model3d-scene-descriptor';

type ThreeModule = typeof THREE;

/** Distance of the built-in camera, and the fallback for authored ones. */
const DEFAULT_DISTANCE = 5;
const DEG = Math.PI / 180;

/**
 * Scene units per metre. The model is auto-fitted to a 2-unit cube, so one
 * metre spans `2 / (maxModelDim * meterPerModelUnit)` units. Without an
 * authored `meterPerModelUnit` the authored camera distance is normalised to
 * the default distance so the model still fills the view sensibly.
 */
export function computeMetresToSceneScale(
	desc: Model3DSceneDescriptor,
	maxModelDim: number,
): number {
	const mpu = desc.transform?.meterPerModelUnit;
	if (mpu && maxModelDim > 0) {
		return 2 / (maxModelDim * mpu);
	}
	const cam = desc.camera;
	const dist = Math.hypot(
		cam.position[0] - cam.target[0],
		cam.position[1] - cam.target[1],
		cam.position[2] - cam.target[2],
	);
	return dist > 0 ? DEFAULT_DISTANCE / dist : 1;
}

const scaled = (v: Vec3Tuple, k: number): Vec3Tuple => [v[0] * k, v[1] * k, v[2] * k];

/** The objects `mountModel3D` needs, built from a descriptor. */
export interface Model3DRig {
	camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
	lights: THREE.Object3D[];
	/** Camera-to-target distance in scene units (for orbit limits). */
	distance: number;
	/** Wrap the fitted model with the authored scale/rotation/offset, if any. */
	placeModel: (model: THREE.Object3D) => THREE.Object3D;
	/** Re-fit the camera after a viewport aspect change. */
	setAspect: (aspect: number) => void;
}

function buildLight(
	three: ThreeModule,
	light: Model3DLightDescriptor,
	k: number,
	authored: boolean,
): THREE.Object3D {
	const color = new three.Color(light.color);
	// Default-rig positions are already scene units; authored ones are metres.
	const pos = light.position ? (authored ? scaled(light.position, k) : light.position) : undefined;
	let obj: THREE.Light;
	switch (light.kind) {
		case 'ambient':
			return new three.AmbientLight(color, light.intensity);
		case 'point':
			obj = new three.PointLight(color, light.intensity);
			break;
		case 'spot': {
			const spot = new three.SpotLight(color, light.intensity);
			if (light.spotAngleDeg !== undefined) {
				spot.angle = Math.min(Math.PI / 2, Math.max(0.01, light.spotAngleDeg * DEG));
			}
			obj = spot;
			break;
		}
		default:
			obj = new three.DirectionalLight(color, light.intensity);
	}
	if (pos) {
		obj.position.set(pos[0], pos[1], pos[2]);
	} else if (light.direction) {
		// No authored position: place the light up-stream of its direction.
		const d = light.direction;
		obj.position.set(-d[0] * DEFAULT_DISTANCE, -d[1] * DEFAULT_DISTANCE, -d[2] * DEFAULT_DISTANCE);
	}
	return obj;
}

/** Build camera, lights and model placement for a descriptor. */
export function buildModel3DRig(
	three: ThreeModule,
	desc: Model3DSceneDescriptor,
	aspect: number,
	maxModelDim: number,
): Model3DRig {
	const authoredCam = desc.camera.framing === 'authored';
	const k = authoredCam || desc.transform ? computeMetresToSceneScale(desc, maxModelDim) : 1;
	const pos = authoredCam ? scaled(desc.camera.position, k) : desc.camera.position;
	const target = authoredCam ? scaled(desc.camera.target, k) : desc.camera.target;
	const distance = Math.hypot(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]);
	const fov = desc.camera.fovDeg || DEFAULT_MODEL3D_FOV_DEG;
	// Orthographic frustum height chosen to match the perspective view at the
	// target distance (the authored orthographic scale is not yet mapped).
	const halfHeight = distance * Math.tan((fov * DEG) / 2);

	let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
	if (desc.camera.kind === 'orthographic') {
		camera = new three.OrthographicCamera(
			-halfHeight * aspect,
			halfHeight * aspect,
			halfHeight,
			-halfHeight,
			0.1,
			1000,
		);
	} else {
		camera = new three.PerspectiveCamera(fov, aspect, 0.1, 1000);
	}
	camera.position.set(pos[0], pos[1], pos[2]);
	if (authoredCam) {
		camera.up.set(desc.camera.up[0], desc.camera.up[1], desc.camera.up[2]);
	}
	camera.lookAt(target[0], target[1], target[2]);

	const lights = desc.lights.map((l) => buildLight(three, l, k, desc.lightsAuthored));

	const t = desc.transform;
	return {
		camera,
		lights,
		distance,
		placeModel(model) {
			if (!t) {
				return model;
			}
			const group = new three.Group();
			group.add(model);
			group.scale.set(t.scale[0], t.scale[1], t.scale[2]);
			group.rotation.set(t.rotationDeg[0] * DEG, t.rotationDeg[1] * DEG, t.rotationDeg[2] * DEG);
			const post = scaled(t.postTranslate, k);
			group.position.set(post[0], post[1], post[2]);
			return group;
		},
		setAspect(next) {
			if (camera instanceof three.PerspectiveCamera) {
				camera.aspect = next;
			} else {
				camera.left = -halfHeight * next;
				camera.right = halfHeight * next;
			}
			camera.updateProjectionMatrix();
		},
	};
}
