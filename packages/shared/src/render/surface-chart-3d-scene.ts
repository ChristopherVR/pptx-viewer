/**
 * Vanilla three.js 3D surface-chart scene controller (framework-agnostic).
 *
 * Mounts an interactive surface chart into a caller-provided container element:
 * dynamically imports `three` plus its `OrbitControls` addon, builds a colour-
 * displaced surface mesh (with optional wireframe), grid floor, lights, and an
 * isometric camera, renders with a RAF loop, and overlays axis labels as DOM
 * nodes that are re-projected to screen each frame. Exposes `dispose()` for
 * deterministic teardown of GPU resources, listeners, and overlay nodes.
 *
 * `three` is an OPTIONAL peer dependency: every import is dynamic and guarded.
 * When `three` (or its OrbitControls addon) is missing, {@link mountSurfaceChart3D}
 * resolves to a sentinel handle ({@link SURFACE_THREE_UNAVAILABLE}) so the caller
 * can fall back to the 2D renderer. No framework imports - React, Vue, and
 * Angular bindings can all mount it.
 */

import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import {
	buildSurfaceGeometry,
	buildSurfaceLabels,
	computeCameraPlacement,
	computeGridExtent,
} from './surface-chart-3d-geom';
import type { SurfaceLabel } from './surface-chart-3d-geom';

type ThreeModule = typeof THREE;

/** Inputs describing the surface to render and its container size. */
export interface SurfaceChart3DSceneOptions {
	cols: number;
	rows: number;
	/** Normalised heights, row-major, length rows*cols, each in [0, 1]. */
	heightMap: Float32Array;
	/** Flat RGB triplets, length rows*cols*3, each channel in [0, 1]. */
	colorMap: Float32Array;
	/** Draw wireframe grid lines over the surface. */
	wireframe: boolean;
	categoryLabels: ReadonlyArray<string>;
	seriesNames: ReadonlyArray<string>;
	width: number;
	height: number;
	/** Device pixel-ratio cap. Default `2`. */
	maxPixelRatio?: number;
}

/** Imperative handle to a mounted surface-chart view. */
export interface SurfaceChart3DHandle {
	/** Whether the scene mounted (false = `three`/addon missing). */
	readonly ok: boolean;
	/** Resize the renderer + camera + overlay to new CSS-pixel dimensions. */
	resize: (width: number, height: number) => void;
	/** Tear down the renderer, controls, geometries, listeners, and overlays. */
	dispose: () => void;
}

/** No-op sentinel returned when `three` or its OrbitControls addon is missing. */
export const SURFACE_THREE_UNAVAILABLE: SurfaceChart3DHandle = {
	ok: false,
	resize: () => {},
	dispose: () => {},
};

const FOV = 45;

/** Dynamically load `three`; returns `null` when the package is not installed. */
async function loadThree(): Promise<ThreeModule | null> {
	try {
		return (await import('three')) as ThreeModule;
	} catch {
		return null;
	}
}

/** Dynamically load the OrbitControls addon; returns `null` when unavailable. */
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

/** Create the DOM overlay nodes for the axis labels, returned with the layer. */
function createLabelOverlay(
	doc: Document,
	labels: ReadonlyArray<SurfaceLabel>,
): { layer: HTMLDivElement; nodes: HTMLDivElement[] } {
	const layer = doc.createElement('div');
	Object.assign(layer.style, {
		position: 'absolute',
		inset: '0',
		pointerEvents: 'none',
		overflow: 'hidden',
	});

	const nodes = labels.map((label) => {
		const node = doc.createElement('div');
		node.textContent = label.text;
		const color = label.axis === 'value' ? '#999' : '#666';
		Object.assign(node.style, {
			position: 'absolute',
			fontSize: '9px',
			color,
			whiteSpace: 'nowrap',
			userSelect: 'none',
			transform: 'translate(-50%, -50%)',
			willChange: 'left, top',
		});
		if (label.axis === 'value') {
			node.style.writingMode = 'vertical-rl';
		}
		layer.appendChild(node);
		return node;
	});

	return { layer, nodes };
}

/**
 * Mount an interactive 3D surface chart into `container` and start rendering.
 *
 * Resolves to {@link SURFACE_THREE_UNAVAILABLE} when `three` or its OrbitControls
 * addon cannot be loaded, so the caller can fall back to a 2D surface renderer.
 */
export async function mountSurfaceChart3D(
	container: HTMLElement,
	options: SurfaceChart3DSceneOptions,
): Promise<SurfaceChart3DHandle> {
	const three = await loadThree();
	const OrbitCtrlCtor = three ? await loadOrbitControlsCtor() : null;
	if (!three || !OrbitCtrlCtor) {
		return SURFACE_THREE_UNAVAILABLE;
	}

	const { cols, rows } = options;
	let width = Math.max(1, options.width);
	let height = Math.max(1, options.height);

	const renderer = new three.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setPixelRatio(
		Math.min(
			typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
			options.maxPixelRatio ?? 2,
		),
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

	const camera = new three.PerspectiveCamera(FOV, width / height, 0.1, 1000);
	const placement = computeCameraPlacement(cols, rows);
	camera.position.set(...placement.position);
	const target = new three.Vector3(...placement.target);
	camera.lookAt(target);

	// Grid floor under the surface.
	const { gridWidth, gridDepth } = computeGridExtent(cols, rows);
	const floorSize = Math.max(gridWidth, gridDepth) * 1.2;
	const gridFloor = new three.GridHelper(floorSize, Math.max(cols, rows), 0xcccccc, 0xe8e8e8);
	gridFloor.position.y = -0.02;
	scene.add(gridFloor);

	// Surface mesh + optional wireframe.
	const { geometry, wireGeometry } = buildSurfaceGeometry(
		three,
		cols,
		rows,
		options.heightMap,
		options.colorMap,
	);
	const surfaceMaterial = new three.MeshPhongMaterial({
		vertexColors: true,
		side: three.DoubleSide,
		shininess: 30,
		transparent: true,
		opacity: 0.92,
	});
	const surfaceMesh = new three.Mesh(geometry, surfaceMaterial);
	scene.add(surfaceMesh);

	let wireMaterial: THREE.LineBasicMaterial | null = null;
	if (options.wireframe) {
		wireMaterial = new three.LineBasicMaterial({
			color: 0x333333,
			transparent: true,
			opacity: 0.25,
		});
		scene.add(new three.LineSegments(wireGeometry, wireMaterial));
	}

	const controls = new OrbitCtrlCtor(camera, canvas);
	controls.enablePan = true;
	controls.enableZoom = true;
	controls.enableRotate = true;
	controls.minDistance = 1;
	controls.maxDistance = 20;
	controls.maxPolarAngle = Math.PI / 2 + 0.3;
	controls.target.copy(target);
	controls.update();

	// Axis-label DOM overlay, re-projected to screen each frame.
	const doc = container.ownerDocument ?? document;
	const labels = buildSurfaceLabels(cols, rows, options.categoryLabels, options.seriesNames);
	const { layer, nodes } = createLabelOverlay(doc, labels);
	container.appendChild(layer);
	const anchors = labels.map((l) => new three.Vector3(...l.anchor));
	const projected = new three.Vector3();

	const updateLabels = (): void => {
		for (let i = 0; i < nodes.length; i++) {
			projected.copy(anchors[i]).project(camera);
			const node = nodes[i];
			// Hide labels behind the camera.
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
			controls.dispose();
			geometry.dispose();
			wireGeometry.dispose();
			surfaceMaterial.dispose();
			wireMaterial?.dispose();
			gridFloor.dispose();
			scene.clear();
			renderer.dispose();
			canvas.remove();
			layer.remove();
		},
	};
}
