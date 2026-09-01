/**
 * Vanilla three.js 3D bar-chart scene controller (framework-agnostic).
 *
 * Mounts an interactive `bar3D` chart into a caller-provided container
 * element: dynamically imports `three` plus its `OrbitControls` addon, builds
 * one mesh per data point (clustered: each series its own depth plane;
 * stacked/percentStacked: coplanar, stacked vertically - see
 * {@link ./bar-chart-3d-data.ts}; geometry per box's resolved `c:shape` - see
 * {@link ./bar-chart-3d-geometry.ts}), a grid floor, authored `c:floor`/
 * `c:sideWall`/`c:backWall` panels, a perspective camera driven by `c:view3D`,
 * OrbitControls, and a RAF loop. Raycasts pointer moves against the boxes to
 * set a native hover tooltip on the canvas element (see
 * {@link ./bar-chart-3d-hit-test.ts}), matching every other chart kind's
 * SVG-`<title>` hover tooltip. Exposes `dispose()` for deterministic teardown.
 *
 * Mirrors {@link ./surface-chart-3d-scene.ts} (`mountSurfaceChart3D`), the
 * established shape for this "optional three.js scene with a 2D SVG safety
 * net" pattern: `three` is an OPTIONAL peer dependency, every import is
 * dynamic and guarded, and a missing dependency resolves to a no-op sentinel
 * handle so the caller falls back to the flat 2D renderer.
 *
 * @module bar-chart-3d-scene
 */

import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import type { BarChart3DSceneOptions } from './bar-chart-3d-data';
import { buildBar3DMeshGroup } from './bar-chart-3d-geometry';
import { buildBarChart3DHoverTooltip } from './bar-chart-3d-hit-test';
import type { BarChart3DHit } from './bar-chart-3d-hit-test';
import {
	buildCartesianChart3DLabels,
	computeCartesianCameraPlacement,
	computeCartesianGridExtent,
	MAX_VALUE_HEIGHT,
} from './cartesian-chart-3d-geom';
import { createLabelOverlay } from './surface-chart-3d-label-overlay';
import { buildSurfaceWallMeshes } from './surface-chart-3d-walls';

type ThreeModule = typeof THREE;

/** Imperative handle to a mounted bar3D chart view. */
export interface BarChart3DHandle {
	readonly ok: boolean;
	resize: (width: number, height: number) => void;
	dispose: () => void;
}

/** No-op sentinel returned when `three` or its OrbitControls addon is missing. */
export const BAR_CHART_THREE_UNAVAILABLE: BarChart3DHandle = {
	ok: false,
	resize: () => {},
	dispose: () => {},
};

async function loadThree(): Promise<ThreeModule | null> {
	try {
		return (await import('three')) as ThreeModule;
	} catch {
		return null;
	}
}

async function loadOrbitControlsCtor(): Promise<
	(new (camera: THREE.Camera, dom: HTMLElement) => OrbitControls) | null
> {
	try {
		const mod = await import('three/examples/jsm/controls/OrbitControls.js');
		return mod.OrbitControls;
	} catch {
		return null;
	}
}

/**
 * Mount an interactive 3D bar chart into `container` and start rendering.
 *
 * Resolves to {@link BAR_CHART_THREE_UNAVAILABLE} when `three` or its
 * OrbitControls addon cannot be loaded, so the caller can fall back to the
 * flat SVG oblique-projection bar3D renderer.
 */
export async function mountBarChart3D(
	container: HTMLElement,
	options: BarChart3DSceneOptions,
): Promise<BarChart3DHandle> {
	const three = await loadThree();
	const OrbitCtrlCtor = three ? await loadOrbitControlsCtor() : null;
	if (!three || !OrbitCtrlCtor) {
		return BAR_CHART_THREE_UNAVAILABLE;
	}

	let width = Math.max(1, options.width);
	let height = Math.max(1, options.height);

	const renderer = new three.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setPixelRatio(
		Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2),
	);
	renderer.setSize(width, height, false);
	const canvas = renderer.domElement;
	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;
	canvas.style.display = 'block';
	canvas.style.willChange = 'transform';
	container.appendChild(canvas);

	const scene = new three.Scene();
	scene.add(new three.AmbientLight(0xffffff, 0.6));
	const key = new three.DirectionalLight(0xffffff, 0.8);
	key.position.set(5, 8, 5);
	scene.add(key);
	const fill = new three.DirectionalLight(0xffffff, 0.3);
	fill.position.set(-3, 4, -2);
	scene.add(fill);

	const placement = computeCartesianCameraPlacement(options.cols, options.rows, options.view3D);
	const camera = new three.PerspectiveCamera(placement.fov, width / height, 0.1, 1000);
	camera.position.set(...placement.position);
	const target = new three.Vector3(...placement.target);
	camera.lookAt(target);

	// Grid floor, sized to this module's OWN grid extent (depthPercent-scaled).
	const extent = computeCartesianGridExtent(
		options.cols,
		options.rows,
		options.view3D?.depthPercent,
	);
	const floorSize = Math.max(extent.gridWidth, extent.gridDepth) * 1.2;
	const gridFloor = new three.GridHelper(
		floorSize,
		Math.max(options.cols, options.rows),
		0xcccccc,
		0xe8e8e8,
	);
	gridFloor.position.y = -0.02;
	scene.add(gridFloor);

	// Authored c:floor / c:sideWall / c:backWall backdrop panels. Passes this
	// module's OWN grid extent, never letting buildSurfaceWallMeshes recompute
	// a mismatched one.
	const walls = options.wallColors
		? buildSurfaceWallMeshes(
				three,
				options.cols,
				options.rows,
				MAX_VALUE_HEIGHT,
				options.wallColors,
				extent,
			)
		: null;
	for (const mesh of walls?.meshes ?? []) {
		scene.add(mesh);
	}

	// One mesh per data point, geometry chosen per box's resolved bar3D shape
	// (`box`, `cone[ToMax]`, `cylinder`, `pyramid[ToMax]`; see
	// {@link ./bar-chart-3d-geometry.ts}).
	const {
		meshes: boxMeshes,
		materials: boxMaterials,
		geometries: boxGeometries,
	} = buildBar3DMeshGroup(three, scene, options.boxes);

	// Raycast-based hover tooltip: each box mesh carries its own (series,
	// category, value) in `userData`, so a hit reports the cell directly (no
	// face-index -> cell arithmetic, unlike the surface chart's single mesh).
	const raycaster = new three.Raycaster();
	const pointerNdc = new three.Vector2();
	let hoveredTooltip: string | undefined;

	const updateHoverTooltip = (clientX: number, clientY: number): void => {
		const rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			return;
		}
		pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
		pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(pointerNdc, camera);
		const hits = raycaster.intersectObjects(boxMeshes, false);
		const hit = hits[0]?.object.userData as BarChart3DHit | undefined;
		const tooltip = buildBarChart3DHoverTooltip(hit, {
			categoryLabels: options.categoryLabels,
			seriesNames: options.seriesNames,
			numberFormats: options.numberFormats,
		});
		if (tooltip !== hoveredTooltip) {
			hoveredTooltip = tooltip;
			canvas.title = tooltip ?? '';
		}
	};
	const onPointerMove = (event: PointerEvent): void => {
		updateHoverTooltip(event.clientX, event.clientY);
	};
	const onPointerLeave = (): void => {
		if (hoveredTooltip !== undefined) {
			hoveredTooltip = undefined;
			canvas.title = '';
		}
	};
	canvas.addEventListener('pointermove', onPointerMove);
	canvas.addEventListener('pointerleave', onPointerLeave);

	const controls = new OrbitCtrlCtor(camera, canvas);
	controls.enablePan = true;
	controls.enableZoom = true;
	controls.enableRotate = true;
	controls.minDistance = 0.5;
	controls.maxDistance = 30;
	controls.maxPolarAngle = Math.PI / 2 + 0.3;
	controls.target.copy(target);
	controls.update();

	// Axis-label DOM overlay, re-projected to screen each frame.
	const doc = container.ownerDocument ?? document;
	const labels = buildCartesianChart3DLabels(
		options.cols,
		options.rows,
		options.categoryLabels,
		options.seriesNames,
		options.view3D?.depthPercent,
	);
	const { layer, nodes } = createLabelOverlay(doc, labels);
	container.appendChild(layer);
	const anchors = labels.map((l) => new three.Vector3(...l.anchor));
	const projected = new three.Vector3();

	const updateLabels = (): void => {
		for (let i = 0; i < nodes.length; i++) {
			projected.copy(anchors[i]).project(camera);
			const node = nodes[i];
			if (projected.z > 1) {
				node.style.display = 'none';
				continue;
			}
			node.style.display = '';
			node.style.left = `${((projected.x + 1) / 2) * width}px`;
			node.style.top = `${((-projected.y + 1) / 2) * height}px`;
		}
	};

	let frame = 0;
	let disposed = false;
	const renderLoop = (): void => {
		if (disposed) {
			return;
		}
		frame = requestAnimationFrame(renderLoop);
		controls.update();
		renderer.render(scene, camera);
		updateLabels();
	};
	frame = requestAnimationFrame(renderLoop);

	return {
		ok: true,
		resize(w: number, h: number) {
			width = Math.max(1, w);
			height = Math.max(1, h);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.setSize(width, height, false);
			canvas.style.width = `${width}px`;
			canvas.style.height = `${height}px`;
		},
		dispose() {
			if (disposed) {
				return;
			}
			disposed = true;
			cancelAnimationFrame(frame);
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('pointerleave', onPointerLeave);
			controls.dispose();
			for (const g of boxGeometries) {
				g.dispose();
			}
			for (const m of boxMaterials) {
				m.dispose();
			}
			gridFloor.dispose();
			walls?.dispose();
			scene.clear();
			renderer.dispose();
			canvas.remove();
			layer.remove();
		},
	};
}
