/**
 * three.js 3D line-chart scene for `<pptx-three-view>` (framework-agnostic).
 *
 * Builds an interactive `line3D` chart as a `<pptx-three-view>` scene: one
 * `THREE.TubeGeometry` per series (swept along a `CatmullRomCurve3` through
 * its category/value points, own depth "Z" plane, see
 * {@link ./cartesian-line-chart-3d-layout.ts}), a small sphere marker per data
 * point (hover + click/drag hit target), grid floor, authored wall panels, a
 * `c:view3D` camera and OrbitControls, on the shared stage from
 * {@link ./chart-3d-hosted-stage.ts}.
 *
 * @module line-chart-3d-scene
 */

import type * as THREE from 'three';

import type { ThreeViewContext, ThreeViewScene } from '../three-view/types';
import {
	buildCartesianChart3DLabels,
	computeCartesianCameraPlacement,
	computeCartesianGridExtent,
	MAX_VALUE_HEIGHT,
} from './cartesian-chart-3d-geom';
import type { CartesianChart3DHit } from './cartesian-chart-3d-hit-test';
import { buildCartesianChart3DHoverTooltip } from './cartesian-chart-3d-hit-test';
import { attachCartesianChart3DInteraction } from './cartesian-chart-3d-interaction-wiring';
import type { CartesianLine3DSceneOptions } from './cartesian-line-chart-3d-data';
import {
	createHostedChart3DStage,
	finishHostedChart3DScene,
	hostedChart3DInteraction,
} from './chart-3d-hosted-stage';
import { attachChart3DHoverTooltip } from './chart-3d-hover-tooltip';
import { createChart3DLabelProjector } from './chart-3d-label-projection';
import type { HighlightableMaterial } from './chart-3d-mesh-highlight';
import { buildSurfaceWallMeshes } from './surface-chart-3d-walls';

/** World-space radius of the tube swept along a series' path. */
const TUBE_RADIUS = 0.025;
/** World-space radius of each per-vertex hover marker. */
const MARKER_RADIUS = 0.045;

/** Build the hosted LineChart3D scene. */
export function createLineChart3DScene(
	ctx: ThreeViewContext,
	options: CartesianLine3DSceneOptions,
): ThreeViewScene {
	const placement = computeCartesianCameraPlacement(options.cols, options.rows, options.view3D);
	const stage = createHostedChart3DStage(
		ctx,
		placement,
		{ minDistance: 0.5, maxDistance: 30 },
		0.6,
	);
	const { three, scene, camera, canvas, controls, width, height } = stage;
	const interaction = hostedChart3DInteraction(ctx);

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

	// One tube per series; one shared sphere geometry for the hover markers.
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

	// Raycast-based hover tooltip against the per-vertex marker meshes.
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

	const labels = buildCartesianChart3DLabels(
		options.cols,
		options.rows,
		options.categoryLabels,
		options.seriesNames,
		options.view3D?.depthPercent,
	);
	const labelProjector = createChart3DLabelProjector(three, ctx.document, labels);
	labelProjector.applyTextStyle(options.textStyle);
	ctx.overlay.appendChild(labelProjector.layer);

	return finishHostedChart3DScene(
		ctx,
		stage,
		{
			afterRender: (cam, w, h) => labelProjector.update(cam, w, h),
			resize: (w, h) => pointerInteraction.updateSize(w, h),
			setSelectedPart: (part) => pointerInteraction.setSelectedPart(part),
			setTextStyle: (style) => labelProjector.applyTextStyle(style),
			dispose() {
				hoverTooltip.dispose();
				pointerInteraction.dispose();
				markerGeometry.dispose();
				for (const g of tubeGeometries) {
					g.dispose();
				}
				for (const m of [...tubeMaterials, ...markerMaterials]) {
					m.dispose();
				}
				gridFloor.dispose();
				walls?.dispose();
				labelProjector.layer.remove();
			},
		},
		interaction,
	);
}
