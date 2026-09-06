/**
 * Vanilla three.js 3D area-chart scene controller (framework-agnostic).
 *
 * Identical to {@link ./line-chart-3d-scene.ts}, EXCEPT it additionally fills
 * a translucent ribbon from each series' path down to its baseline (value =
 * 0), via {@link ./area-chart-3d-ribbon-geometry.ts}, matching PowerPoint's
 * real 3-D Area chart.
 *
 * @module area-chart-3d-scene
 */

import type * as THREE from 'three';

import type { TextStyleAnimationDescriptor } from './animation-text-style-resolve';
import { buildAreaRibbonGeometry } from './area-chart-3d-ribbon-geometry';
import {
	buildCartesianChart3DLabels,
	computeCartesianCameraPlacement,
	computeCartesianGridExtent,
	MAX_VALUE_HEIGHT,
} from './cartesian-chart-3d-geom';
import type { CartesianChart3DHit } from './cartesian-chart-3d-hit-test';
import { buildCartesianChart3DHoverTooltip } from './cartesian-chart-3d-hit-test';
import { attachCartesianChart3DInteraction } from './cartesian-chart-3d-interaction-wiring';
import type { CartesianChart3DInteraction } from './cartesian-chart-3d-interaction-wiring';
import type { CartesianLine3DSceneOptions } from './cartesian-line-chart-3d-data';
import { attachChart3DHoverTooltip } from './chart-3d-hover-tooltip';
import { createChart3DLabelProjector } from './chart-3d-label-projection';
import type { HighlightableMaterial } from './chart-3d-mesh-highlight';
import { loadChart3DOrbitControls, loadChart3DThree } from './chart-3d-three-loader';
import type { ChartPartRef } from './chart-view-model';
import { buildSurfaceWallMeshes } from './surface-chart-3d-walls';

export type { CartesianChart3DInteraction };

/** Imperative handle to a mounted area3D chart view. */
export interface AreaChart3DHandle {
	readonly ok: boolean;
	resize: (width: number, height: number) => void;
	/** Apply (or clear) the selected-mark highlight, e.g. when selection changes via the inspector rather than a click on this scene. */
	setSelectedPart: (part: ChartPartRef | null) => void;
	/** Apply (or clear) a font-style emphasis override on the axis labels. */
	setTextStyle: (style: TextStyleAnimationDescriptor | undefined) => void;
	dispose: () => void;
}

/** No-op sentinel returned when `three` or its OrbitControls addon is missing. */
export const AREA_CHART_THREE_UNAVAILABLE: AreaChart3DHandle = {
	ok: false,
	resize: () => {},
	setSelectedPart: () => {},
	setTextStyle: () => {},
	dispose: () => {},
};

/** World-space radius of the tube swept along a series' path (drawn atop the ribbon). */
const TUBE_RADIUS = 0.02;
/** World-space radius of each per-vertex hover marker. */
const MARKER_RADIUS = 0.045;
/** Ribbon fill opacity, translucent so overlapping series planes stay legible. */
const RIBBON_OPACITY = 0.75;

/**
 * Mount an interactive 3D area chart into `container` and start rendering.
 *
 * Resolves to {@link AREA_CHART_THREE_UNAVAILABLE} when `three` or its
 * OrbitControls addon cannot be loaded, so the caller can fall back to the
 * flat SVG oblique-projection area3D renderer.
 */
export async function mountAreaChart3D(
	container: HTMLElement,
	options: CartesianLine3DSceneOptions,
	interaction?: CartesianChart3DInteraction,
): Promise<AreaChart3DHandle> {
	const three = await loadChart3DThree();
	const OrbitCtrlCtor = three ? await loadChart3DOrbitControls() : null;
	if (!three || !OrbitCtrlCtor) {
		return AREA_CHART_THREE_UNAVAILABLE;
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
	const gridSegs = Math.max(options.cols, options.rows);
	const gridFloor = new three.GridHelper(floorSize, gridSegs, 0xcccccc, 0xe8e8e8);
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

	const markerGeometry = new three.SphereGeometry(MARKER_RADIUS, 8, 6);
	const tubeGeometries: THREE.TubeGeometry[] = [];
	const ribbonGeometries: THREE.BufferGeometry[] = [];
	const otherMaterials: THREE.Material[] = [];
	const markerMeshes: THREE.Mesh[] = [];
	const markerMaterials: THREE.Material[] = [];

	for (const path of options.series) {
		const ribbonGeometry = buildAreaRibbonGeometry(three, path);
		if (ribbonGeometry) {
			const ribbonMaterial = new three.MeshPhongMaterial({
				color: path.color,
				side: three.DoubleSide,
				transparent: true,
				opacity: RIBBON_OPACITY,
				shininess: 10,
			});
			scene.add(new three.Mesh(ribbonGeometry, ribbonMaterial));
			ribbonGeometries.push(ribbonGeometry);
			otherMaterials.push(ribbonMaterial);
		}
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
			scene.add(new three.Mesh(tubeGeometry, tubeMaterial));
			tubeGeometries.push(tubeGeometry);
			otherMaterials.push(tubeMaterial);
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
			otherMaterials.push(markerMaterial);
		}
	}

	const tooltipData = {
		categoryLabels: options.categoryLabels,
		seriesNames: options.seriesNames,
		numberFormats: options.numberFormats,
	};
	const hoverTooltip = attachChart3DHoverTooltip({
		three,
		canvas,
		camera,
		meshes: markerMeshes,
		buildTooltip: (intersection) =>
			buildCartesianChart3DHoverTooltip(
				intersection?.object.userData as CartesianChart3DHit | undefined,
				tooltipData,
			),
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

	// Click-to-select + drag-to-value (see cartesian-chart-3d-interaction-wiring.ts).
	const pointerInteraction = attachCartesianChart3DInteraction({
		three,
		canvas,
		camera,
		controls,
		width,
		height,
		markerMeshes,
		markerMaterials: markerMaterials as unknown as HighlightableMaterial[],
		series: options.series,
		interaction,
	});

	const doc = container.ownerDocument ?? document;
	const labels = buildCartesianChart3DLabels(
		options.cols,
		options.rows,
		options.categoryLabels,
		options.seriesNames,
		options.view3D?.depthPercent,
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
			markerGeometry.dispose();
			for (const g of [...tubeGeometries, ...ribbonGeometries]) {
				g.dispose();
			}
			for (const m of otherMaterials) {
				m.dispose();
			}
			gridFloor.dispose();
			walls?.dispose();
			scene.clear();
			renderer.dispose();
			canvas.remove();
			labelProjector.layer.remove();
		},
	};
}
