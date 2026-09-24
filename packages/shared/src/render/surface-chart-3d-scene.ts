/**
 * three.js 3D surface-chart scene for `<pptx-three-view>` (framework-agnostic).
 *
 * Builds an interactive surface chart as a `<pptx-three-view>` scene: a
 * colour-displaced surface mesh (with optional wireframe), grid floor,
 * lights, an isometric camera, and DOM axis labels re-projected to screen
 * after each frame. Raycasts pointer moves against the mesh for a native
 * hover tooltip (see {@link ./surface-chart-3d-hit-test.ts}) and clicks/drags
 * for selection and value editing (see
 * {@link ./surface-chart-3d-interaction-wiring.ts}).
 *
 * @module surface-chart-3d-scene
 */

import type * as THREE from 'three';

import type { ThreeViewContext, ThreeViewScene } from '../three-view/types';
import type { TextStyleAnimationDescriptor } from './animation-text-style-resolve';
import {
	createHostedChart3DStage,
	finishHostedChart3DScene,
	hostedChart3DInteraction,
} from './chart-3d-hosted-stage';
import { attachChart3DHoverTooltip } from './chart-3d-hover-tooltip';
import { createChart3DLabelProjector } from './chart-3d-label-projection';
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
import { buildSurfaceWallMeshes } from './surface-chart-3d-walls';
import type { SurfaceWallColors } from './surface-chart-3d-walls';

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

const FOV = 45;

/** Build the hosted SurfaceChart3D scene. */
export function createSurfaceChart3DScene(
	ctx: ThreeViewContext,
	options: SurfaceChart3DSceneOptions,
): ThreeViewScene {
	const { cols, rows } = options;
	const placement = computeCameraPlacement(cols, rows, options.view3D);
	const stage = createHostedChart3DStage(
		ctx,
		{ fov: FOV, ...placement },
		{ minDistance: 1, maxDistance: 20 },
		0.6,
	);
	const { three, scene, camera, canvas, controls, width, height } = stage;
	const interaction = hostedChart3DInteraction(ctx);

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
	const labels = buildSurfaceLabels(cols, rows, options.categoryLabels, options.seriesNames);
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
				geometry.dispose();
				wireGeometry.dispose();
				surfaceMaterial.dispose();
				wireMaterial?.dispose();
				highlightMarker.dispose();
				gridFloor.dispose();
				walls?.dispose();
				labelProjector.layer.remove();
			},
		},
		interaction,
	);
}
