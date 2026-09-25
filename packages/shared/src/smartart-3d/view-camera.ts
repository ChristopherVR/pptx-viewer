/**
 * Cameras for the `<pptx-three-view>` SmartArt scene: the face-on
 * orthographic framing every quick style starts from, and the whole-diagram
 * camera of a scene quick style (`SmartArt3DModel.camera`).
 *
 * Both frame the diagram's own bounds (letterboxed to the view's aspect) so
 * the z = 0 plane keeps the 2D layout's scale; a scene camera then turns the
 * diagram about its centre (see `render/smartart-3d-scene-camera.ts`) and, for
 * a perspective preset, looks at it from `distance` layout px away with a
 * field of view that still frames that plane at the same scale.
 *
 * Must not import `three` at runtime.
 *
 * @module smartart-3d/view-camera
 */
import type * as THREE from 'three';

import type { SmartArt3DBounds, SmartArt3DCamera } from '../render/smartart-3d-types';
import type { ThreeModule, ThreeViewSize } from '../three-view/types';

/** Orthographic camera distance from the origin along +z (near/far only). */
const ORTHO_DISTANCE = 1000;

/** Half-extents of the view frustum at z = 0, letterboxed to the view's aspect. */
function frameHalfExtents(
	bounds: SmartArt3DBounds,
	size: ThreeViewSize,
): { halfW: number; halfH: number } {
	const halfW = Math.max(1, bounds.width) / 2;
	const halfH = Math.max(1, bounds.height) / 2;
	const aspect = Math.max(1, size.pixelWidth) / Math.max(1, size.pixelHeight);
	const fitHalfH = Math.max(halfH, halfW / aspect);
	return { halfW: fitHalfH * aspect, halfH: fitHalfH };
}

/** The camera for a model, framed for `size`. */
export function buildSmartArtViewCamera(
	three: ThreeModule,
	bounds: SmartArt3DBounds,
	sceneCamera: SmartArt3DCamera | undefined,
	size: ThreeViewSize,
): THREE.OrthographicCamera | THREE.PerspectiveCamera {
	let camera: THREE.OrthographicCamera | THREE.PerspectiveCamera;
	if (sceneCamera?.projection === 'perspective') {
		const distance = Math.max(1, sceneCamera.distance);
		camera = new three.PerspectiveCamera(30, 1, distance / 20, distance * 20);
		camera.position.set(0, 0, distance);
	} else {
		camera = new three.OrthographicCamera(-1, 1, 1, -1, -ORTHO_DISTANCE * 2, ORTHO_DISTANCE * 2);
		camera.position.set(0, 0, ORTHO_DISTANCE);
	}
	camera.zoom = sceneCamera?.zoom ?? 1;
	camera.lookAt(0, 0, 0);
	fitSmartArtViewCamera(camera, bounds, size);
	return camera;
}

/** Re-frame a camera from {@link buildSmartArtViewCamera} for a new view size. */
export function fitSmartArtViewCamera(
	camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
	bounds: SmartArt3DBounds,
	size: ThreeViewSize,
): void {
	const { halfW, halfH } = frameHalfExtents(bounds, size);
	if ('isPerspectiveCamera' in camera && camera.isPerspectiveCamera) {
		camera.aspect = halfW / halfH;
		camera.fov = (2 * Math.atan(halfH / camera.position.length()) * 180) / Math.PI;
	} else {
		const ortho = camera as THREE.OrthographicCamera;
		ortho.left = -halfW;
		ortho.right = halfW;
		ortho.top = halfH;
		ortho.bottom = -halfH;
	}
	camera.updateProjectionMatrix();
}
