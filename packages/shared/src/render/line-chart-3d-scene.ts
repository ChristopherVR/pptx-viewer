/**
 * Vanilla three.js 3D line-chart scene controller (framework-agnostic).
 *
 * Mounts an interactive `line3D` chart into a caller-provided container
 * element: dynamically imports `three` plus its `OrbitControls` addon, builds
 * one `THREE.TubeGeometry` (swept along a `THREE.CatmullRomCurve3` through
 * that series' category/value points) per series, each on its own depth
 * ("Z") plane (see {@link ./cartesian-line-chart-3d-layout.ts}), plus a small
 * sphere marker per data point for precise raycast hover, a grid floor,
 * authored `c:floor`/`c:sideWall`/`c:backWall` panels, a perspective camera
 * driven by `c:view3D`, OrbitControls, and a RAF loop. Exposes `dispose()`
 * for deterministic teardown.
 *
 * Mirrors {@link ./bar-chart-3d-scene.ts} (`mountBarChart3D`), the
 * established shape for this "optional three.js scene with a 2D SVG safety
 * net" pattern: `three` is an OPTIONAL peer dependency, every import is
 * dynamic and guarded, and a missing dependency resolves to a no-op sentinel
 * handle so the caller falls back to the flat 2D renderer.
 *
 * @module line-chart-3d-scene
 */

import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import {
	buildCartesianChart3DLabels,
	computeCartesianCameraPlacement,
	computeCartesianGridExtent,
	MAX_VALUE_HEIGHT,
} from './cartesian-chart-3d-geom';
import type { CartesianChart3DHit } from './cartesian-chart-3d-hit-test';
import { buildCartesianChart3DHoverTooltip } from './cartesian-chart-3d-hit-test';
import type { CartesianLine3DSceneOptions } from './cartesian-line-chart-3d-data';
import { createLabelOverlay } from './surface-chart-3d-label-overlay';
import { buildSurfaceWallMeshes } from './surface-chart-3d-walls';

type ThreeModule = typeof THREE;

/** Imperative handle to a mounted line3D chart view. */
export interface LineChart3DHandle {
	readonly ok: boolean;
	resize: (width: number, height: number) => void;
	dispose: () => void;
}

/** No-op sentinel returned when `three` or its OrbitControls addon is missing. */
export const LINE_CHART_THREE_UNAVAILABLE: LineChart3DHandle = {
	ok: false,
	resize: () => {},
	dispose: () => {},
};

/** World-space radius of the tube swept along a series' path. */
const TUBE_RADIUS = 0.025;
/** World-space radius of each per-vertex hover marker. */
const MARKER_RADIUS = 0.045;

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
 * Mount an interactive 3D line chart into `container` and start rendering.
 *
 * Resolves to {@link LINE_CHART_THREE_UNAVAILABLE} when `three` or its
 * OrbitControls addon cannot be loaded, so the caller can fall back to the
 * flat SVG oblique-projection line3D renderer.
 */
export async function mountLineChart3D(
	container: HTMLElement,
	options: CartesianLine3DSceneOptions,
): Promise<LineChart3DHandle> {
	const three = await loadThree();
	const OrbitCtrlCtor = three ? await loadOrbitControlsCtor() : null;
	if (!three || !OrbitCtrlCtor) {
		return LINE_CHART_THREE_UNAVAILABLE;
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

	// One tube mesh per series (its own depth plane), one shared sphere
	// geometry for the per-vertex hover markers (scaled/positioned per point).
	const markerGeometry = new three.SphereGeometry(MARKER_RADIUS, 8, 6);
	const tubeGeometries: THREE.TubeGeometry[] = [];
	const tubeMaterials: THREE.Material[] = [];
	const markerMeshes: THREE.Mesh[] = [];
	const markerMaterials: THREE.Material[] = [];

	for (const path of options.series) {
		if (path.vertices.length >= 2) {
			const curve = new three.CatmullRomCurve3(
				path.vertices.map((v) => new three.Vector3(...v.position)),
			);
			const tubeGeometry = new three.TubeGeometry(
				curve,
				Math.max(path.vertices.length * 8, 16),
				TUBE_RADIUS,
				8,
				false,
			);
			const tubeMaterial = new three.MeshPhongMaterial({ color: path.color, shininess: 30 });
			const tube = new three.Mesh(tubeGeometry, tubeMaterial);
			scene.add(tube);
			tubeGeometries.push(tubeGeometry);
			tubeMaterials.push(tubeMaterial);
		}
		for (const v of path.vertices) {
			const markerMaterial = new three.MeshPhongMaterial({ color: path.color, shininess: 30 });
			const marker = new three.Mesh(markerGeometry, markerMaterial);
			marker.position.set(...v.position);
			marker.userData = {
				seriesIndex: v.seriesIndex,
				categoryIndex: v.categoryIndex,
				value: v.value,
			} satisfies CartesianChart3DHit;
			scene.add(marker);
			markerMeshes.push(marker);
			markerMaterials.push(markerMaterial);
		}
	}

	// Raycast-based hover tooltip against the per-vertex marker meshes: each
	// carries its own (series, category, value) in `userData`.
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
		const hits = raycaster.intersectObjects(markerMeshes, false);
		const hit = hits[0]?.object.userData as CartesianChart3DHit | undefined;
		const tooltip = buildCartesianChart3DHoverTooltip(hit, {
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
			markerGeometry.dispose();
			for (const g of tubeGeometries) {
				g.dispose();
			}
			for (const m of [...tubeMaterials, ...markerMaterials]) {
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
