/**
 * Vanilla three.js 3D surface-chart scene controller (framework-agnostic).
 *
 * Mounts an interactive surface chart into a caller-provided container: a
 * colour-displaced surface mesh (with optional wireframe), grid floor,
 * lights, an isometric camera, a RAF loop, and DOM axis labels re-projected
 * to screen each frame. Raycasts pointer moves against the mesh for a native
 * hover tooltip (see {@link ./surface-chart-3d-hit-test.ts}) and clicks/drags
 * for selection and value editing (see
 * {@link ./surface-chart-3d-interaction-wiring.ts}).
 *
 * `three` is an OPTIONAL peer dependency: every import is dynamic and
 * guarded, resolving to {@link SURFACE_THREE_UNAVAILABLE} when unavailable so
 * the caller falls back to the 2D renderer.
 */

import type * as THREE from 'three';

import type { TextStyleAnimationDescriptor } from './animation-text-style-resolve';
import { attachChart3DHoverTooltip } from './chart-3d-hover-tooltip';
import { createChart3DLabelProjector } from './chart-3d-label-projection';
import { loadChart3DOrbitControls, loadChart3DThree } from './chart-3d-three-loader';
import type { ChartPartRef } from './chart-view-model';
import {
	buildSurfaceGeometry,
	buildSurfaceLabels,
	computeCameraPlacement,
	computeGridExtent,
	MAX_HEIGHT,
} from './surface-chart-3d-geom';
import type { SurfaceCameraView3D } from './surface-chart-3d-geom';
import { buildSurfaceHoverTooltip } from './surface-chart-3d-hit-test';
import {
	attachSurfaceChart3DInteraction,
	createSurfaceHighlightMarker,
} from './surface-chart-3d-interaction-wiring';
import type { SurfaceChart3DInteraction } from './surface-chart-3d-interaction-wiring';
import { buildSurfaceWallMeshes } from './surface-chart-3d-walls';
import type { SurfaceWallColors } from './surface-chart-3d-walls';

export type { SurfaceChart3DInteraction };

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
	/** Authored `c:view3D` rotation (`rotX`/`rotY`) driving the initial camera. */
	view3D?: SurfaceCameraView3D;
	/** Authored `c:floor`/`c:sideWall`/`c:backWall` fill colours, when set. */
	surfaceColors?: SurfaceWallColors;
	/**
	 * Raw (un-normalised) values, row-major, length rows*cols. Feeds the
	 * pointer-raycast hover tooltip (see {@link buildSurfaceHoverTooltip}); a
	 * caller that omits it gets a mesh with no hover tooltip.
	 */
	values?: Float32Array;
	/** Per-series number-format codes, aligned to `seriesNames`. */
	numberFormats?: ReadonlyArray<string | undefined>;
	/** Active font-style emphasis override (bold/italic/underline/size/colour) for the axis labels. */
	textStyle?: TextStyleAnimationDescriptor;
}

/** `c:floor`/`c:sideWall`/`c:backWall` fill colours a scene can paint. */
export type SurfaceChart3DSurfaceColors = SurfaceWallColors;

/** Imperative handle to a mounted surface-chart view. */
export interface SurfaceChart3DHandle {
	/** Whether the scene mounted (false = `three`/addon missing). */
	readonly ok: boolean;
	/** Resize the renderer + camera + overlay to new CSS-pixel dimensions. */
	resize: (width: number, height: number) => void;
	/** Apply (or clear) the selected-vertex highlight marker, e.g. when selection changes via the inspector rather than a click on this scene. */
	setSelectedPart: (part: ChartPartRef | null) => void;
	/** Apply (or clear) a font-style emphasis override on the axis labels. */
	setTextStyle: (style: TextStyleAnimationDescriptor | undefined) => void;
	/** Tear down the renderer, controls, geometries, listeners, and overlays. */
	dispose: () => void;
}

/** No-op sentinel returned when `three` or its OrbitControls addon is missing. */
export const SURFACE_THREE_UNAVAILABLE: SurfaceChart3DHandle = {
	ok: false,
	resize: () => {},
	setSelectedPart: () => {},
	setTextStyle: () => {},
	dispose: () => {},
};

const FOV = 45;

/**
 * Mount an interactive 3D surface chart into `container` and start rendering.
 *
 * Resolves to {@link SURFACE_THREE_UNAVAILABLE} when `three` or its OrbitControls
 * addon cannot be loaded, so the caller can fall back to a 2D surface renderer.
 */
export async function mountSurfaceChart3D(
	container: HTMLElement,
	options: SurfaceChart3DSceneOptions,
	interaction?: SurfaceChart3DInteraction,
): Promise<SurfaceChart3DHandle> {
	const three = await loadChart3DThree();
	const OrbitCtrlCtor = three ? await loadChart3DOrbitControls() : null;
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
	const placement = computeCameraPlacement(cols, rows, options.view3D);
	camera.position.set(...placement.position);
	const target = new three.Vector3(...placement.target);
	camera.lookAt(target);

	// Grid floor under the surface.
	const { gridWidth, gridDepth } = computeGridExtent(cols, rows);
	const floorSize = Math.max(gridWidth, gridDepth) * 1.2;
	const gridFloor = new three.GridHelper(floorSize, Math.max(cols, rows), 0xcccccc, 0xe8e8e8);
	gridFloor.position.y = -0.02;
	scene.add(gridFloor);

	const walls = options.surfaceColors
		? buildSurfaceWallMeshes(three, cols, rows, MAX_HEIGHT, options.surfaceColors)
		: null;
	for (const mesh of walls?.meshes ?? []) {
		scene.add(mesh);
	}

	const { heightMap, colorMap } = options;
	const { geometry, wireGeometry } = buildSurfaceGeometry(three, cols, rows, heightMap, colorMap);
	const surfaceMaterial = new three.MeshPhongMaterial({
		vertexColors: true,
		side: three.DoubleSide,
		shininess: 30,
		transparent: true,
		opacity: 0.92,
	});
	const surfaceMesh = new three.Mesh(geometry, surfaceMaterial);
	scene.add(surfaceMesh);

	// Selected-vertex highlight: see `surface-chart-3d-interaction-wiring.ts`'s
	// module doc for why this is a marker mesh rather than a material tint.
	const highlightMarker = createSurfaceHighlightMarker(three, cols, rows, heightMap);
	scene.add(highlightMarker.mesh);

	let wireMaterial: THREE.LineBasicMaterial | null = null;
	if (options.wireframe) {
		wireMaterial = new three.LineBasicMaterial({
			color: 0x333333,
			transparent: true,
			opacity: 0.25,
		});
		scene.add(new three.LineSegments(wireGeometry, wireMaterial));
	}

	// Raycast-based hover tooltip against the single surface mesh (see
	// `surface-chart-3d-hit-test.ts` for the raycast-to-cell math).
	const hoverTooltip = attachChart3DHoverTooltip({
		three,
		canvas,
		camera,
		meshes: [surfaceMesh],
		buildTooltip: (intersection) =>
			buildSurfaceHoverTooltip(intersection?.faceIndex, {
				cols,
				rows,
				categoryLabels: options.categoryLabels,
				seriesNames: options.seriesNames,
				values: options.values,
				numberFormats: options.numberFormats,
			}),
	});

	const controls = new OrbitCtrlCtor(camera, canvas);
	controls.enablePan = true;
	controls.enableZoom = true;
	controls.enableRotate = true;
	controls.minDistance = 1;
	controls.maxDistance = 20;
	controls.maxPolarAngle = Math.PI / 2 + 0.3;
	controls.target.copy(target);
	controls.update();

	// Click-to-select + drag-to-value (see surface-chart-3d-interaction-wiring.ts).
	const pointerInteraction = attachSurfaceChart3DInteraction({
		three,
		canvas,
		camera,
		controls,
		width,
		height,
		surfaceMesh,
		cols,
		rows,
		heightMap,
		values: options.values,
		highlightMarker,
		interaction,
	});

	// Axis-label DOM overlay, re-projected to screen each frame.
	const doc = container.ownerDocument ?? document;
	const labels = buildSurfaceLabels(cols, rows, options.categoryLabels, options.seriesNames);
	const labelProjector = createChart3DLabelProjector(three, doc, labels);
	labelProjector.applyTextStyle(options.textStyle);
	container.appendChild(labelProjector.layer);

	let frame = 0;
	let disposed = false;
	const renderLoop = (): void => {
		if (disposed) {
			return;
		}
		frame = requestAnimationFrame(renderLoop);
		controls.update();
		renderer.render(scene, camera);
		labelProjector.update(camera, width, height);
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
			pointerInteraction.updateSize(width, height);
		},
		setSelectedPart(part: ChartPartRef | null) {
			pointerInteraction.setSelectedPart(part);
		},
		setTextStyle(style: TextStyleAnimationDescriptor | undefined) {
			labelProjector.applyTextStyle(style);
		},
		dispose() {
			if (disposed) {
				return;
			}
			disposed = true;
			cancelAnimationFrame(frame);
			hoverTooltip.dispose();
			pointerInteraction.dispose();
			controls.dispose();
			geometry.dispose();
			wireGeometry.dispose();
			surfaceMaterial.dispose();
			wireMaterial?.dispose();
			highlightMarker.dispose();
			gridFloor.dispose();
			walls?.dispose();
			scene.clear();
			renderer.dispose();
			canvas.remove();
			labelProjector.layer.remove();
		},
	};
}
