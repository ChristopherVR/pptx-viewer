/**
 * `<pptx-three-view>` scene module for 3D SmartArt.
 *
 * Flat quick styles (Simple Fill, White Outline, Subtle, Moderate, Intense):
 * every mesh is a zero-depth `ShapeGeometry` face, unlit (`MeshBasicMaterial`),
 * under a fixed orthographic camera framing the diagram's own viewBox
 * (`model.bounds`) - the same geometry/fills/text the 2D SVG renderer draws,
 * built by `render/smartart-3d-drawing-model.ts`. Bevel/scene quick styles are
 * not implemented yet: `model.styleCategory` is `'bevel'`/`'scene'` for those
 * (currently unreachable, since `buildSmartArt3DSpecForElement` only emits
 * `'flat'`/legacy-layout models) and this module renders them with the same
 * flat pipeline as a stopgap rather than refusing to mount.
 *
 * Must not import `three` at runtime (use `ctx.three`): this module is
 * reachable from the main barrel through the scene registry.
 *
 * @module smartart-3d/view-scene
 */
import type * as THREE from 'three';

import type { SmartArt3DModel } from '../render/smartart-3d-types';
import type {
	ThreeOrbitControls,
	ThreeViewContext,
	ThreeViewScene,
	ThreeViewSize,
} from '../three-view/types';
import type { Disposable } from './flat-mesh-object';
import { buildFlatMeshObject } from './flat-mesh-object';

/** Camera distance from the origin along +z (orthographic, so magnitude only matters for near/far). */
const CAMERA_DISTANCE = 1000;
/** Fractional margin added around the diagram's own bounds when framing it. */
const FRAME_MARGIN = 1.06;

function buildOrthographicCamera(
	bounds: { width: number; height: number },
	three: typeof THREE,
): THREE.OrthographicCamera {
	const w = Math.max(1, bounds.width) * FRAME_MARGIN;
	const h = Math.max(1, bounds.height) * FRAME_MARGIN;
	const camera = new three.OrthographicCamera(
		-w / 2,
		w / 2,
		h / 2,
		-h / 2,
		-CAMERA_DISTANCE * 2,
		CAMERA_DISTANCE * 2,
	);
	camera.position.set(0, 0, CAMERA_DISTANCE);
	camera.lookAt(0, 0, 0);
	return camera;
}

/** Fit the camera's frustum to `bounds`, letterboxing to the view's own aspect ratio. */
function fitCamera(
	camera: THREE.OrthographicCamera,
	bounds: { width: number; height: number },
	size: ThreeViewSize,
): void {
	const w = Math.max(1, bounds.width) * FRAME_MARGIN;
	const h = Math.max(1, bounds.height) * FRAME_MARGIN;
	const aspect = Math.max(1, size.pixelWidth) / Math.max(1, size.pixelHeight);
	const halfW = w / 2;
	const halfH = h / 2;
	const fitHalfH = Math.max(halfH, halfW / aspect);
	const fitHalfW = fitHalfH * aspect;
	camera.left = -fitHalfW;
	camera.right = fitHalfW;
	camera.top = fitHalfH;
	camera.bottom = -fitHalfH;
	camera.updateProjectionMatrix();
}

export async function mountSmartArt3DView(
	model: SmartArt3DModel,
	ctx: ThreeViewContext,
): Promise<ThreeViewScene> {
	const { three } = ctx;
	const scene = new three.Scene();
	if (model.background) {
		scene.background = new three.Color(model.background);
	}

	const disposables: Disposable[] = [];
	for (const mesh of model.meshes) {
		const built = buildFlatMeshObject(three, mesh);
		scene.add(built.group);
		disposables.push(...built.disposables);
	}

	const camera = buildOrthographicCamera(model.bounds, three);
	const authoredPosition = camera.position.clone();
	fitCamera(camera, model.bounds, ctx.size);

	let controls: ThreeOrbitControls | null = null;
	let dampingActive = false;
	if (ctx.OrbitControls) {
		controls = new ctx.OrbitControls(camera, ctx.eventTarget);
		controls.enableDamping = true;
		controls.enablePan = false;
		controls.enabled = ctx.interactive;
		controls.enableRotate = ctx.interactive;
		controls.enableZoom = ctx.interactive;
		const onChange = (): void => {
			dampingActive = true;
			ctx.requestRender();
		};
		controls.addEventListener('change', onChange);
	}

	const resetView = (): void => {
		camera.position.copy(authoredPosition);
		camera.lookAt(0, 0, 0);
		if (controls) {
			controls.target.set(0, 0, 0);
			controls.update();
		}
		ctx.requestRender();
	};
	const onDoubleClick = (): void => resetView();
	ctx.eventTarget.addEventListener('dblclick', onDoubleClick);

	return {
		render(renderer) {
			if (controls) {
				dampingActive = controls.update();
			}
			renderer.render(scene, camera);
		},
		resize(size) {
			fitCamera(camera, model.bounds, size);
		},
		isAnimating() {
			return dampingActive;
		},
		setInteractive(on) {
			if (!controls) {
				return;
			}
			controls.enabled = on;
			controls.enableRotate = on;
			controls.enableZoom = on;
			if (!on) {
				resetView();
			}
		},
		dispose() {
			ctx.eventTarget.removeEventListener('dblclick', onDoubleClick);
			controls?.dispose();
			for (const d of disposables) {
				d.dispose();
			}
		},
	};
}
