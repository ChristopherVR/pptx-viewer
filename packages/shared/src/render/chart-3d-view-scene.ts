/**
 * `<pptx-three-view>` scene module for 3D charts.
 *
 * Implements the oblique-projection family only (`c:view3D/@rAngAx=1`,
 * `bar3D`'s own default; verified against `gt/chart-01.webp`). The
 * perspective family (line3D/area3D/pie3D/surface3D, and bar3D's `standard`
 * grouping or a horizontal `c:barDir val="bar"`) is a materially different
 * true 3D grid+camera (see the chart track's progress log) and is not
 * implemented yet: `buildChart3DSpecForElement` already gates those out to
 * `geometry: null`, and this module throws for anything it cannot draw, so
 * the element keeps showing its slotted 2D fallback instead of a wrong
 * render.
 *
 * The oblique projection is built as a plain `OrthographicCamera` (1 world
 * unit = 1 authored chart px, matching `chart-3d-chrome-overlay.ts`'s
 * overlay `<svg>` viewBox exactly) with a SHEAR term hand-inserted into its
 * projection matrix, rather than tilting the camera or shearing the scene
 * graph: this keeps `OrbitControls` (a future enhancement; not wired yet)
 * well-defined, since only the camera moves, and keeps every box's world
 * position/size meaningful on its own instead of encoding the illusion into
 * mesh transforms.
 *
 * @module chart-3d-view-scene
 */
import type * as THREE from 'three';

import type { ThreeViewContext, ThreeViewScene } from '../three-view/types';
import { buildChart3DBarMeshes } from './chart-3d-bar-mesh';
import { renderChart3DChromeOverlaySvg } from './chart-3d-chrome-overlay';
import type { Chart3DSpec } from './chart-3d-spec';

/** Camera distance chosen so `NEAR`/`FAR` stay tight around the scene's own (tiny) depth extent. */
function buildObliqueCamera(
	three: ThreeModule,
	svgWidth: number,
	svgHeight: number,
	shearX: number,
	shearY: number,
): THREE.OrthographicCamera {
	const halfW = svgWidth / 2;
	const halfH = svgHeight / 2;
	const distance = halfW + halfH + 500;
	const camera = new three.OrthographicCamera(-halfW, halfW, halfH, -halfH, 1, distance + 2000);
	camera.position.set(0, 0, distance);
	camera.lookAt(0, 0, 0);
	camera.updateProjectionMatrix();

	// Hand-insert the oblique shear: clip_x += kX * ndcScaleX * world_z,
	// clip_y += kY * ndcScaleY * world_z (see the module doc + the chart
	// track's progress log for the sign derivation between the flat 2D
	// fallback's SVG-Y-down depth vector and this scene's world-Y-up frame:
	// X needs no flip (kX = -shearX), Y does (kY = +shearY)).
	const m = camera.projectionMatrix.elements;
	const ndcScaleX = m[0];
	const ndcScaleY = m[5];
	m[8] = -shearX * ndcScaleX;
	m[9] = shearY * ndcScaleY;
	camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
	return camera;
}

type ThreeModule = typeof THREE;

export async function mountChart3DView(
	spec: Chart3DSpec,
	ctx: ThreeViewContext,
): Promise<ThreeViewScene> {
	if (spec.projection.mode !== 'oblique' || spec.geometry?.kind !== 'bar') {
		throw new Error(
			`3D chart scene not implemented yet for chartType=${spec.chartType} projection=${spec.projection.mode}`,
		);
	}
	const three = ctx.three;
	const { vm, geometry } = spec;

	const camera = buildObliqueCamera(
		three,
		vm.svgWidth,
		vm.svgHeight,
		spec.projection.shearX,
		spec.projection.shearY,
	);

	const scene = new three.Scene();
	const bars = buildChart3DBarMeshes(three, geometry.boxes, vm.svgWidth, vm.svgHeight);
	scene.add(bars.group);

	const overlay = renderChart3DChromeOverlaySvg(ctx.document, vm);
	ctx.overlay.appendChild(overlay);

	let disposed = false;
	return {
		render(renderer: THREE.WebGLRenderer) {
			renderer.render(scene, camera);
		},
		resize() {
			// The orthographic frustum is fixed in authored chart-px units
			// (svgWidth/svgHeight), independent of the element's on-screen CSS
			// size, so nothing needs recomputing here.
		},
		isAnimating: () => false,
		dispose() {
			if (disposed) {
				return;
			}
			disposed = true;
			bars.dispose();
			overlay.remove();
		},
	};
}
