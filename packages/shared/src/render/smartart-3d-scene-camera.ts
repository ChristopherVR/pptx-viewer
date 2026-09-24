/**
 * Whole-diagram camera for the SmartArt scene quick styles
 * (framework-agnostic, pure).
 *
 * Rotation convention (degrees): a diagram point `P` is turned by
 * `R = Rz(rev) . Rx(lat) . Ry(-lon)` about the diagram centre, then projected
 * along -z. Its orthographic front-face projection is exactly the
 * COM-validated `a:camera/a:rot` model in `visual-3d-camera-parametric.ts`
 * (`x = X cos lon`, `y = Y cos lat - X sin lat sin lon`, then a `rev` roll),
 * so an explicit `a:rot` is used as authored.
 *
 * Presets without `a:rot` take their pose from {@link SCENE_CAMERA_PRESETS}:
 * the COM-measured unit-square homographies of `visual-3d-camera-homography`
 * fitted to this pinhole model (rotation + camera distance, in multiples of
 * the measured 2in square's side). The distance is absolute: the SmartArt
 * scene-style exports show a whole diagram under `perspectiveLeft` with far
 * stronger foreshortening than a 2in shape, so it is converted to layout px
 * ({@link MEASURED_SQUARE_PX}) rather than scaled to the diagram. A preset
 * missing from the table falls back to the legacy `CAMERA_PRESET_MAP` angles.
 * `@fov` is not modelled.
 *
 * @module render/smartart-3d-scene-camera
 */
import type { Pptx3DScene } from 'pptx-viewer-core';

import type { SmartArt3DCamera } from './smartart-3d-solid-types';
import type { Vec3 } from './smartart-3d-types';
import { CAMERA_PRESET_MAP } from './visual-3d-camera-presets';

/** A fitted preset pose; `distance` absent means a parallel projection. */
interface ScenePresetPose {
	lat: number;
	lon: number;
	rev: number;
	distance?: number;
}

/** Camera distance used for a perspective preset with no fitted pose. */
const DEFAULT_PERSPECTIVE_DISTANCE = 6;

/** Side of the COM measurement square the preset distances are in: 2in at 96 px/in. */
export const MEASURED_SQUARE_PX = 192;

/**
 * Presets the SmartArt scene quick styles use (plus their mirror images),
 * fitted from `CAMERA_HOMOGRAPHY_MAP`.
 */
export const SCENE_CAMERA_PRESETS: Record<string, ScenePresetPose> = {
	orthographicFront: { lat: 0, lon: 0, rev: 0 },
	perspectiveFront: { lat: 0, lon: 0, rev: 0, distance: 160 },
	perspectiveLeft: { lat: 0, lon: 20.4, rev: 0, distance: 8.3 },
	perspectiveRight: { lat: 0, lon: -20.4, rev: 0, distance: 8.3 },
	perspectiveRelaxed: { lat: -50.8, lon: 0.3, rev: -0.2, distance: 7.8 },
	perspectiveRelaxedModerately: { lat: -35.1, lon: 0, rev: 0, distance: 7.9 },
	perspectiveHeroicExtremeRightFacing: { lat: 8, lon: -36.1, rev: 2.1, distance: 4.2 },
	perspectiveHeroicExtremeLeftFacing: { lat: 8, lon: 36.1, rev: -2.1, distance: 4.2 },
	isometricOffAxis2Left: { lat: 18, lon: 26, rev: 0 },
	isometricOffAxis2Right: { lat: 18, lon: -26, rev: 0 },
};

const DEG_PER_UNIT = 60000;

function toDeg(value: number | undefined): number {
	return value ? value / DEG_PER_UNIT : 0;
}

/**
 * `a:camera/@zoom` as a fraction. Core passes the raw ST_PositivePercentage
 * (`95000` = 95%); a value already in fraction form is kept.
 */
function normalizeZoom(value: number | undefined): number {
	if (!value || value <= 0) {
		return 1;
	}
	return value > 10 ? value / 100000 : value;
}

function presetPose(preset: string): ScenePresetPose {
	const fitted = SCENE_CAMERA_PRESETS[preset];
	if (fitted) {
		return fitted;
	}
	const legacy = CAMERA_PRESET_MAP[preset];
	const perspective = preset.startsWith('perspective');
	return {
		lat: legacy?.rotateX ?? 0,
		lon: legacy?.rotateY ?? 0,
		rev: legacy?.rotateZ ?? 0,
		...(perspective ? { distance: DEFAULT_PERSPECTIVE_DISTANCE } : {}),
	};
}

/**
 * The diagram camera for a quick style's `dgm:scene3d`, or `undefined` when
 * it leaves the diagram face-on (no scene, or an `orthographicFront` camera
 * with no rotation), where the flat framing already matches PowerPoint.
 */
export function resolveSmartArt3DCamera(
	scene: Pptx3DScene | undefined,
): SmartArt3DCamera | undefined {
	if (!scene) {
		return undefined;
	}
	const preset = scene.cameraPreset ?? 'orthographicFront';
	const pose = presetPose(preset);
	const hasRot =
		scene.cameraRotX !== undefined ||
		scene.cameraRotY !== undefined ||
		scene.cameraRotZ !== undefined;
	const latDeg = hasRot ? toDeg(scene.cameraRotX) : pose.lat;
	const lonDeg = hasRot ? toDeg(scene.cameraRotY) : pose.lon;
	const revDeg = hasRot ? toDeg(scene.cameraRotZ) : pose.rev;
	const distance = pose.distance === undefined ? undefined : pose.distance * MEASURED_SQUARE_PX;
	const zoom = normalizeZoom(scene.cameraZoom);
	if (latDeg === 0 && lonDeg === 0 && revDeg === 0 && distance === undefined && zoom === 1) {
		return undefined;
	}
	return {
		projection: distance === undefined ? 'orthographic' : 'perspective',
		latDeg,
		lonDeg,
		revDeg,
		distance: distance ?? 0,
		zoom,
	};
}

/**
 * The camera's rotation as a row-major 3x3 matrix (`R = Rz(rev) . Rx(lat) .
 * Ry(-lon)`).
 */
export function smartArt3DCameraMatrix(camera: SmartArt3DCamera): number[] {
	const rad = Math.PI / 180;
	const cl = Math.cos(camera.latDeg * rad);
	const sl = Math.sin(camera.latDeg * rad);
	const co = Math.cos(-camera.lonDeg * rad);
	const so = Math.sin(-camera.lonDeg * rad);
	const cr = Math.cos(camera.revDeg * rad);
	const sr = Math.sin(camera.revDeg * rad);
	// Rx(lat) . Ry(-lon)
	const m = [co, 0, so, sl * so, cl, -sl * co, -cl * so, sl, cl * co];
	// Rz(rev) . m
	return [
		cr * m[0] - sr * m[3],
		cr * m[1] - sr * m[4],
		cr * m[2] - sr * m[5],
		sr * m[0] + cr * m[3],
		sr * m[1] + cr * m[4],
		sr * m[2] + cr * m[5],
		m[6],
		m[7],
		m[8],
	];
}

/**
 * The camera position in diagram space (before the rotation), for per-point
 * view directions: `R^T . (0, 0, distance)`. `undefined` for a parallel
 * projection.
 */
export function smartArt3DEyeInDiagram(camera: SmartArt3DCamera): Vec3 | undefined {
	if (camera.projection !== 'perspective') {
		return undefined;
	}
	const m = smartArt3DCameraMatrix(camera);
	// Third row of R, i.e. the third column of R^T, times the distance.
	return { x: m[6] * camera.distance, y: m[7] * camera.distance, z: m[8] * camera.distance };
}
