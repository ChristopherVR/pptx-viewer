/**
 * three.js 3D bar-chart scene for `<pptx-three-view>` (framework-agnostic).
 *
 * Builds an interactive `bar3D` chart as a `<pptx-three-view>` scene
 * (hosted on the shared renderer; see {@link ./chart-3d-hosted-stage.ts}): builds
 * one mesh per data point (clustered: each series its own depth plane;
 * stacked/percentStacked: coplanar, stacked vertically - see
 * {@link ./bar-chart-3d-data.ts}; geometry per box's resolved `c:shape` - see
 * {@link ./bar-chart-3d-geometry.ts}), a grid floor, authored `c:floor`/
 * `c:sideWall`/`c:backWall` panels and a perspective camera driven by
 * `c:view3D`. Raycasts pointer moves against the boxes to
 * set a native hover tooltip on the canvas element (see
 * {@link ./bar-chart-3d-hit-test.ts}), matching every other chart kind's
 * SVG-`<title>` hover tooltip.
 *
 * A horizontal 3-D Bar (`options.horizontal`) mounts the SAME scene: boxes
 * arrive already remapped into the horizontal frame, so this module only
 * rotates each mesh to match, builds the label overlay in that frame, and
 * asks {@link computeCartesianCameraPlacement} for the matching (also
 * transposed) camera placement so the view frames the actual rendered
 * extents instead of the untransposed vertical bounding box.
 *
 * @module bar-chart-3d-scene
 */

import type { ThreeViewContext, ThreeViewScene } from '../three-view/types';
import type { BarChart3DSceneOptions } from './bar-chart-3d-data';
import { buildBar3DMeshGroup } from './bar-chart-3d-geometry';
import { buildBarChart3DHoverTooltip } from './bar-chart-3d-hit-test';
import type { BarChart3DHit } from './bar-chart-3d-hit-test';
import { attachBarChart3DInteraction } from './bar-chart-3d-interaction-wiring';
import { createBarChart3DTextureManager } from './bar-chart-3d-materials';
import type { BarChart3DTextureManager } from './bar-chart-3d-materials';
import {
	buildCartesianChart3DLabels,
	computeCartesianCameraPlacement,
	computeCartesianGridExtent,
	MAX_VALUE_HEIGHT,
} from './cartesian-chart-3d-geom';
import {
	createHostedChart3DStage,
	finishHostedChart3DScene,
	hostedChart3DInteraction,
} from './chart-3d-hosted-stage';
import { attachChart3DHoverTooltip } from './chart-3d-hover-tooltip';
import { createChart3DLabelProjector } from './chart-3d-label-projection';
import type { HighlightableMaterialRef } from './chart-3d-mesh-highlight';
import { buildSurfaceWallMeshes } from './surface-chart-3d-walls';

/** Build the hosted bar3D scene. */
export function createBarChart3DScene(
	ctx: ThreeViewContext,
	options: BarChart3DSceneOptions,
): ThreeViewScene {
	const placement = computeCartesianCameraPlacement(
		options.cols,
		options.rows,
		options.view3D,
		options.horizontal,
	);
	const stage = createHostedChart3DStage(ctx, placement, { minDistance: 0.5, maxDistance: 30 });
	const { three, scene, camera, canvas } = stage;

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
	// (see {@link ./bar-chart-3d-geometry.ts}). `c:pictureOptions` picture-fill
	// textures share one texture manager across every box; each finished load
	// asks the host for a frame, since nothing else would redraw the view.
	const baseTextures = createBarChart3DTextureManager(three);
	const textures: BarChart3DTextureManager = {
		load: (url) =>
			baseTextures.load(url).then((texture) => {
				setTimeout(ctx.requestRender, 0);
				return texture;
			}),
		disposeAll: () => baseTextures.disposeAll(),
	};
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
		options.picture ? { context: options.picture, textures } : undefined,
	);

	// Raycast-based hover tooltip: each box mesh carries its own (series,
	// category, value) in `userData`, so a hit reports the cell directly.
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

	// Click-to-select + drag-to-value: raycasts the SAME box meshes the hover
	// tooltip above uses (see bar-chart-3d-interaction-wiring.ts).
	const interaction = hostedChart3DInteraction(ctx);
	const pointerInteraction = attachBarChart3DInteraction({
		three,
		canvas,
		camera,
		controls: stage.controls,
		width: stage.width,
		height: stage.height,
		boxMeshes,
		boxMaterials: boxMaterials as unknown as HighlightableMaterialRef[],
		boxes: options.boxes,
		grouping: options.grouping,
		horizontal: Boolean(options.horizontal),
		interaction,
	});

	// Axis-label DOM overlay, re-projected to screen after each frame.
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
	const labelProjector = createChart3DLabelProjector(three, ctx.document, labels);
	labelProjector.applyTextStyle(options.textStyle);
	ctx.overlay.appendChild(labelProjector.layer);

	return finishHostedChart3DScene(
		ctx,
		stage,
		{
			afterRender: (cam, width, height) => labelProjector.update(cam, width, height),
			resize: (width, height) => pointerInteraction.updateSize(width, height),
			setSelectedPart: (part) => pointerInteraction.setSelectedPart(part),
			setTextStyle: (style) => labelProjector.applyTextStyle(style),
			dispose() {
				hoverTooltip.dispose();
				pointerInteraction.dispose();
				for (const g of boxGeometries) {
					g.dispose();
				}
				for (const disposeMaterial of boxMaterialDisposers) {
					disposeMaterial();
				}
				textures.disposeAll();
				gridFloor.dispose();
				walls?.dispose();
				labelProjector.layer.remove();
			},
		},
		interaction,
	);
}
