/**
 * The right-angle-axes (`c:view3D/@rAngAx=1`) variant of the perspective
 * chart camera (`chart-3d-persp-view.ts`), for the line / area / surface box:
 * PowerPoint draws such a chart as an oblique projection, like the bar chart
 * (`chart-3d-oblique-layout.ts`): the front plane is flat and each unit of
 * depth shifts `sin(rotY)` right and `sin(rotX)` up.
 *
 * The oblique camera plugs into the same `PerspView` pipeline: its "camera
 * space" is the box-centred point with depth folded in (`Z = 1`), so
 * `perspToScreen`, the rect fit and the labels work unchanged.
 *
 * @module chart-3d-persp-oblique
 */
import type * as THREE from 'three';

import type { PerspBox, PerspCamera, PerspView } from './chart-3d-persp-view';

type ThreeModule = typeof THREE;

/** An oblique camera's depth shear, screen units per unit of depth. */
export interface PerspOblique {
	/** Rightward shift per unit of depth, `sin(rotY)`. */
	shearX: number;
	/** Upward shift per unit of depth, `sin(rotX)`. */
	shearY: number;
}

/** The oblique camera for a box and its `c:view3D` angles (degrees). */
export function perspObliqueCameraFor(
	box: PerspBox,
	rotXDeg: number,
	rotYDeg: number,
): PerspCamera {
	return {
		box,
		yaw: 0,
		pitch: 0,
		dist: 1,
		oblique: {
			shearX: Math.sin((rotYDeg * Math.PI) / 180),
			shearY: Math.sin((rotXDeg * Math.PI) / 180),
		},
	};
}

/** Oblique "camera space": box-centred, depth sheared in, `Z = 1`. */
export function perspObliqueToCamera(
	box: PerspBox,
	oblique: PerspOblique,
	p: readonly [number, number, number],
): [number, number, number] {
	const x = p[0] - box.w / 2;
	const y = p[1] - box.h / 2;
	const z = p[2] - box.d / 2;
	return [x + z * oblique.shearX, y + z * oblique.shearY, 1];
}

/**
 * A three.js camera for an oblique view: an affine projection of the
 * box-centred space of {@link perspObliqueBoxMatrix}, nearer depth drawn in
 * front. Its inverse unprojects to straight rays, so picking works as for the
 * perspective camera.
 */
export function buildPerspObliqueCamera(
	three: ThreeModule,
	view: PerspView,
	oblique: PerspOblique,
	svgWidth: number,
	svgHeight: number,
): THREE.Camera {
	const camera = new three.Camera();
	const reach = Math.hypot(view.box.w, view.box.h, view.box.d);
	const sx = (2 * view.focal) / svgWidth;
	const sy = (2 * view.focal) / svgHeight;
	camera.projectionMatrix.set(
		sx,
		0,
		sx * oblique.shearX,
		(2 * view.cx) / svgWidth - 1,
		0,
		sy,
		sy * oblique.shearY,
		1 - (2 * view.cy) / svgHeight,
		0,
		0,
		1 / reach,
		0,
		0,
		0,
		0,
		1,
	);
	camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
	return camera;
}

/** Box space to the box-centred space of {@link buildPerspObliqueCamera}. */
export function perspObliqueBoxMatrix(three: ThreeModule, box: PerspBox): THREE.Matrix4 {
	return new three.Matrix4().makeTranslation(-box.w / 2, -box.h / 2, -box.d / 2);
}
