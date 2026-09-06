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
 * A horizontal 3-D Bar (`options.horizontal`) mounts the SAME scene: boxes
 * arrive already remapped into the horizontal frame, so this module only
 * rotates each mesh to match and builds the label overlay in that frame.
 *
 * @module bar-chart-3d-scene
 */

import type { TextStyleAnimationDescriptor } from './animation-text-style-resolve';
import type { BarChart3DSceneOptions } from './bar-chart-3d-data';
import { buildBar3DMeshGroup } from './bar-chart-3d-geometry';
import { buildBarChart3DHoverTooltip } from './bar-chart-3d-hit-test';
import type { BarChart3DHit } from './bar-chart-3d-hit-test';
import { attachBarChart3DInteraction } from './bar-chart-3d-interaction-wiring';
import type { BarChart3DInteraction } from './bar-chart-3d-interaction-wiring';
import { createBarChart3DTextureManager } from './bar-chart-3d-materials';
import {
	buildCartesianChart3DLabels,
	computeCartesianCameraPlacement,
	computeCartesianGridExtent,
	MAX_VALUE_HEIGHT,
} from './cartesian-chart-3d-geom';
import { attachChart3DHoverTooltip } from './chart-3d-hover-tooltip';
import { createChart3DLabelProjector } from './chart-3d-label-projection';
import type { HighlightableMaterialRef } from './chart-3d-mesh-highlight';
import { loadChart3DOrbitControls, loadChart3DThree } from './chart-3d-three-loader';
import type { ChartPartRef } from './chart-view-model';
import { buildSurfaceWallMeshes } from './surface-chart-3d-walls';

export type { BarChart3DInteraction };

/** Imperative handle to a mounted bar3D chart view. */
export interface BarChart3DHandle {
	readonly ok: boolean;
	resize: (width: number, height: number) => void;
	/** Apply (or clear) the selected-mark highlight, e.g. when selection changes via the inspector rather than a click on this scene. */
	setSelectedPart: (part: ChartPartRef | null) => void;
	/** Apply (or clear) a font-style emphasis override on the axis labels. */
	setTextStyle: (style: TextStyleAnimationDescriptor | undefined) => void;
	dispose: () => void;
}

/** No-op sentinel returned when `three` or its OrbitControls addon is missing. */
export const BAR_CHART_THREE_UNAVAILABLE: BarChart3DHandle = {
	ok: false,
	resize: () => {},
	setSelectedPart: () => {},
	setTextStyle: () => {},
	dispose: () => {},
};

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
	interaction?: BarChart3DInteraction,
): Promise<BarChart3DHandle> {
	const three = await loadChart3DThree();
	const OrbitCtrlCtor = three ? await loadChart3DOrbitControls() : null;
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
	// A horizontal bar3D chart's boxes sit at various world-Y heights (the
	// remapped category axis), so the floor also covers that vertical spread.
	const floorSize = Math.max(extent.gridWidth, extent.gridDepth, MAX_VALUE_HEIGHT * 2) * 1.2;
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
	// a mismatched one. KNOWN APPROXIMATION: unlike the boxes and labels, these
	// panels are not reoriented for `options.horizontal` (they still paint the
	// vertical category=X, value=Y frame's panel positions).
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
	// {@link ./bar-chart-3d-geometry.ts}). `c:pictureOptions` picture-fill
	// textures (see {@link ./bar-chart-3d-materials.ts}) share one texture
	// manager across every box, so two boxes referencing the same picture
	// load the image once.
	const textureManager = createBarChart3DTextureManager(three);
	const {
		meshes: boxMeshes,
		materials: boxMaterials,
		geometries: boxGeometries,
		materialDisposers: boxMaterialDisposers,
	} = buildBar3DMeshGroup(
		three,
		scene,
		options.boxes,
		options.horizontal,
		options.picture ? { context: options.picture, textures: textureManager } : undefined,
	);

	// Raycast-based hover tooltip: each box mesh carries its own (series,
	// category, value) in `userData`, so a hit reports the cell directly (no
	// face-index -> cell arithmetic, unlike the surface chart's single mesh).
	const hoverTooltip = attachChart3DHoverTooltip({
		three,
		canvas,
		camera,
		meshes: boxMeshes,
		buildTooltip: (intersection) =>
			buildBarChart3DHoverTooltip(intersection?.object.userData as BarChart3DHit | undefined, {
				categoryLabels: options.categoryLabels,
				seriesNames: options.seriesNames,
				numberFormats: options.numberFormats,
			}),
	});

	const controls = new OrbitCtrlCtor(camera, canvas);
	controls.enablePan = true;
	controls.enableZoom = true;
	controls.enableRotate = true;
	controls.minDistance = 0.5;
	controls.maxDistance = 30;
	controls.maxPolarAngle = Math.PI / 2 + 0.3;
	controls.target.copy(target);
	controls.update();

	// Click-to-select + drag-to-value: raycasts the SAME box meshes the hover
	// tooltip above uses (see bar-chart-3d-interaction-wiring.ts).
	const pointerInteraction = attachBarChart3DInteraction({
		three,
		canvas,
		camera,
		controls,
		width,
		height,
		boxMeshes,
		boxMaterials: boxMaterials as unknown as HighlightableMaterialRef[],
		boxes: options.boxes,
		grouping: options.grouping,
		horizontal: Boolean(options.horizontal),
		interaction,
	});

	// Axis-label DOM overlay, re-projected to screen each frame.
	const doc = container.ownerDocument ?? document;
	const labels = buildCartesianChart3DLabels(
		options.cols,
		options.rows,
		options.categoryLabels,
		options.seriesNames,
		options.view3D?.depthPercent,
		undefined,
		undefined,
		options.horizontal,
	);
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
			for (const g of boxGeometries) {
				g.dispose();
			}
			for (const disposeMaterial of boxMaterialDisposers) {
				disposeMaterial();
			}
			textureManager.disposeAll();
			gridFloor.dispose();
			walls?.dispose();
			scene.clear();
			renderer.dispose();
			canvas.remove();
			labelProjector.layer.remove();
		},
	};
}
