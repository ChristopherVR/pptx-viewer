/**
 * three.js 3D area-chart scene for `<pptx-three-view>` (framework-agnostic).
 *
 * Identical to {@link ./line-chart-3d-scene.ts}, EXCEPT it additionally fills
 * a translucent ribbon from each series' path down to its baseline (value =
 * 0), via {@link ./area-chart-3d-ribbon-geometry.ts}, matching PowerPoint's
 * real 3-D Area chart.
 *
 * @module area-chart-3d-scene
 */

import type * as THREE from 'three';

import type { ThreeViewContext, ThreeViewScene } from '../three-view/types';
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

/** World-space radius of the tube swept along a series' path (drawn atop the ribbon). */
const TUBE_RADIUS = 0.02;
/** World-space radius of each per-vertex hover marker. */
const MARKER_RADIUS = 0.045;
/** Ribbon fill opacity, translucent so overlapping series planes stay legible. */
const RIBBON_OPACITY = 0.75;

/** Build the hosted AreaChart3D scene. */
export function createAreaChart3DScene(
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
				for (const g of [...tubeGeometries, ...ribbonGeometries]) {
					g.dispose();
				}
				for (const m of otherMaterials) {
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
