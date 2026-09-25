/**
 * How far a turned SmartArt diagram reaches past its element box, and the
 * camera framing that draws it there (see `three-view/view-overflow.ts`).
 *
 * Must not import `three` at runtime (it takes the module as a parameter).
 *
 * @module smartart-3d/view-overflow
 */
import type * as THREE from 'three';

import type { ThreeModule, ThreeViewOverflow, ThreeViewSize } from '../three-view/types';
import {
	hasThreeViewOverflow,
	NO_THREE_VIEW_OVERFLOW,
	overflowViewOffset,
	threeViewOverflowFromNdc,
} from '../three-view/view-overflow';

type ViewCamera = THREE.OrthographicCamera | THREE.PerspectiveCamera;

/**
 * Project the corners of every mesh's bounding box through `camera` (with no
 * view offset) and measure how far they reach past the element box.
 */
function measureOverflow(
	three: ThreeModule,
	root: THREE.Object3D,
	camera: ViewCamera,
): ThreeViewOverflow {
	root.updateMatrixWorld(true);
	camera.updateMatrixWorld(true);
	const points: { x: number; y: number }[] = [];
	const corner = new three.Vector3();
	root.traverse((object) => {
		const geometry = (object as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
		if (!geometry?.getAttribute?.('position')) {
			return;
		}
		if (!geometry.boundingBox) {
			geometry.computeBoundingBox();
		}
		const box = geometry.boundingBox;
		if (!box || box.isEmpty()) {
			return;
		}
		for (let i = 0; i < 8; i++) {
			corner
				.set(
					i & 1 ? box.max.x : box.min.x,
					i & 2 ? box.max.y : box.min.y,
					i & 4 ? box.max.z : box.min.z,
				)
				.applyMatrix4(object.matrixWorld)
				.project(camera);
			points.push({ x: corner.x, y: corner.y });
		}
	});
	return threeViewOverflowFromNdc(points);
}

/**
 * Frame `camera` for the element box plus the diagram's overflow, and return
 * that overflow. `turned` is false for a face-on diagram, which always fits
 * its box (no overflow is measured).
 */
export function frameSmartArtOverflow(
	three: ThreeModule,
	root: THREE.Object3D,
	camera: ViewCamera,
	size: ThreeViewSize,
	turned: boolean,
): ThreeViewOverflow {
	camera.clearViewOffset();
	if (!turned) {
		return NO_THREE_VIEW_OVERFLOW;
	}
	const overflow = measureOverflow(three, root, camera);
	if (hasThreeViewOverflow(overflow)) {
		const offset = overflowViewOffset(size, overflow);
		camera.setViewOffset(
			offset.fullWidth,
			offset.fullHeight,
			offset.x,
			offset.y,
			offset.width,
			offset.height,
		);
	}
	return overflow;
}
